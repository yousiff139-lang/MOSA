import { FastifyInstance } from 'fastify';
import { prisma, withTimeout } from '../lib/prisma';
import { z } from 'zod';
import { verifyTenant } from '../lib/permissions';
import { getMacVariants } from '../lib/mqtt';
import fs from 'fs';
import path from 'path';

export const createControllerSchema = z.object({
  name: z.string(),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, 'عنوان MAC غير صالح'),
  ipAddress: z.string().optional(),
});

export async function controllerRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  server.get('/', async (request, reply) => {
    try {
      const homeId = request.tenant?.homeId;
      const controllers = await withTimeout(prisma.node.findMany({
        where: homeId ? { OR: [{ homeId }, { homeId: null }], deletedAt: null } : { deletedAt: null },
        include: { _count: { select: { devices: true } } },
        orderBy: { createdAt: 'desc' }
      }), 200).catch(() => []);

      if (controllers.length === 0) {
        return reply.send([]);
      }
      
      // Deduplicate nodes by clean MAC address
      const seenCleanMacs = new Map<string, typeof controllers[0]>();
      const duplicateIdsToDelete: string[] = [];

      const normalizeMac = (mac: string): string => {
        return mac
          .toUpperCase()
          .replace(/^MosaNode_/i, '')
          .replace(/[^0-9A-F]/g, '')
          .padStart(12, '0');
      };

      for (const c of controllers) {
        const cleanMac = normalizeMac(c.mac || c.id);
        if (!cleanMac || cleanMac.length < 6) {
          seenCleanMacs.set(c.id, c);
          continue;
        }

        const existing = seenCleanMacs.get(cleanMac);
        if (!existing) {
          seenCleanMacs.set(cleanMac, c);
        } else {
          const existingHasDevices = (existing._count?.devices || 0) > 0;
          const currentHasDevices = (c._count?.devices || 0) > 0;
          const existingHasCustomName = existing.name && !existing.name.startsWith('MosaNode_');
          const currentHasCustomName = c.name && !c.name.startsWith('MosaNode_');

          if ((currentHasDevices && !existingHasDevices) || (currentHasCustomName && !existingHasCustomName)) {
            duplicateIdsToDelete.push(existing.id);
            seenCleanMacs.set(cleanMac, c);
          } else {
            duplicateIdsToDelete.push(c.id);
          }
        }
      }

      if (duplicateIdsToDelete.length > 0) {
        prisma.node.deleteMany({
          where: { id: { in: duplicateIdsToDelete } }
        }).catch(() => {});
      }

      const deduplicatedControllers = Array.from(seenCleanMacs.values());

      const mapped = deduplicatedControllers.map(c => {
        const isRecentlySeen = c.lastSeen ? (Date.now() - new Date(c.lastSeen).getTime() < 120000) : false;
        const isOnline = (c.status?.toLowerCase() === 'online' || c.status?.toLowerCase() === 'active') || isRecentlySeen;
        return {
          id: c.id,
          name: c.name ? c.name.trim() : (c.mac || `ESP32-${c.id.substring(0, 6)}`),
          mac: c.mac,
          macAddress: c.mac,
          ip: c.ip || 'غير معروف',
          ipAddress: c.ip || 'غير معروف',
          firmware: c.firmware || 'v3.0.0',
          status: isOnline ? 'online' : 'offline',
          deviceCount: c._count?.devices || 0
        };
      });
      return reply.send(mapped);
    } catch (e) {
      server.log.error(e);
      return reply.send([]);
    }
  });

  server.post('/', async (req, reply) => {
    try {
      const data = createControllerSchema.parse(req.body);
      
      const existing = await prisma.node.findUnique({ where: { mac: data.macAddress } });
      if (existing) {
        return reply.status(400).send({ message: 'عنوان MAC مسجل مسبقاً' });
      }

      const controller = await prisma.node.create({
        data: {
          name: data.name,
          mac: data.macAddress,
          ip: data.ipAddress,
          status: 'online',
          homeId: req.tenant.homeId // Associate with tenant
        }
      });

      const createMsg = `تمت إضافة متحكم جديد: ${controller.name || controller.mac}`;
      await prisma.auditLog.create({
        data: {
          homeId: req.tenant.homeId,
          userId: req.tenant.userId,
          action: createMsg,
          resource: `متحكم جديد`,
          resourceId: controller.id,
          severity: 'INFO'
        }
      }).catch(console.error);

      if (server.io) {
        server.io.to(`home:${req.tenant.homeId}`).emit('activity_log', {
          id: `log_usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          message: createMsg,
          details: `عنوان MAC: ${controller.mac}`,
          timestamp: new Date().toISOString(),
          type: 'SYSTEM'
        });
      }
      return reply.status(201).send({
        id: controller.id,
        name: controller.name,
        macAddress: controller.mac,
        ipAddress: controller.ip,
        status: 'online'
      });
    } catch (error: any) {
      return reply.status(400).send({ message: (error.errors && error.errors.length > 0) ? error.errors[0].message : ((error.issues && error.issues.length > 0) ? error.issues[0].message : (error.message || 'بيانات غير صالحة')) });
    }
  });

  server.delete('/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const homeId = req.tenant?.homeId;

      const node = await prisma.node.findFirst({
        where: {
          OR: [
            { id },
            { mac: id },
            { id: `MosaNode_${id.replace(/:/g, '')}` },
            { mac: `MosaNode_${id.replace(/:/g, '')}` }
          ]
        }
      });

      if (!node) {
        return reply.status(404).send({ message: 'المتحكم غير موجود' });
      }

      // 1. Permanently delete all related dependent records for devices of this node
      const nodeDevices = await prisma.device.findMany({
        where: { nodeId: node.id },
        select: { id: true, pin: true }
      });

      const devIds = nodeDevices.map(d => d.id);
      if (devIds.length > 0) {
        await prisma.floorPlanDevice.deleteMany({ where: { deviceId: { in: devIds } } }).catch(() => {});
        await prisma.energyLog.deleteMany({ where: { deviceId: { in: devIds } } }).catch(() => {});
        await prisma.motionLog.deleteMany({ where: { deviceId: { in: devIds } } }).catch(() => {});
        await prisma.climateLog.deleteMany({ where: { deviceId: { in: devIds } } }).catch(() => {});
        await prisma.devicePermission.deleteMany({ where: { deviceId: { in: devIds } } }).catch(() => {});
        await prisma.deviceCredential.deleteMany({ where: { deviceId: { in: devIds } } }).catch(() => {});
        await prisma.device.deleteMany({ where: { id: { in: devIds } } }).catch(() => {});
      }

      // 2. Permanently delete the node
      await prisma.node.delete({ where: { id: node.id } });

      const deleteMsg = `تم حذف المتحكم: ${node.name || node.mac}`;
      await prisma.auditLog.create({
        data: {
          homeId: homeId || 'home-1',
          userId: req.tenant?.userId || 'system',
          action: deleteMsg,
          resource: `حذف متحكم`,
          resourceId: node.id,
          severity: 'WARNING'
        }
      }).catch(console.error);

      if (server.io && homeId) {
        server.io.to(`home:${homeId}`).emit('activity_log', {
          id: `log_usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          message: deleteMsg,
          details: `عنوان MAC: ${node.mac}`,
          timestamp: new Date().toISOString(),
          type: 'SYSTEM'
        });
      }

      // 3. Clean up DiscoveredDevice table so it doesn't get instantly ghost-revived
      const macVariants = getMacVariants(node.mac);
      await prisma.discoveredDevice.deleteMany({
        where: {
          OR: [
            { id: node.id },
            { macAddress: node.mac },
            ...macVariants.map(v => ({ macAddress: v })),
            ...macVariants.map(v => ({ id: v }))
          ]
        }
      }).catch(() => {});

      // 4. Send MQTT command to reset or clear node
      try {
        const targetHome = node.homeId || homeId || 'c55f83aa-2a04-493b-9301-a29a978d9be5';
        const commandTopic = `mosa/${targetHome}/device/${node.mac}/command`;
        server.mqtt?.publish(commandTopic, JSON.stringify({
          action: 'RESET_NVS',
          cmd: 'RESET_NVS',
          boardId: node.mac,
          timestamp: Date.now()
        }), { retain: false });
      } catch (_) {}

      return reply.status(200).send({ success: true, message: 'تم حذف المتحكم نهائياً' });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ message: error.message || 'فشل في حذف المتحكم' });
    }
  });

  server.post('/:id/factory-reset', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const homeId = req.tenant.homeId;
      const controller = await prisma.node.findUnique({ where: { id, homeId } });
      if (!controller) return reply.status(404).send({ message: 'المتحكم غير موجود' });

      // Send Factory Reset Command to the specific Node
      const mqttTopic = `mosa/${controller.homeId}/device/${id}/command`;
      const payload = {
        action: 'FACTORY_RESET',
        issuer: 'SYSTEM_ADMIN',
        timestamp: Date.now()
      };
      
      server.mqtt.publish(mqttTopic, JSON.stringify(payload), { retain: false });
      
      return reply.send({ success: true, message: 'تم إرسال أمر ضبط المصنع' });
    } catch (error) {
      return reply.status(500).send({ message: 'فشل في إرسال أمر ضبط المصنع' });
    }
  });

  server.post('/:id/restart', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const homeId = req.tenant?.homeId;
      const controller = await prisma.node.findFirst({
        where: {
          OR: [{ id }, { mac: id }],
          ...(homeId ? { homeId } : {})
        }
      });
      if (!controller) return reply.status(404).send({ message: 'المتحكم غير موجود' });

      // Update Node status to offline in DB
      await prisma.node.update({
        where: { id: controller.id },
        data: { status: 'offline' }
      });

      // Broadcast board_status_change via Socket.io
      const targetHome = controller.homeId || homeId || 'home-1';
      server.io.emit('board_status_change', { boardId: controller.id, online: false });
      server.io.to(`home:${targetHome}`).emit('board_status_change', { boardId: controller.id, online: false });

      // Send RESTART/SLEEP MQTT Command
      const mqttTopic = `mosa/${targetHome}/device/${controller.id}/command`;
      const payload = { action: 'RESTART', type: 'restart', timestamp: Date.now() };
      server.mqtt.publish(mqttTopic, JSON.stringify(payload), { retain: false });

      return reply.send({ success: true, message: 'تم إرسال أمر إيقاف وإعادة تشغيل المتحكم' });
    } catch (error) {
      return reply.status(500).send({ message: 'فشل في إرسال أمر إعادة تشغيل المتحكم' });
    }
  });

  server.post('/:id/ping', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const homeId = req.tenant.homeId;
      const controller = await prisma.node.findUnique({ where: { id, homeId } });
      if (!controller) return reply.status(404).send({ message: 'المتحكم غير موجود' });

      // Action: reconnect
      const mqttTopic = `mosa/controller/${controller.mac}/ping`;
      const payload = { action: 'reconnect' };
      
      server.mqtt.publish(mqttTopic, JSON.stringify(payload), { retain: false });
      
      return reply.send({ success: true, message: 'تم إرسال طلب إعادة الاتصال' });
    } catch (error) {
      return reply.status(500).send({ message: 'فشل في إرسال طلب إعادة الاتصال' });
    }
  });

  // Setup/Activate pending discovered Zigbee nodes
  server.post('/:id/setup', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const homeId = req.tenant.homeId;
      const { name, roomId, type } = req.body as { name: string; roomId: string; type: string };

      const node = await prisma.node.findFirst({
        where: {
          id,
          OR: [
            { homeId },
            { homeId: null }
          ]
        }
      });
      if (!node) return reply.status(404).send({ message: 'المتحكم غير موجود' });

      // Update Node and claim ownership under current tenant
      await prisma.node.update({
        where: { id: node.id },
        data: {
          name,
          homeId,
          status: 'online'
        }
      });

      // Check if device already exists for this node, or create a new one
      let device = await prisma.device.findFirst({
        where: { nodeId: node.id, homeId }
      });

      if (device) {
        device = await prisma.device.update({
          where: { id: device.id },
          data: {
            name,
            roomId: roomId || null,
            type: (type || device.type || 'switch').toLowerCase()
          }
        });
      } else {
        device = await prisma.device.create({
          data: {
            nodeId: node.id,
            homeId,
            roomId: roomId || null,
            name,
            type: (type || 'switch').toLowerCase(),
            state: { isOn: false, value: 0 }
          }
        });
      }

      const setupMsg = `تم إعداد جهاز مكتشف: ${device.name}`;
      await prisma.auditLog.create({
        data: {
          homeId,
          userId: req.tenant.userId,
          action: setupMsg,
          resource: `إعداد جهاز`,
          resourceId: device.id,
          severity: 'INFO'
        }
      }).catch(console.error);

      if (server.io) {
        server.io.to(`home:${homeId}`).emit('activity_log', {
          id: `log_usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          message: setupMsg,
          details: `تم الإضافة من الأجهزة المكتشفة`,
          timestamp: new Date().toISOString(),
          type: 'SYSTEM'
        });
      }

      return reply.send({ success: true, device });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ message: 'فشل إعداد وحفظ الجهاز' });
    }
  });

  // 🔐 OTA Certificate Renewal for ESP32 Physical Node
  server.post('/:id/renew-cert', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const homeId = request.tenant?.homeId || 'home-1';

      const node = await prisma.node.findUnique({
        where: { id }
      });
      if (!node) {
        return reply.status(404).send({ message: 'اللوحة غير موجودة' });
      }

      const certsDir = fs.existsSync('/app/certs')
        ? '/app/certs'
        : fs.existsSync(path.resolve(process.cwd(), 'config', 'certs'))
          ? path.resolve(process.cwd(), 'config', 'certs')
          : path.resolve(process.cwd(), '..', '..', 'config', 'certs');

      const caFile = path.join(certsDir, 'ca_chain.crt');
      const caPem = fs.existsSync(caFile) ? fs.readFileSync(caFile, 'utf-8') : (fs.existsSync(path.join(certsDir, 'ca.crt')) ? fs.readFileSync(path.join(certsDir, 'ca.crt'), 'utf-8') : '');

      const cleanMac = (node.mac || node.name || node.id).replace(/^MosaNode_/i, '').replace(/[:-]/g, '').toUpperCase();
      const nodeName = `MosaNode_${cleanMac}`;

      let certPem = '';
      let keyPem = '';

      const specificCert = path.join(certsDir, `${nodeName}.crt`);
      const specificKey = path.join(certsDir, `${nodeName}.key`);

      if (fs.existsSync(specificCert) && fs.existsSync(specificKey)) {
        certPem = fs.readFileSync(specificCert, 'utf-8');
        keyPem = fs.readFileSync(specificKey, 'utf-8');
      } else {
        const defCert = path.join(certsDir, 'device-001.crt');
        const defKey = path.join(certsDir, 'device-001.key');
        if (fs.existsSync(defCert) && fs.existsSync(defKey)) {
          certPem = fs.readFileSync(defCert, 'utf-8');
          keyPem = fs.readFileSync(defKey, 'utf-8');
        }
      }

      if (!caPem || !certPem || !keyPem) {
        return reply.status(500).send({ message: 'ملفات الشهادات غير متوفرة في مسار السيرفر' });
      }

      // Publish RENEW_CERT MQTT Command directly to node
      const topic = `mosa/${homeId}/device/${nodeName}/command`;
      const payload = {
        action: 'RENEW_CERT',
        ca: caPem,
        cert: certPem,
        key: keyPem,
        timestamp: Date.now()
      };

      if ((server as any).mqtt?.client?.connected) {
        (server as any).mqtt.client.publish(topic, JSON.stringify(payload), { qos: 1 });
      }

      return reply.send({
        success: true,
        message: `تم إرسال أمر تجديد الشهادات هوائياً إلى اللوحة ${nodeName}. ستقوم اللوحة بتثبيت الشهادات وإعادة الاتصال بمفتاح جديد.`
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ message: error.message || 'فشل تجديد الشهادة هوائياً' });
    }
  });
}
