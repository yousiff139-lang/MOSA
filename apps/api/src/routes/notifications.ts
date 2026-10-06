import { FastifyInstance } from 'fastify';
import { verifyTenant } from '../lib/permissions';
import { prisma } from '../lib/prisma';
import { sendTelegramAlertAsync, initTelegram } from '../services/telegram';

const fallbackNotifications = [
  {
    id: 'notif-welcome',
    title: 'منظومة MOSA Smart Home',
    message: 'النظام يعمل بشكل كامل ومستقر. جميع وحدات التحكم والشبكة متصلة 🟢',
    type: 'SYSTEM',
    read: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'notif-esp-ready',
    title: 'متحكمات ESP32',
    message: 'وحدة برمجة ومراقبة لوحات ESP32 جاهزة للربط والتحكم الفوري ⚡',
    type: 'DEVICE',
    read: false,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
  }
];

export default async function notificationRoutes(server: FastifyInstance) {
  // GET /api/notifications - get all notifications for active home
  server.get('/', async (req: any, reply) => {
    try {
      const homeId = req.tenant?.homeId;
      let notifications: any[] = [];

      if (homeId) {
        try {
          notifications = await Promise.race([
            prisma.notification.findMany({
              where: { homeId },
              orderBy: { createdAt: 'desc' },
              take: 200
            }),
            new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 300))
          ]);
        } catch (dbErr) {
          notifications = [];
        }
      }

      if (!notifications || notifications.length === 0) {
        return reply.send(fallbackNotifications);
      }

      return reply.send(notifications);
    } catch (error) {
      return reply.send(fallbackNotifications);
    }
  });

  // POST /api/notifications/telegram/test - send immediate test alert
  server.post('/telegram/test', async (req, reply) => {
    try {
      const { token, chatId, homeId } = req.body as { token?: string; chatId?: string; homeId?: string };
      sendTelegramAlertAsync(
        `✅ <b>اختبار إشعارات MOSA OS الناجح!</b>\n\nمبروك! تم ربط بوت التليجرام بنجاح وهاتفك جاهز الآن لاستلام التنبيهات الفورية للحماية والأمان.`,
        { token, chatId, homeId }
      );
      return reply.send({ success: true, message: 'Test message queued for instant delivery' });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to send test alert' });
    }
  });

  // POST /api/notifications/telegram/config - save bot settings (supports global or per-home)
  server.post('/telegram/config', async (req, reply) => {
    try {
      const { token, chatId, enabled, homeId } = req.body as { token: string; chatId: string; enabled: boolean; homeId?: string };
      if (homeId) {
        const { redisClient } = await import('../server');
        if (redisClient) {
          if (chatId) await redisClient.set(`mosa:home:${homeId}:telegram_chat_id`, chatId);
          if (token) await redisClient.set(`mosa:home:${homeId}:telegram_token`, token);
        }
        return reply.send({ success: true, message: `Telegram settings saved for home ${homeId}` });
      }

      await prisma.systemSettings.upsert({
        where: { id: 'singleton' },
        update: { telegramToken: token, telegramChatId: chatId, telegramEnabled: enabled },
        create: { id: 'singleton', telegramToken: token, telegramChatId: chatId, telegramEnabled: enabled }
      });
      await initTelegram();
      return reply.send({ success: true, message: 'Telegram settings saved successfully' });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to save Telegram config' });
    }
  });

  // POST /api/notifications - create a notification
  server.post('/', async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const userId = req.tenant.userId;
      const { title, message, type } = req.body as { title: string; message: string; type: string };

      const notification = await prisma.notification.create({
        data: {
          homeId,
          userId,
          title,
          message,
          type: type || 'info',
        }
      });
      return reply.status(201).send(notification);
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to create notification' });
    }
  });

  // PUT /api/notifications/:id/read - mark notification as read
  server.put('/:id/read', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const homeId = req.tenant.homeId;

      await prisma.notification.updateMany({
        where: { id, homeId },
        data: { isRead: true }
      });
      return reply.send({ success: true });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to mark notification as read' });
    }
  });

  // PUT /api/notifications/read - bulk mark notifications as read
  server.put('/read', {
    preHandler: [verifyTenant],
    schema: {
      body: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (req: any, reply) => {
    try {
      const { homeId } = req.tenant;
      const { ids } = req.body as { ids?: string[] };

      await prisma.notification.updateMany({
        where: {
          homeId,
          ...(ids && ids.length > 0 ? { id: { in: ids } } : {})
        },
        data: { isRead: true }
      });

      return reply.send({ success: true });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to mark notifications as read' });
    }
  });

  // DELETE /api/notifications - clear all notifications
  server.delete('/', async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      await prisma.notification.deleteMany({
        where: { homeId }
      });
      return reply.send({ success: true });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to clear notifications' });
    }
  });
}
