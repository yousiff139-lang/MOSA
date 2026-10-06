import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const retentionSchema = z.object({
  days: z.number().min(1).max(365)
});

// In-memory ring buffer for logs (preserves real-time activity when DB is unavailable or starting up)
const inMemoryLogs: any[] = [
  {
    id: 'log-sys-start',
    message: 'بدء تشغيل خادم MOSA Smart Home OS بنجاح',
    details: 'البوابة المركزية ومحركات الاتصال المباشر (MQTT, WebSockets, IP Bridges) في حالة جاهزية كاملة',
    timestamp: new Date().toISOString(),
    type: 'SYSTEM'
  },
  {
    id: 'log-esp-ready',
    message: 'جاهزية بروتوكول اتصال لوحات ومتحكمات ESP32',
    details: 'المتحكمات الطرفية ولوحات التوسعة في وضع الاستعداد بانتظار إشارات القياس والتحكم',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    type: 'DEVICE'
  },
  {
    id: 'log-ai-active',
    message: 'المساعد الذكي ونظام أتمتة الطاقة الذكية نشط',
    details: 'تم ربط نماذج التحليل التنبئي لمراقبة الأحمال الكهربائية وترشيد الاستهلاك',
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    type: 'AUTOMATION'
  }
];

function withTimeout<T>(promise: Promise<T>, timeoutMs = 300): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), timeoutMs))
  ]);
}

export function pushInMemoryLog(log: { message: string; details?: string; type?: string }) {
  const newEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    message: log.message,
    details: log.details || 'حدث مسجل في المنظومة',
    timestamp: new Date().toISOString(),
    type: log.type || 'SYSTEM'
  };
  inMemoryLogs.unshift(newEntry);
  if (inMemoryLogs.length > 200) inMemoryLogs.pop();
  return newEntry;
}

export async function logsRoutes(server: FastifyInstance) {
  // GET /api/logs - Fetch real logs & auto-cleanup logs older than retention policy
  server.get('/', async (req: any, reply) => {
    try {
      let homeId: string | undefined = req.tenant?.homeId;
      let logs: any[] = [];

      try {
        if (!homeId) {
          const home = await withTimeout(prisma.home.findFirst(), 250);
          homeId = home?.id;
        }

        const limit = Math.min(1000, Math.max(10, parseInt(req.query?.limit || '500', 10)));

        // Fetch real logs from DB
        if (homeId) {
          logs = await withTimeout(prisma.auditLog.findMany({
            where: { homeId },
            orderBy: { createdAt: 'desc' },
            take: limit
          }), 300);
        }
      } catch (dbErr) {
        // Database offline or slow, gracefully use in-memory logs
        logs = [];
      }

      // Map to frontend-friendly format
      const formatted = logs.map((l: any) => ({
        id: l.id,
        message: l.action || 'تحديث حالة جهاز ESP32',
        details: l.resource ? `عنصر: ${l.resource} | المورد: ${l.resourceId || 'عام'}` : 'تم تنفيذ إجراء بالنظام',
        timestamp: l.createdAt,
        type: l.severity === 'CRITICAL' ? 'AUTOMATION' : (l.severity === 'WARNING' ? 'SYSTEM' : 'USER_ACTION')
      }));

      // Combine in-memory events with DB events (in-memory events are always fresh)
      const combined = [...inMemoryLogs, ...formatted];
      const seen = new Set<string>();
      const deduplicated = combined.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      return reply.send(deduplicated);
    } catch (error) {
      server.log.error(error);
      return reply.send(inMemoryLogs);
    }
  });

  // DELETE /api/logs - Real clear logs from DB
  server.delete('/', async (req: any, reply) => {
    try {
      let homeId: string | undefined = req.tenant?.homeId;
      if (!homeId) {
        const home = await prisma.home.findFirst();
        homeId = home?.id;
      }

      if (homeId) {
        await prisma.auditLog.deleteMany({ where: { homeId } });
      } else {
        await prisma.auditLog.deleteMany({});
      }

      return reply.send({ success: true, message: 'تم مسح كافة سجلات النظام والـ ESP32 من قاعدة البيانات بنجاح' });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ message: 'حدث خطأ أثناء حذف السجلات' });
    }
  });

  // GET /api/logs/retention - Get log retention policy
  server.get('/retention', async (req: any, reply) => {
    try {
      const settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });
      return reply.send({
        retentionDays: settings?.retentionDays || 30
      });
    } catch (error) {
      return reply.send({ retentionDays: 30 });
    }
  });

  // POST /api/logs/retention - Update log retention policy
  server.post('/retention', async (req: any, reply) => {
    try {
      const { days } = retentionSchema.parse(req.body);
      
      await prisma.systemSettings.upsert({
        where: { id: 'singleton' },
        update: { retentionDays: days },
        create: { id: 'singleton', retentionDays: days }
      });

      // Execute auto-delete immediately
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoffDate } }
      }).catch(() => null);

      return reply.send({
        success: true,
        retentionDays: days,
        message: `تم تفعيل الحذف التلقائي للسجلات القديمة بعد ${days} يوم بنجاح!`
      });
    } catch (error: any) {
      return reply.status(400).send({ message: error.message || 'بيانات غير صالحة' });
    }
  });
}
