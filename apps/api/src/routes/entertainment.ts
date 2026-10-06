import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { DriverFactory } from '../services/entertainment/factory/DriverFactory';
import { Command } from '@mosa/core/dist/types/Command';
import { randomUUID } from 'crypto';
import net from 'net';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Helper to check if a TCP port is open on a host
function probePort(host: string, port: number, timeoutMs = 600): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      isResolved = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.once('error', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

// Known Smart TV Ports for real live verification
const TV_PORT_PROFILES = [
  { brand: 'tcl', name: 'TCL Google TV / Android TV', port: 8008, protocol: 'TCL' },
  { brand: 'tcl', name: 'TCL Roku TV', port: 8060, protocol: 'ROKU' },
  { brand: 'samsung', name: 'Samsung Smart TV (Tizen)', port: 8001, protocol: 'TIZEN' },
  { brand: 'samsung', name: 'Samsung Smart TV (Secure)', port: 8002, protocol: 'TIZEN' },
  { brand: 'lg', name: 'LG webOS Smart TV', port: 3000, protocol: 'WEBOS' },
  { brand: 'lg', name: 'LG webOS Smart TV (SSL)', port: 3001, protocol: 'WEBOS' },
  { brand: 'sony', name: 'Sony Bravia TV', port: 80, protocol: 'SONY' },
  { brand: 'appletv', name: 'Apple TV (AirPlay)', port: 7000, protocol: 'APPLETV' },
  { brand: 'roku', name: 'Roku Streaming Device', port: 8060, protocol: 'ROKU' },
];

export default async function entertainmentRoutes(fastify: FastifyInstance) {
  
  // 1. Auto-Discover REAL Smart TVs on Local Wi-Fi Network (Strict TV filtering - No ESP/relays/mocks)
  fastify.get('/discover', async (request, reply) => {
    try {
      // 1. Check real discovered devices in database that are strictly Smart TVs (exclude ESP, relays, nodes, sensors)
      const rawDiscovered = await prisma.discoveredDevice.findMany({
        where: {
          AND: [
            {
              OR: [
                { deviceType: { contains: 'TV', mode: 'insensitive' } },
                { deviceType: { contains: 'TCL', mode: 'insensitive' } },
                { deviceType: { contains: 'Samsung', mode: 'insensitive' } },
                { deviceType: { contains: 'webOS', mode: 'insensitive' } },
                { deviceType: { contains: 'Cast', mode: 'insensitive' } },
                { deviceType: { contains: 'MediaRenderer', mode: 'insensitive' } },
                { deviceType: { contains: 'AppleTV', mode: 'insensitive' } },
                { deviceType: { contains: 'Roku', mode: 'insensitive' } }
              ]
            },
            {
              NOT: [
                { deviceType: { contains: 'ESP', mode: 'insensitive' } },
                { deviceType: { contains: 'Node', mode: 'insensitive' } },
                { deviceType: { contains: 'Switch', mode: 'insensitive' } },
                { deviceType: { contains: 'Relay', mode: 'insensitive' } },
                { deviceType: { contains: 'Sensor', mode: 'insensitive' } },
                { deviceType: { contains: 'Mosquitto', mode: 'insensitive' } },
                { deviceType: { contains: 'Gateway', mode: 'insensitive' } }
              ]
            }
          ]
        },
        take: 20
      }).catch(() => []);

      const realTvs: any[] = [];

      // Map verified database TV devices
      for (const d of rawDiscovered) {
        const typeLower = (d.deviceType || '').toLowerCase();
        let brand = 'tcl';
        let brandName = 'TCL Smart TV';
        let protocol = 'TCL';

        if (typeLower.includes('samsung') || typeLower.includes('tizen')) {
          brand = 'samsung';
          brandName = 'Samsung (Tizen OS)';
          protocol = 'TIZEN';
        } else if (typeLower.includes('lg') || typeLower.includes('webos')) {
          brand = 'lg';
          brandName = 'LG webOS';
          protocol = 'WEBOS';
        } else if (typeLower.includes('sony') || typeLower.includes('bravia')) {
          brand = 'sony';
          brandName = 'Sony Bravia';
          protocol = 'SONY';
        } else if (typeLower.includes('apple') || typeLower.includes('appletv')) {
          brand = 'appletv';
          brandName = 'Apple TV';
          protocol = 'APPLETV';
        } else if (typeLower.includes('roku')) {
          brand = 'roku';
          brandName = 'Roku TV';
          protocol = 'ROKU';
        }

        realTvs.push({
          id: d.id || `tv-${d.ipAddress}`,
          name: d.deviceType?.replace(/_/g, ' ') || `${brandName} (${d.ipAddress})`,
          brand,
          brandName,
          ipAddress: d.ipAddress,
          protocol,
          model: d.deviceType || 'Smart TV',
          online: true,
          signalStrength: 95,
          discoveryMethod: 'Wi-Fi SSDP / mDNS'
        });
      }

      // 2. Active network probe for Smart TVs on local subnet (including verified TCL at 192.168.1.108)
      const knownIpsToProbe = ['192.168.1.108', '192.168.1.105', '192.168.1.106', '192.168.1.107', '192.168.1.109', '192.168.1.111', '192.168.1.112', '192.168.1.115'];
      
      const probePromises = knownIpsToProbe.map(async (ip) => {
        if (realTvs.some(t => t.ipAddress === ip)) return;

        const isDial = await probePort(ip, 8008, 600);
        const isAdbRemote = await probePort(ip, 6466, 600);
        const isRoku = await probePort(ip, 8060, 600);
        const isSamsung = await probePort(ip, 8001, 600);
        const isLg = await probePort(ip, 3000, 600);

        if (isDial || isAdbRemote || isRoku || isSamsung || isLg) {
          let brand = 'tcl';
          let brandName = 'شاشة TCL الذكية';
          let protocol = 'TCL';
          let model = 'TCL Google TV / Android TV';

          if (isDial) {
            try {
              const res = await fetch(`http://${ip}:8008/ssdp/device-desc.xml`, { signal: AbortSignal.timeout(1000) });
              const xml = await res.text();
              const fn = (xml.match(/<friendlyName>(.*?)<\/friendlyName>/) || [])[1];
              const mf = (xml.match(/<manufacturer>(.*?)<\/manufacturer>/) || [])[1];
              if (fn) brandName = `شاشة ${mf || 'TCL'} (${fn})`;
              if (mf && mf.toLowerCase().includes('tcl')) brand = 'tcl';
            } catch (e) {}
          } else if (isRoku) {
            brand = 'roku';
            brandName = 'Roku TV';
            protocol = 'ROKU';
            model = 'Roku Streaming TV';
          } else if (isSamsung) {
            brand = 'samsung';
            brandName = 'Samsung Smart TV';
            protocol = 'TIZEN';
            model = 'Samsung Tizen OS';
          } else if (isLg) {
            brand = 'lg';
            brandName = 'LG webOS TV';
            protocol = 'WEBOS';
            model = 'LG webOS';
          }

          realTvs.push({
            id: `tv-${ip.replace(/\./g, '-')}`,
            name: brandName,
            brand,
            brandName,
            ipAddress: ip,
            protocol,
            model,
            online: true,
            signalStrength: 98,
            discoveryMethod: isDial ? 'Wi-Fi DIAL (Port 8008)' : 'Wi-Fi Network Probe'
          });
        }
      });

      await Promise.all(probePromises);

      // Return ONLY real discovered Smart TVs (0 if none currently on the local network)
      return reply.send({
        success: true,
        count: realTvs.length,
        devices: realTvs
      });
    } catch (err: any) {
      return reply.send({ success: true, count: 0, devices: [] });
    }
  });

  // 1.5 Quick Probe an IP address to verify if it's a real TV
  fastify.post('/probe-ip', async (request, reply) => {
    try {
      const { ipAddress } = (request.body as any) || {};
      if (!ipAddress || typeof ipAddress !== 'string') {
        return reply.code(400).send({ success: false, error: 'عنوان IP مطلوب' });
      }

      const trimmedIp = ipAddress.trim();
      if (!net.isIP(trimmedIp)) {
        return reply.code(400).send({ success: false, error: 'تنسيق عنوان IP غير صالح' });
      }

      // Test against known TV ports
      const detectedProfiles = [];
      for (const p of TV_PORT_PROFILES) {
        const isOpen = await probePort(trimmedIp, p.port, 500);
        if (isOpen) {
          detectedProfiles.push(p);
        }
      }

      if (detectedProfiles.length > 0) {
        const best = detectedProfiles[0];
        return reply.send({
          success: true,
          isReachable: true,
          suggestedBrand: best.brand,
          suggestedName: best.name,
          protocol: best.protocol,
          detectedPorts: detectedProfiles.map(p => p.port)
        });
      }

      return reply.send({
        success: true,
        isReachable: false,
        message: 'الجهاز لم يستجب على منافذ الشاشات الذكية المعروفة، ولكن يمكنك إضافته يدوياً.'
      });
    } catch (err: any) {
      return reply.send({ success: false, isReachable: false, error: err.message });
    }
  });

  // 2. 1-Click Pair / Register Smart TV to System
  fastify.post('/pair', async (request, reply) => {
    try {
      const { name, brand, ipAddress, roomId, protocol } = (request.body as any) || {};

      if (!name || !ipAddress) {
        return reply.code(400).send({ error: 'الاسم وعنوان IP مطلوبان للاقتران' });
      }

      // Find first home or default
      const home = await prisma.home.findFirst();
      const homeId = home?.id;

      if (!homeId) {
        return reply.code(400).send({ error: 'لا يوجد منزل مسجل' });
      }

      // Find or create a Node for entertainment devices
      let node = await prisma.node.findFirst({
        where: { homeId, name: { contains: 'Entertainment' } }
      });

      if (!node) {
        node = await prisma.node.findFirst({ where: { homeId } });
      }

      if (!node) {
        node = await prisma.node.create({
          data: {
            name: 'Entertainment Hub',
            mac: 'TV:HUB:' + randomUUID().substring(0, 8),
            ip: ipAddress,
            homeId: homeId,
            status: 'online'
          }
        });
      }

      // Create or update device
      const brandUpper = (brand || 'TCL').toUpperCase();
      const newDevice = await prisma.device.create({
        data: {
          name: name,
          type: 'TV',
          homeId: homeId,
          roomId: roomId || null,
          nodeId: node.id,
          pin: 0,
          ipAddress: ipAddress,
          protocol: brandUpper === 'TCL' ? 'TCL' : (protocol || brandUpper),
          state: {
            isOn: true,
            volume: 25,
            isMuted: false,
            brand: brand || 'tcl',
            input: 'HDMI1',
            activeApp: 'netflix'
          }
        }
      });

      // Broadcast TV paired event
      if ((fastify as any).io) {
        (fastify as any).io.emit('device_created', newDevice);
        (fastify as any).io.emit('tv:paired', newDevice);
      }

      return reply.send({
        success: true,
        message: `تم اقتران ${name} بنجاح عبر الواي فاي!`,
        device: newDevice
      });
    } catch (err: any) {
      fastify.log.error(err, '[Entertainment Pair Error]');
      return reply.code(500).send({ error: err?.message || 'فشل اقتران الشاشة' });
    }
  });

  // 3. Delete / Unpair TV
  fastify.delete('/:deviceId', async (request, reply) => {
    const { deviceId } = request.params as any;
    try {
      if (deviceId && deviceId !== 'master-tv') {
        await prisma.device.delete({
          where: { id: deviceId }
        }).catch(() => {});
      }
      return reply.send({ success: true, message: 'تم إزالة الشاشة بنجاح' });
    } catch (err: any) {
      return reply.send({ success: true });
    }
  });

  // 4. Get TV State
  fastify.get('/:deviceId/state', async (request, reply) => {
    const { deviceId } = request.params as any;

    try {
      const device = await prisma.device.findUnique({
        where: { id: deviceId }
      });

      if (!device) {
        return reply.send({
          state: { isOn: true, volume: 30, isMuted: false },
          capabilities: { apps: true, inputs: true },
          apps: [
            { id: 'netflix', name: 'Netflix' },
            { id: 'youtube', name: 'YouTube' },
            { id: 'shahid', name: 'Shahid VIP' },
            { id: 'tclchannel', name: 'TCL Home' }
          ],
          inputs: [
            { id: 'HDMI1', name: 'HDMI 1 (eARC)' },
            { id: 'HDMI2', name: 'HDMI 2' },
            { id: 'TV', name: 'Live TV' }
          ],
          deviceInfo: {
            name: 'Smart TV Master',
            ip: '192.168.1.100',
            protocol: 'TCL'
          }
        });
      }
      
      const driver = DriverFactory.getDriver(device.id, device.protocol || 'TCL', device.ipAddress || '192.168.1.100');
      
      const stateResult = await driver.getState();
      const caps = driver.getCapabilities();
      let apps: any[] = [];
      let inputs: any[] = [];

      if (caps.apps) {
        const appsResult = await driver.getApps();
        if (appsResult.isSuccess) apps = appsResult.getValue();
      }
      
      if (caps.inputs) {
        const inputsResult = await driver.getInputs();
        if (inputsResult.isSuccess) inputs = inputsResult.getValue();
      }

      return reply.send({
        state: stateResult.isSuccess ? stateResult.getValue() : null,
        capabilities: caps,
        apps,
        inputs,
        deviceInfo: {
          name: device.name,
          ip: device.ipAddress,
          protocol: device.protocol || 'TCL'
        }
      });
    } catch (err: any) {
      return reply.send({
        state: { isOn: true, volume: 30, isMuted: false },
        deviceInfo: { name: 'Smart TV', protocol: 'TCL' }
      });
    }
  });

  // 5. Execute Universal TV Command (IP, IR Blaster, MQTT, WebSocket)
  fastify.post('/:deviceId/command', async (request, reply) => {
    const { deviceId } = request.params as any;
    const { action, value, brand, ipAddress } = (request.body as any) || {};

    try {
      const payload = {
        deviceId,
        brand: brand || 'tcl',
        action,
        value,
        ipAddress,
        timestamp: Date.now()
      };

      // 1. Broadcast via MQTT for ESP32 IR Blaster & IP bridges
      if ((fastify as any).mqtt?.publish) {
        (fastify as any).mqtt.publish('mosa/tv/command', JSON.stringify(payload), { retain: false });
        (fastify as any).mqtt.publish('mosa/ir/send', JSON.stringify({
          type: 'TV',
          brand: brand || 'tcl',
          cmd: action,
          data: value
        }), { retain: false });
      }

      // 2. Broadcast via Socket.IO
      if ((fastify as any).io) {
        (fastify as any).io.emit('tv:command', payload);
      }

      // 3. Find target TV device or fallback to active TV
      let targetDevice: any = null;
      if (deviceId && deviceId !== 'master-tv' && deviceId !== 'master-tv-devices') {
        targetDevice = await prisma.device.findUnique({
          where: { id: deviceId }
        }).catch(() => null);
      }
      
      if (!targetDevice) {
        targetDevice = await prisma.device.findFirst({
          where: { type: 'TV' },
          orderBy: { createdAt: 'desc' }
        }).catch(() => null);
      }

      const effectiveIp = ipAddress || targetDevice?.ipAddress || '192.168.1.108';
      const proto = targetDevice?.protocol || (brand ? brand.toUpperCase() : 'TCL');
      const devId = targetDevice?.id || (deviceId && deviceId !== 'master-tv' ? deviceId : `virtual-tv-${effectiveIp}`);
      
      const stateObj = (targetDevice && typeof targetDevice.state === 'object' && targetDevice.state !== null ? targetDevice.state : {}) as Record<string, any>;
      const savedMac = stateObj.macAddress;

      try {
        const driver = DriverFactory.getDriver(devId, proto, effectiveIp, savedMac);
        
        // Resolve MAC in background if needed
        if ((driver as any).resolveMacAddress && !savedMac && targetDevice?.id) {
          (driver as any).resolveMacAddress().then((foundMac: string | null) => {
            if (foundMac && targetDevice?.id) {
              prisma.device.update({
                where: { id: targetDevice.id },
                data: { state: { ...stateObj, macAddress: foundMac } }
              }).catch(() => {});
            }
          }).catch(() => {});
        }

        const command: Command = {
          id: randomUUID(),
          deviceId: devId,
          driver: proto,
          payload: { action, value },
          priority: 1,
          timestamp: new Date(),
          source: 'WEB',
          retryCount: 0
        };

        const isFastInteractiveKey = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'OK', 'ENTER', 'BACK', 'HOME', 'VOL_UP', 'VOL_DOWN', 'MUTE', 'NUM_KEY', 'CH_UP', 'CH_DOWN'].includes((action || '').toUpperCase());

        if (isFastInteractiveKey) {
          // Snappy async execution without blocking HTTP response
          driver.executeCommand(command).catch((err: any) => console.error('[FastKey Error]', err?.message));
          return reply.send({ success: true, action, value, brand: brand || 'tcl', speed: 'instant' });
        } else {
          await driver.executeCommand(command).catch(() => null);
        }
      } catch (drvErr: any) {
        console.error('[Driver Execution Warning]', drvErr?.message);
      }

      return reply.send({ success: true, action, value, brand: brand || 'tcl' });
    } catch (err: any) {
      return reply.send({ success: true, action, value, notice: 'dispatched_optimistic' });
    }
  });

  // 6. 1-Click ADB Pairing / Authorization trigger
  fastify.post('/pair-adb', async (request, reply) => {
    const { deviceId, ipAddress } = (request.body as any) || {};
    let targetIp = ipAddress;

    // 1. If deviceId is provided, look up the device in DB
    if (deviceId && deviceId !== 'master-tv') {
      const dev = await prisma.device.findUnique({ where: { id: deviceId } }).catch(() => null);
      if (dev?.ipAddress) {
        targetIp = dev.ipAddress;
      }
    }

    // 2. If no IP yet, find the most recent TV in DB
    if (!targetIp) {
      const tvDev = await prisma.device.findFirst({
        where: { type: 'TV' },
        orderBy: { createdAt: 'desc' }
      }).catch(() => null);
      if (tvDev?.ipAddress) {
        targetIp = tvDev.ipAddress;
      }
    }

    // 3. Fallback: If still no IP or target IP is unreachable, auto-scan the subnet for port 5555
    if (!targetIp || !(await probePort(targetIp, 5555, 300))) {
      const candidates = ['192.168.1.108', '192.168.1.104', '192.168.1.101', '192.168.1.105', '192.168.1.106', '192.168.1.107', '192.168.1.109', '192.168.1.115', '192.168.1.120'];
      for (const h of candidates) {
        if (await probePort(h, 5555, 200)) {
          targetIp = h;
          if (deviceId && deviceId !== 'master-tv') {
            await prisma.device.update({
              where: { id: deviceId },
              data: { ipAddress: h }
            }).catch(() => {});
          }
          break;
        }
      }
    }

    if (!targetIp) {
      return reply.send({
        success: false,
        error: 'لم يتم العثور على شاشة مفتوح بها منفذ ADB (5555) على الشبكة المحلية. يرجى التأكد من تشغيل التلفاز وتفعيل تصحيح الشبكة.'
      });
    }

    try {
      const { stdout, stderr } = await execPromise(`adb connect ${targetIp}:5555`, { timeout: 4000 }).catch(e => ({
        stdout: e.stdout || '',
        stderr: e.stderr || e.message
      }));
      const output = `${stdout} ${stderr}`;
      
      if (output.includes('connected to')) {
        // Auto-resolve MAC address in background and store in device state for Wake-on-LAN
        execPromise(`adb -s ${targetIp}:5555 shell "cat /sys/class/net/wlan0/address 2>/dev/null || cat /sys/class/net/eth0/address 2>/dev/null"`, { timeout: 2000 })
          .then(({ stdout: macOut }) => {
            const m = macOut.trim().match(/([0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2})/);
            if (m && deviceId && deviceId !== 'master-tv') {
              prisma.device.update({
                where: { id: deviceId },
                data: { state: { macAddress: m[1].toLowerCase() } }
              }).catch(() => {});
            }
          }).catch(() => {});

        return reply.send({
          success: true,
          status: 'connected',
          targetIp,
          message: `تم الاتصال بنجاح بشاشة TCL على (${targetIp}:5555)! 📺✨`
        });
      } else if (output.includes('failed to authenticate') || output.includes('authorizing') || output.includes('device unauthorized')) {
        return reply.send({
          success: true,
          status: 'authorizing',
          targetIp,
          message: `يرجى النظر إلى شاشة التلفاز (${targetIp}) الآن، واختيار (السماح دائماً Always Allow) ثم الضغط على (موافق OK) بريموت الشاشة! 📺`
        });
      } else {
        return reply.send({
          success: true,
          status: 'pending',
          targetIp,
          message: `تم إرسال طلب الاتصال إلى (${targetIp}:5555). يرجى مراجعة شاشة التلفاز.`,
          raw: output
        });
      }
    } catch (e: any) {
      return reply.send({
        success: false,
        error: `تعذر الاتصال بالشاشة عبر ADB: ${e.message}`
      });
    }
  });
}

