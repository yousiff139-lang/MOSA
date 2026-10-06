import { FastifyInstance } from 'fastify';
import webpush from 'web-push';
import { prisma } from '../lib/prisma';
import { verifyTenant } from '../lib/permissions';
import { env } from '../config/env';

// To generate real VAPID keys for production, run: `npx web-push generate-vapid-keys`
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'public_key_placeholder';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'private_key_placeholder';

try {
  webpush.setVapidDetails(
    'mailto:admin@mosa.local',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (e) {
  console.warn('Push Notifications disabled: Invalid VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment.');
}

export const pushRoutes = async (server: FastifyInstance) => {
  
  // Public Key Route
  server.get('/vapidPublicKey', async (req, reply) => {
    return reply.send({ publicKey: VAPID_PUBLIC_KEY });
  });

  server.addHook('preHandler', verifyTenant);

  // Subscribe to Push
  server.post('/subscribe', async (req, reply) => {
    try {
      const subscription = req.body as any;
      const userId = req.tenant.userId;

      // Ensure user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.status(404).send({ error: 'User not found' });

      // Save to database
      await (prisma as any).pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        create: {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userId: userId
        },
        update: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userId: userId
        }
      });

      // Send a welcome notification
      const payload = JSON.stringify({
        title: 'تم التفعيل بنجاح! 🔔',
        body: 'أنت الآن متصل بنظام MOSA الذكي لتلقي الإشعارات الفورية.',
        icon: '/icons/icon-192x192.png'
      });

      // Ignore error if it fails (bad private key in dev)
      webpush.sendNotification(subscription, payload).catch(err => server.log.error(err));

      return reply.send({ success: true });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to subscribe to push notifications' });
    }
  });

  // Get notifications
  server.get('/', async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      
      // Clean up any legacy placeholder notifications
      await prisma.notification.deleteMany({
        where: {
          OR: [
            { title: 'أمر جديد' },
            { message: { contains: 'toggle' } }
          ]
        }
      }).catch(() => null);

      // Fetch real notifications from database for this home
      const dbNotifs = await prisma.notification.findMany({
        where: { homeId },
        orderBy: { createdAt: 'desc' },
        take: 200
      }).catch(() => []);

      const formatted = dbNotifs.map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: (n.type || 'INFO').toUpperCase(),
        read: Boolean(n.isRead),
        timestamp: n.createdAt
      }));

      return reply.send(formatted);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch notifications' });
    }
  });

  // Mark as read
  server.post('/markRead', async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      await prisma.notification.updateMany({
        where: { homeId, isRead: false },
        data: { isRead: true }
      }).catch(() => {});
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to mark notifications' });
    }
  });
};
