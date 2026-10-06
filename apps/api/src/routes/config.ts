import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { verifyTenant, requireRole, Role } from '../lib/permissions';

export async function configRoutes(server: FastifyInstance) {
  // GET /api/config/runtime
  server.get('/runtime', async (req, reply) => {
    let homeId = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        const decoded = req.server.jwt.verify<any>(token);
        homeId = decoded.activeHomeId || decoded.homeId;
      }
    } catch (e) {}

    if (!homeId) {
      return reply.send({ translations: {}, uiConfig: {}, featureFlags: {} });
    }

    const branding = await prisma.tenantBranding.findUnique({
      where: { tenantId: homeId }
    });

    if (!branding) {
      return reply.send({
        translations: {},
        uiConfig: {},
        featureFlags: {}
      });
    }

    return reply.send({
      translations: branding.translations || {},
      uiConfig: branding.uiConfig || {},
      featureFlags: branding.featureFlags || {}
    });
  });

  // PATCH /api/config/runtime
  server.patch('/runtime', { preHandler: [verifyTenant, requireRole(Role.ADMIN)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;
    const { translations, uiConfig, featureFlags } = req.body as any;

    const updateData: any = {};
    if (translations !== undefined) updateData.translations = translations;
    if (uiConfig !== undefined) updateData.uiConfig = uiConfig;
    if (featureFlags !== undefined) updateData.featureFlags = featureFlags;

    const updated = await prisma.tenantBranding.upsert({
      where: { tenantId: homeId },
      update: updateData,
      create: {
        tenantId: homeId,
        ...updateData
      }
    });

    server.io.to(`home:${homeId}`).emit('runtime.update', {
      translations: updated.translations,
      uiConfig: updated.uiConfig,
      featureFlags: updated.featureFlags
    });

    return reply.send({ success: true });
  });

  // GET /api/config/backup
  server.get('/backup', { preHandler: [verifyTenant, requireRole(Role.ADMIN)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;

    const rooms = await prisma.room.findMany({ where: { homeId } });
    const nodes = await prisma.node.findMany({ where: { homeId, deletedAt: null } });
    const devices = await prisma.device.findMany({ where: { homeId, deletedAt: null } });
    const automations = await prisma.automation.findMany({ where: { homeId, deletedAt: null } });
    const branding = await prisma.tenantBranding.findUnique({ where: { tenantId: homeId } });

    const backupPayload = {
      version: '2.0',
      timestamp: Date.now(),
      dateFormatted: new Date().toLocaleDateString('ar-EG'),
      stats: {
        roomsCount: rooms.length,
        nodesCount: nodes.length,
        devicesCount: devices.length,
        automationsCount: automations.length
      },
      homeId,
      rooms,
      nodes,
      devices,
      automations,
      branding
    };

    const filename = `mosa_backup_${new Date().toISOString().split('T')[0]}.json`;
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(backupPayload);
  });

  // POST /api/config/restore
  server.post('/restore', { preHandler: [verifyTenant, requireRole(Role.ADMIN)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;
    const { rooms, nodes, devices, automations, branding } = req.body as any;

    if (!Array.isArray(rooms) || !Array.isArray(devices) || !Array.isArray(automations)) {
      return reply.status(400).send({ error: 'ملف النسخة الاحتياطية غير صالح' });
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Wipe existing rules, devices, nodes, and rooms associated with the homeId
        await tx.automation.deleteMany({ where: { homeId } });
        await tx.device.deleteMany({ where: { homeId } });
        await tx.node.deleteMany({ where: { homeId } });
        await tx.room.deleteMany({ where: { homeId } });

        // 2. Restore rooms
        for (const r of rooms) {
          await tx.room.create({
            data: {
              id: r.id,
              name: r.name,
              homeId
            }
          });
        }

        // 3. Restore Nodes (ESP32 controllers)
        const nodesList = Array.isArray(nodes) ? nodes : [];
        for (const n of nodesList) {
          await tx.node.create({
            data: {
              id: n.id,
              mac: n.mac,
              name: n.name,
              ip: n.ip,
              firmware: n.firmware,
              status: n.status || 'offline',
              protocol: n.protocol || 'WIFI',
              battery: n.battery,
              homeId
            }
          });
        }

        // 4. Restore devices
        for (const d of devices) {
          // Verify node relation exists or create fallback node to prevent constraint crashes
          const nodeExists = nodesList.some(n => n.id === d.nodeId) || (await tx.node.findUnique({ where: { id: d.nodeId } }));
          if (!nodeExists) {
            await tx.node.create({
              data: {
                id: d.nodeId,
                mac: `sim-mac-${d.nodeId}`,
                name: 'Fallback Node',
                status: 'offline',
                homeId
              }
            });
          }

          await tx.device.create({
            data: {
              id: d.id,
              nodeId: d.nodeId,
              roomId: d.roomId,
              type: d.type,
              name: d.name,
              state: d.state || {},
              pin: d.pin,
              ipAddress: d.ipAddress,
              protocol: d.protocol || 'MQTT',
              capabilities: d.capabilities || [],
              homeId
            }
          });
        }

        // 5. Restore automations
        for (const a of automations) {
          await tx.automation.create({
            data: {
              id: a.id,
              name: a.name,
              condition: a.condition || {},
              action: a.action || {},
              flowData: a.flowData || {},
              isActive: a.isActive ?? true,
              homeId
            }
          });
        }

        // 6. Restore branding
        if (branding) {
          await tx.tenantBranding.upsert({
            where: { tenantId: homeId },
            update: {
              translations: branding.translations,
              uiConfig: branding.uiConfig,
              featureFlags: branding.featureFlags
            },
            create: {
              tenantId: homeId,
              translations: branding.translations,
              uiConfig: branding.uiConfig,
              featureFlags: branding.featureFlags
            }
          });
        }
      });

      // Hot-reload websocket notify
      server.io.to(`home:${homeId}`).emit('reload.system', { success: true });

      return reply.send({ success: true });
    } catch (e: any) {
      server.log.error(e);
      return reply.status(500).send({ error: e.message || 'فشلت عملية استعادة النسخة الاحتياطية' });
    }
  });
}
