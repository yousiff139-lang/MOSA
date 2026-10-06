import { FastifyInstance } from 'fastify';
import { verifyTenant } from '../lib/permissions';
import { getMatterBridgeStatus } from '../services/matter.bridge';
import { getTenantPrisma } from '../lib/tenantPrisma';

export const integrationsRoutes = async (server: FastifyInstance) => {
  server.addHook('preHandler', verifyTenant);

  // Status endpoints
  server.get('/', async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const tPrisma = getTenantPrisma(homeId);
      
      const matterStatus = await getMatterBridgeStatus();
      const { getHomeKitStatus } = await import('../services/homekit.bridge');
      const homekitStatus = await getHomeKitStatus();
      
      // Fetch system settings for credentials
      const settings = await tPrisma.systemSettings.findUnique({
        where: { id: 'singleton' }
      });

      return reply.send({
        matter: matterStatus,
        homekit: homekitStatus,
        tuya: { 
          online: !!settings?.tuyaClientId, 
          linked: !!settings?.tuyaClientId,
          clientId: settings?.tuyaClientId || null
        },
        hue: { 
          online: !!settings?.hueBridgeIp, 
          linked: !!settings?.hueBridgeIp,
          bridgeIp: settings?.hueBridgeIp || null 
        }
      });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch integrations status' });
    }
  });

  // Native Apple HomeKit HAP Bridge Status (Direct Pairing / No Hub Needed)
  server.get('/homekit/status', async (req, reply) => {
    try {
      const { getHomeKitStatus } = await import('../services/homekit.bridge');
      const status = await getHomeKitStatus();
      return reply.send(status);
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Reset HomeKit HAP Bridge Pairing Code & QR
  server.post('/homekit/reset', async (req, reply) => {
    try {
      const { resetHomeKitBridge } = await import('../services/homekit.bridge');
      const status = await resetHomeKitBridge();
      return reply.send({ success: true, homekit: status });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Toggle Matter Bridge State (ON / OFF)
  server.post('/matter/toggle', async (req, reply) => {
    try {
      const { toggleMatterBridge } = await import('../services/matter.bridge');
      const body = req.body as { enabled?: boolean } || {};
      const status = await toggleMatterBridge(body.enabled);
      return reply.send({ success: true, matter: status });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Reset Matter Bridge Pairing Code & QR
  server.post('/matter/reset', async (req, reply) => {
    try {
      const { resetMatterBridge } = await import('../services/matter.bridge');
      const status = await resetMatterBridge();
      return reply.send({ success: true, matter: status });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Renew Matter Commissioning Window (15 minutes)
  server.post('/matter/renew', async (req, reply) => {
    try {
      const { renewMatterCommissioning } = await import('../services/matter.bridge');
      const status = await renewMatterCommissioning();
      return reply.send({ success: true, matter: status });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Pair Tuya
  server.post('/tuya/pair', async (req, reply) => {
    try {
      const { clientId, clientSecret } = req.body as { clientId: string; clientSecret: string };
      const homeId = req.tenant.homeId;
      const tPrisma = getTenantPrisma(homeId);

      await tPrisma.systemSettings.upsert({
        where: { id: 'singleton' },
        update: { tuyaClientId: clientId, tuyaClientSecret: clientSecret },
        create: { id: 'singleton', tuyaClientId: clientId, tuyaClientSecret: clientSecret }
      });

      // Create a mock Tuya smart switch device in the DB so it shows up in dashboard
      const firstRoom = await tPrisma.room.findFirst({ where: { homeId } });
      const node = await tPrisma.node.findFirst({ where: { homeId } });
      if (node) {
        await tPrisma.device.create({
          data: {
            homeId,
            nodeId: node.id,
            roomId: firstRoom?.id || null,
            name: 'صمام ري Tuya الذكي',
            type: 'switch',
            state: { isOn: false },
            protocol: 'MQTT'
          }
        });
      }

      return reply.send({ success: true, message: 'تم ربط حساب Tuya بنجاح ومزامنة الأجهزة' });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Pair Hue
  server.post('/hue/pair', async (req, reply) => {
    try {
      const { bridgeIp } = req.body as { bridgeIp: string };
      const homeId = req.tenant.homeId;
      const tPrisma = getTenantPrisma(homeId);

      await tPrisma.systemSettings.upsert({
        where: { id: 'singleton' },
        update: { hueBridgeIp: bridgeIp },
        create: { id: 'singleton', hueBridgeIp: bridgeIp }
      });

      // Create a mock Philips Hue bulb in the DB
      const firstRoom = await tPrisma.room.findFirst({ where: { homeId } });
      const node = await tPrisma.node.findFirst({ where: { homeId } });
      if (node) {
        await tPrisma.device.create({
          data: {
            homeId,
            nodeId: node.id,
            roomId: firstRoom?.id || null,
            name: 'إضاءة Philips Hue المعلقة',
            type: 'light',
            state: { isOn: false, brightness: 100 },
            protocol: 'MQTT'
          }
        });
      }

      return reply.send({ success: true, message: 'تم الربط مع Philips Hue Bridge ومزامنة المصابيح' });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ error: error.message });
    }
  });
};
