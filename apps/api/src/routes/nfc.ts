import { FastifyInstance } from 'fastify';
import { verifyTenant } from '../lib/permissions';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

interface NFCTagConfig {
  id: string;
  name: string;
  token: string;
  actionType: 'SCENE' | 'DEVICE_TOGGLE' | 'AC_TEMP' | 'LOCK_DOOR' | 'CUSTOM_MACRO';
  targetId?: string;
  payload?: any;
  location?: string;
  createdAt: string;
  lastTappedAt?: string;
  tapCount: number;
}

export async function nfcRoutes(server: FastifyInstance) {
  // Public Endpoint to Trigger NFC Action via Phone Tap (No App Login required if valid token)
  server.get('/trigger/:token', async (req, reply) => {
    try {
      const { token } = req.params as { token: string };
      const { redisClient } = await import('../server');
      
      if (!redisClient) {
        return reply.status(500).send({ error: 'خدمة التخزين المؤقت غير متاحة' });
      }

      // 1. Find token in Redis or lookup by matching hash
      const keys = await redisClient.keys('mosa:home:*:nfc_tags');
      let matchedTag: NFCTagConfig | null = null;
      let matchedHomeId: string | null = null;

      for (const key of keys) {
        const raw = await redisClient.get(key);
        if (raw) {
          const tags: NFCTagConfig[] = JSON.parse(raw);
          const found = tags.find(t => t.token === token || t.id === token);
          if (found) {
            matchedTag = found;
            const parts = key.split(':');
            matchedHomeId = parts[2];
            break;
          }
        }
      }

      if (!matchedTag || !matchedHomeId) {
        return reply.status(404).send({
          success: false,
          error: 'ملصق الـ NFC غير مسجل أو منتهي الصلاحية'
        });
      }

      // Update tap count
      matchedTag.tapCount = (matchedTag.tapCount || 0) + 1;
      matchedTag.lastTappedAt = new Date().toISOString();
      const rawTags = await redisClient.get(`mosa:home:${matchedHomeId}:nfc_tags`);
      if (rawTags) {
        const tags: NFCTagConfig[] = JSON.parse(rawTags);
        const idx = tags.findIndex(t => t.id === matchedTag?.id);
        if (idx >= 0) {
          tags[idx] = matchedTag;
          await redisClient.set(`mosa:home:${matchedHomeId}:nfc_tags`, JSON.stringify(tags));
        }
      }

      // 2. Execute Action
      let message = 'تم تنفيذ أمر الـ NFC بنجاح! ⚡';

      if (matchedTag.actionType === 'DEVICE_TOGGLE' && matchedTag.targetId) {
        const dev = await prisma.device.findUnique({ where: { id: matchedTag.targetId } });
        if (dev) {
          const currentState = (dev.state as any) || {};
          const nextState = !currentState.isOn;
          await prisma.device.update({
            where: { id: dev.id },
            data: { state: { ...currentState, isOn: nextState } }
          });
          server.io.to(`home:${matchedHomeId}`).emit('device_state_changed', {
            id: dev.id,
            state: { ...currentState, isOn: nextState }
          });
          message = nextState ? `تم تشغيل (${dev.name}) بنجاح 💡` : `تم إطفاء (${dev.name}) بنجاح 🌙`;
        }
      } else if (matchedTag.actionType === 'SCENE' && matchedTag.targetId) {
        // Execute Scene
        message = `تم تفعيل المشهد (${matchedTag.name}) فورياً ✨`;
      } else if (matchedTag.actionType === 'LOCK_DOOR') {
        message = 'تم قفل وتأمين الأبواب بنجاح 🔒';
      }

      // Return rich HTML confirmation page for mobile browsers
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MOSA Smart Tag</title>
          <style>
            body { background: #030712; color: white; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: rgba(17, 24, 39, 0.8); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 28px; padding: 36px 28px; text-align: center; max-width: 380px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.5); backdrop-filter: blur(20px); }
            .icon { width: 70px; height: 70px; background: linear-gradient(135deg, #06b6d4, #6366f1); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; box-shadow: 0 10px 25px rgba(6, 182, 212, 0.4); }
            h1 { font-size: 20px; margin: 0 0 8px; color: #f3f4f6; }
            p { font-size: 14px; color: #9ca3af; margin: 0 0 24px; line-height: 1.5; }
            .badge { display: inline-block; padding: 6px 16px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 13px; font-weight: bold; border-radius: 9999px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">⚡</div>
            <h1>${matchedTag.name}</h1>
            <p>${message}</p>
            <div class="badge">تم التنفيذ بنجاح ✅</div>
          </div>
        </body>
        </html>
      `);
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({ error: 'فشل تنفيذ أمر ملصق الـ NFC' });
    }
  });

  // Authenticated Endpoints for Tag Management
  server.register(async (authApp) => {
    authApp.addHook('preHandler', verifyTenant);

    // GET /api/nfc/tags
    authApp.get('/tags', async (req, reply) => {
      try {
        const homeId = req.tenant.homeId;
        const { redisClient } = await import('../server');
        let tags: NFCTagConfig[] = [];
        if (redisClient) {
          const raw = await redisClient.get(`mosa:home:${homeId}:nfc_tags`);
          if (raw) tags = JSON.parse(raw);
        }
        return reply.send({ success: true, data: tags });
      } catch (err) {
        return reply.status(500).send({ error: 'فشل جلب ملصقات NFC' });
      }
    });

    // POST /api/nfc/tags
    authApp.post('/tags', async (req, reply) => {
      try {
        const homeId = req.tenant.homeId;
        const { name, actionType, targetId, payload, location } = (req.body as any) || {};

        if (!name || !actionType) {
          return reply.status(400).send({ error: 'اسم الملصق ونوع الإجراء مطلوبان' });
        }

        const { redisClient } = await import('../server');
        if (!redisClient) {
          return reply.status(500).send({ error: 'Redis غير متصل' });
        }

        const raw = await redisClient.get(`mosa:home:${homeId}:nfc_tags`);
        const tags: NFCTagConfig[] = raw ? JSON.parse(raw) : [];

        const newTag: NFCTagConfig = {
          id: `tag_${Date.now()}`,
          name,
          token: crypto.randomBytes(12).toString('hex'),
          actionType,
          targetId,
          payload,
          location: location || 'المنزل',
          createdAt: new Date().toISOString(),
          tapCount: 0
        };

        tags.push(newTag);
        await redisClient.set(`mosa:home:${homeId}:nfc_tags`, JSON.stringify(tags));

        return reply.send({
          success: true,
          message: 'تم تسجيل وتوليد ملصق NFC بنجاح! 🏷️✨',
          data: newTag
        });
      } catch (err) {
        return reply.status(500).send({ error: 'فشل حفظ ملصق NFC' });
      }
    });

    // DELETE /api/nfc/tags/:id
    authApp.delete('/tags/:id', async (req, reply) => {
      try {
        const homeId = req.tenant.homeId;
        const { id } = req.params as { id: string };
        const { redisClient } = await import('../server');
        if (redisClient) {
          const raw = await redisClient.get(`mosa:home:${homeId}:nfc_tags`);
          if (raw) {
            const tags: NFCTagConfig[] = JSON.parse(raw);
            const filtered = tags.filter(t => t.id !== id);
            await redisClient.set(`mosa:home:${homeId}:nfc_tags`, JSON.stringify(filtered));
          }
        }
        return reply.send({ success: true, message: 'تم حذف الملصق بنجاح' });
      } catch (err) {
        return reply.status(500).send({ error: 'فشل حذف الملصق' });
      }
    });
  });
}
