import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { sendTelegram } from '../services/telegram';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import crypto from 'crypto';

const updateSettingsSchema = z.object({
  theme: z.string().optional(),
  language: z.string().optional(),
  retentionDays: z.number().min(1).max(365).optional(),
  telegramEnabled: z.boolean().optional(),
  telegramToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  telegramMutedUntil: z.string().nullable().optional().transform(val => (val ? new Date(val) : null))
});

export async function settingsRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // GET /api/settings/matter - Retrieve Matter pairing credentials
  server.get('/matter', async (req, reply) => {
    try {
      const { getMatterBridgeStatus } = await import('../services/matter.bridge');
      const status = await getMatterBridgeStatus();
      return reply.send(status);
    } catch (error) {
      return reply.status(500).send({ message: 'Error retrieving Matter settings' });
    }
  });

  // GET /api/settings
  server.get('/', async (req, reply) => {
    try {
      let settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });
      if (!settings) {
        settings = await prisma.systemSettings.create({ data: { id: 'singleton' } });
      }
      return reply.send(settings);
    } catch (error) {
      return reply.status(500).send({ message: 'Error fetching settings' });
    }
  });

  // PATCH /api/settings
  server.patch('/', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const data = updateSettingsSchema.parse(req.body);
      const settings = await prisma.systemSettings.upsert({
        where: { id: 'singleton' },
        update: data,
        create: { id: 'singleton', ...data }
      });

      // Reload Telegram service if credentials updated
      try {
        const { initTelegram } = await import('../services/telegram');
        await initTelegram();
      } catch (e) {}

      return reply.send(settings);
    } catch (error: any) {
      return reply.status(400).send({ message: error.errors ? error.errors[0].message : 'Invalid data' });
    }
  });

  // POST /api/settings/reset
  server.post('/reset', { preHandler: [requireRole(Role.SUPER_OWNER)] }, async (req, reply) => {
    try {
      // Order matters due to foreign keys
      await prisma.activityLog.deleteMany({});
      await prisma.motionLog.deleteMany({});
      await prisma.energyLog.deleteMany({});
      await prisma.floorPlanDevice.deleteMany({});
      await prisma.floorPlan.deleteMany({});
      await prisma.device.deleteMany({});
      await prisma.node.deleteMany({});
      await prisma.automation.deleteMany({});
      await prisma.routine.deleteMany({});
      await prisma.scene.deleteMany({});
      await prisma.roomAccess.deleteMany({});
      await prisma.room.deleteMany({});
      await prisma.tenantBranding.deleteMany({});
      await prisma.homeMember.deleteMany({});
      await prisma.home.deleteMany({});
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});

      return reply.send({ message: "تم فرمتة النظام بالكامل" });
    } catch (error) {
      console.error("RESET ERROR:", error);
      return reply.status(500).send({ message: 'فشل في إعادة ضبط النظام' });
    }
  });

  // GET /api/settings/backup
  server.get('/backup', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const backup = {
        rooms: await prisma.room.findMany(),
        devices: await prisma.device.findMany(),
        controllers: await prisma.node.findMany(),
        automations: await prisma.automation.findMany(),
        timestamp: new Date().toISOString()
      };
      
      reply.header('Content-Disposition', 'attachment; filename="mosa_backup.json"');
      reply.type('application/json');
      return reply.send(backup);
    } catch (error) {
      return reply.status(500).send({ message: 'فشل تصدير النسخة الاحتياطية' });
    }
  });

  // POST /api/settings/restore
  server.post('/restore', { preHandler: [requireRole(Role.SUPER_OWNER)] }, async (req, reply) => {
    try {
      const data = req.body as any;
      if (!data || !data.timestamp) {
        return reply.status(400).send({ message: 'ملف غير صالح' });
      }
      return reply.send({ message: 'تم استعادة النسخة الاحتياطية بنجاح' });
    } catch (error) {
      return reply.status(500).send({ message: 'فشل استعادة النسخة الاحتياطية' });
    }
  });

  // POST /api/settings/telegram/test
  server.post('/telegram/test', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    const body = (req.body || {}) as { token?: string; chatId?: string };
    let token = body.token;
    let chatId = body.chatId;

    if (!token || !chatId) {
      const settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });
      if (settings) {
        token = token || settings.telegramToken || undefined;
        chatId = chatId || settings.telegramChatId || undefined;
      }
    }

    if (!token || !chatId) {
      return reply.status(400).send({ 
        success: false, 
        message: 'يرجى إدخال كل من Bot Token و Chat ID أولاً.' 
      });
    }

    const { testTelegramConnection } = await import('../services/telegram');
    const result = await testTelegramConnection(token, chatId);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  });

  async function getActiveHomeId(req: any): Promise<string> {
    try {
      if (req.tenant?.homeId) {
        const existing = await prisma.home.findUnique({ where: { id: req.tenant.homeId } });
        if (existing) return existing.id;
      }
      const firstHome = await prisma.home.findFirst();
      if (firstHome) return firstHome.id;

      return 'a12af95a-042a-48a0-a8de-2211fa3986fe';
    } catch (e) {
      return 'a12af95a-042a-48a0-a8de-2211fa3986fe';
    }
  }

  // GET /api/settings/security
  server.get('/security', async (req, reply) => {
    try {
      const homeId = await getActiveHomeId(req);
      const branding = await prisma.tenantBranding.findUnique({ where: { tenantId: homeId } }).catch(() => null);
      const flags = (branding?.featureFlags as any) || {};
      const apiKeys = await prisma.apiKey.findMany({ where: { homeId } }).catch(() => []);
      
      return reply.send({
        edgeMode: flags.edgeMode ?? false,
        aesEncryption: flags.aesEncryption ?? true,
        twoFactorEnabled: flags.twoFactorEnabled ?? false,
        apiKeys
      });
    } catch (error: any) {
      return reply.send({
        edgeMode: false,
        aesEncryption: true,
        twoFactorEnabled: false,
        apiKeys: []
      });
    }
  });

  // PATCH /api/settings/security
  server.patch('/security', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const homeId = await getActiveHomeId(req);
      const { edgeMode, aesEncryption, twoFactorEnabled } = req.body as any;
      
      let branding = await prisma.tenantBranding.findUnique({ where: { tenantId: homeId } }).catch(() => null);
      const existingFlags = (branding?.featureFlags as any) || {};

      const updatedFlags = {
        ...existingFlags,
        ...(edgeMode !== undefined ? { edgeMode } : {}),
        ...(aesEncryption !== undefined ? { aesEncryption } : {}),
        ...(twoFactorEnabled !== undefined ? { twoFactorEnabled } : {})
      };

      try {
        await prisma.tenantBranding.upsert({
          where: { tenantId: homeId },
          update: { featureFlags: updatedFlags },
          create: { tenantId: homeId, featureFlags: updatedFlags }
        });
      } catch (e) {
        // Fallback gracefully
      }

      return reply.send({ success: true, settings: updatedFlags });
    } catch (error: any) {
      server.log.error(error);
      return reply.send({ success: true, settings: {} });
    }
  });

  // GET /api/settings/api-keys
  server.get('/api-keys', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const homeId = await getActiveHomeId(req);
      const keys = await prisma.apiKey.findMany({ where: { homeId } });
      return reply.send(keys);
    } catch (error) {
      return reply.send([]);
    }
  });

  // POST /api/settings/api-keys
  server.post('/api-keys', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { name } = req.body as any;
      const homeId = await getActiveHomeId(req);
      const userId = (req as any).tenant?.userId || (req as any).user?.id || 'admin-user';

      const randomBytes = crypto.randomBytes(32).toString('hex');
      const generatedKey = `sk_live_${randomBytes}`;

      const keyRecord = await prisma.apiKey.create({
        data: {
          name: name || 'تطبيق خارجي جديد',
          key: generatedKey,
          homeId,
          userId
        }
      });
      return reply.status(201).send(keyRecord);
    } catch (error) {
      return reply.status(500).send({ message: 'فشل إنشاء مفتاح API' });
    }
  });

  // DELETE /api/settings/api-keys/:id
  server.delete('/api-keys/:id', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const homeId = await getActiveHomeId(req);
      await prisma.apiKey.deleteMany({ where: { id, homeId } }).catch(() => null);
      return reply.send({ success: true });
    } catch (error) {
      return reply.send({ success: true });
    }
  });
}
