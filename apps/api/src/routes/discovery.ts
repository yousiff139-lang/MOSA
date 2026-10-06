import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import { DiscoveryEngine } from '../services/discovery.engine';
import { getMacVariants } from '../lib/mqtt';

export default async function discoveryRoutes(fastify: FastifyInstance) {
  
  // Start a local network scan (mDNS)
  fastify.post('/discovery/scan', { preHandler: [verifyTenant] }, async (request, reply) => {
    const homeId = request.tenant.homeId;
    const scanner = new DiscoveryEngine(fastify);
    
    try {
      if (fastify.mqtt) {
        fastify.mqtt.publish('mosa/scan', JSON.stringify({ type: 'scan' }), { qos: 0 });
      }
    } catch (e) {}

    // Fire and forget (runs asynchronously for 10 seconds)
    scanner.start();
    
    return { status: 'scanning', message: 'جاري فحص الشبكة المحلية بحثاً عن الشاشات والأجهزة الذكية...' };
  });

  // Get all discovered MOSA devices from DB
  fastify.get('/discovery/devices', { preHandler: [verifyTenant] }, async (request, reply) => {
    const homeId = request.tenant.homeId;
    // Delete old discovered devices (older than 10 minutes)
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.discoveredDevice.deleteMany({
      where: { lastSeen: { lt: tenMinsAgo } }
    }).catch(() => {});

    const devices = await prisma.discoveredDevice.findMany({
      orderBy: { lastSeen: 'desc' }
    });

    // Filter out controllers that are already assigned to THIS home or any registered Node
    const registeredNodes = await prisma.node.findMany({
      where: { homeId: homeId, deletedAt: null },
      select: { mac: true, id: true }
    });
    
    const registeredMacSet = new Set<string>();
    registeredNodes.forEach(n => {
      if (n.mac) getMacVariants(n.mac).forEach(v => registeredMacSet.add(v));
      if (n.id) getMacVariants(n.id).forEach(v => registeredMacSet.add(v));
    });

    const filtered = devices.filter(d => {
      const variants = getMacVariants(d.macAddress);
      return !variants.some(v => registeredMacSet.has(v));
    });

    const formatted = filtered.map(d => {
      let protocol = 'MQTT';
      const dt = (d.deviceType || '').toUpperCase();
      if (dt.includes('ZIGBEE')) protocol = 'ZIGBEE';
      else if (dt.includes('BLE')) protocol = 'BLE';
      else if (dt.includes('ONVIF') || dt.includes('CAMERA')) protocol = 'ONVIF';
      else if (dt.includes('MDNS')) protocol = 'MDNS';
      else if (dt.includes('TUYA')) protocol = 'TUYA';

      const cleanMac = d.macAddress || '';
      const fallbackName = cleanMac.length >= 6 
        ? `شريحة MOSA ESP32 (${cleanMac.slice(-6).toUpperCase()})` 
        : 'شريحة MOSA ESP32 الذكية';

      return {
        id: d.id,
        name: d.deviceType && d.deviceType !== 'ESP32' && d.deviceType !== 'UNKNOWN'
          ? d.deviceType.replace(/_/g, ' ')
          : fallbackName,
        mac: d.macAddress || '30:30:F9:6A:1F:5C',
        macAddress: d.macAddress,
        ip: d.ipAddress && d.ipAddress !== '0.0.0.0' ? d.ipAddress : '192.168.1.100',
        ipAddress: d.ipAddress,
        type: d.deviceType || 'ESP32',
        deviceType: d.deviceType || 'ESP32',
        protocol: protocol,
        rssi: -45,
        status: 'PENDING',
        components: d.components || []
      };
    });

    return reply.send(formatted);
  });

  // Add a discovered device to the system
  fastify.post('/discovery/add', { preHandler: [verifyTenant] }, async (request, reply) => {
    try {
      const { discoveredId, roomId, name, mac, ip, deviceType } = request.body as any;
      const homeId = request.tenant.homeId;
      
      if (!discoveredId && !mac) return reply.code(400).send({ error: 'Missing discoveredId or mac' });

      // 1. Find discovered device by ID or MAC
      let discovered: any = discoveredId ? await prisma.discoveredDevice.findUnique({
        where: { id: discoveredId }
      }) : null;

      if (!discovered && (discoveredId || mac)) {
        discovered = await prisma.discoveredDevice.findFirst({
          where: { macAddress: mac || discoveredId }
        });
      }

      const targetMac = discovered?.macAddress || mac || (discoveredId && discoveredId.length > 8 ? discoveredId : '30:30:F9:6A:1F:5C');
      const targetIp = (discovered?.ipAddress && discovered.ipAddress !== '0.0.0.0') 
        ? discovered.ipAddress 
        : (ip || '192.168.1.100');

      if (!discovered) {
        discovered = {
          id: discoveredId || `disc_${Date.now()}`,
          macAddress: targetMac,
          ipAddress: targetIp,
          deviceType: deviceType || 'ESP32',
          components: [],
          lastSeen: new Date()
        } as any;
      }

      const macVariants = getMacVariants(discovered.macAddress);

      // 2. Check if node already exists by ANY MAC variant or ID
      let existingNodes = await prisma.node.findMany({
        where: {
          OR: [
            ...macVariants.map(v => ({ mac: v })),
            ...macVariants.map(v => ({ id: v }))
          ]
        },
        include: { devices: true }
      });

      let node: any = null;

      if (existingNodes.length > 0) {
        // Pick the node that already has devices configured, if any
        node = existingNodes.find(n => n.devices.length > 0) || existingNodes[0];

        // Clean up any extra duplicate empty nodes for the same MAC
        for (const dup of existingNodes) {
          if (dup.id !== node.id && dup.devices.length === 0) {
            await prisma.node.delete({ where: { id: dup.id } }).catch(() => {});
          }
        }

        // Update the primary node
        node = await prisma.node.update({
          where: { id: node.id },
          data: {
            homeId: homeId,
            ip: discovered.ipAddress,
            name: name || node.name || `MOSA Node ${discovered.macAddress}`,
            status: 'online',
            deletedAt: null
          }
        });
      } else {
        node = await prisma.node.create({
          data: {
            name: name || `MOSA Node ${discovered.macAddress}`,
            mac: discovered.macAddress,
            ip: discovered.ipAddress,
            homeId: homeId,
            status: 'online'
          }
        });
      }

      // 3. Ensure 4 Relays (Pins 2, 4, 5, 18) exist for this Node
      const existingDevices = await prisma.device.findMany({
        where: { nodeId: node.id, deletedAt: null }
      });

      if (existingDevices.length === 0) {
        const rawComponents = (discovered?.components as any[]) || [];
        if (Array.isArray(rawComponents) && rawComponents.length > 0) {
          for (const comp of rawComponents) {
            if (comp.pin !== undefined && comp.pin !== -1) {
              const compInPin = comp.inPin !== undefined && comp.inPin !== -1 
                ? Number(comp.inPin) 
                : (comp.switchPin !== undefined && comp.switchPin !== -1 ? Number(comp.switchPin) : null);
              const compType = (comp.type || 'LIGHT').toUpperCase();
              await prisma.device.create({
                data: {
                  name: comp.name || `${name || 'متحكم'} - مخرج ${comp.pin}`,
                  type: compType,
                  homeId: homeId,
                  roomId: roomId || null,
                  nodeId: node.id,
                  pin: Number(comp.pin),
                  state: {
                    isOn: false,
                    activeState: 'HIGH',
                    switchMode: 'GND',
                    switchPin: compInPin,
                    inPin: compInPin
                  }
                }
              });
            }
          }
        } else {
          const pins = [2, 4, 5, 18];
          for (let i = 0; i < pins.length; i++) {
            await prisma.device.create({
              data: {
                name: `${name || 'متحكم'} - مخرج ${pins[i]}`,
                type: 'LIGHT',
                homeId: homeId,
                roomId: roomId || null,
                nodeId: node.id,
                pin: pins[i],
                state: { isOn: false, activeState: 'HIGH', switchMode: 'GND', switchPin: null, inPin: null }
              }
            });
          }
        }
      } else if (roomId) {
        await prisma.device.updateMany({
          where: { nodeId: node.id },
          data: { roomId: roomId }
        });
      }

      // 4. Remove ALL variants of this device from Discovered Devices
      await prisma.discoveredDevice.deleteMany({
        where: {
          OR: macVariants.map(v => ({ macAddress: v }))
        }
      }).catch(() => {});

      return reply.send({ success: true, node });
    } catch (err: any) {
      fastify.log.error(err, '[Discovery Add Error]');
      return reply.code(500).send({ error: err?.message || 'حدث خطأ أثناء إضافة الجهاز' });
    }
  });

  // Clear all discovered devices
  fastify.post('/discovery/clear', { preHandler: [verifyTenant, requireRole(Role.SUPER_OWNER)] }, async (request, reply) => {
    await prisma.discoveredDevice.deleteMany({});
    return reply.send({ success: true });
  });

  // Universal Search Endpoint
  fastify.get('/search', { preHandler: [verifyTenant] }, async (request, reply) => {
    const { q } = request.query as { q: string };
    const homeId = request.tenant.homeId;
    if (!q || q.length < 2) return reply.send({ devices: [], scenes: [], rooms: [] });

    const [devices, rooms, scenes] = await Promise.all([
      prisma.device.findMany({
        where: { homeId, name: { contains: q } },
        take: 5
      }),
      prisma.room.findMany({
        where: { homeId, name: { contains: q } },
        take: 5
      }),
      prisma.scene.findMany({
        where: { homeId, name: { contains: q } },
        take: 5
      })
    ]);

    return reply.send({ devices, rooms, scenes });
  });

  // Universal Remote Control Endpoint
  fastify.post('/devices/:id/remote', { preHandler: [verifyTenant, requireRole(Role.MEMBER)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { command } = request.body as { command: string };
    const homeId = request.tenant.homeId;

    const device = await prisma.device.findUnique({
      where: { id }
    });

    if (!device || device.homeId !== homeId) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    if (!device.ipAddress || !device.protocol) {
      return reply.status(400).send({ error: 'الجهاز لا يدعم التحكم عبر الشبكة' });
    }

    // SIMULATED REMOTE CONTROL LOGIC
    // In a production app, we would use libraries like 'samsung-tv-control' or 'lgtv2' 
    // to send actual WebSocket commands to the TV IP address.
    
    console.log(`[Remote] Sending ${command} to ${device.name} at ${device.ipAddress} via ${device.protocol}`);

    // Update state optimistically if it's a power command
    if (command === 'POWER') {
      const currentState = (device.state as any) || {};
      await prisma.device.update({
        where: { id },
        data: { state: { ...currentState, isOn: !currentState.isOn } }
      });
    }

    return { success: true, command, device: device.name };
  });
}
