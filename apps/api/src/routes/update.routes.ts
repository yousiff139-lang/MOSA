import { FastifyInstance } from 'fastify';
import { updateManager } from '../services/UpdateManager';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import { z } from 'zod';
import { server } from '../server';

export async function updateRoutes(app: FastifyInstance) {
  app.addHook('preHandler', verifyTenant);

  app.get('/version', { preHandler: [requireRole(Role.GUEST)] }, async (req, reply) => {
    const current = await updateManager.getCurrentVersion();
    return reply.send(current);
  });

  app.post('/check', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    const update = await updateManager.checkForUpdates();
    if (!update) {
      return reply.status(204).send();
    }
    return reply.send(update);
  });

  app.post('/apply', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    // Run update process asynchronously in the background to prevent request timeout
    const current = (await updateManager.getCurrentVersion()) as any;
    const mockUpdatePackage = {
      version: {
        version: current.pendingVersion || '1.1.0',
        buildNumber: current.buildNumber + 10,
        releaseDate: new Date().toISOString().split('T')[0],
        channel: 'stable' as const,
        components: {
          platform: current.pendingVersion || '1.1.0',
          firmware: current.pendingVersion || '1.1.0',
          schema: current.schemaVersion + 1
        },
        requirements: {
          minFirmware: '1.0.0',
          minSchema: 1,
          breakingChanges: false
        },
        changelog: {
          ar: ['تحسين كفاءة الاتصال وتوحيد مسارات MQTT 🚀', 'تأمين الاتصال للتحكم الجماعي'],
          en: ['Improved communication efficiency and unified MQTT topics 🚀', 'Group control verification security']
        },
        signature: 'MOCK_SIGNATURE',
        checksum: 'MOCK_CHECKSUM'
      },
      files: {
        backend: '',
        frontend: '',
        migrations: []
      },
      size: 15482390,
      estimatedTime: 120
    };

    updateManager.applyUpdate(mockUpdatePackage, { maintenanceWindow: true })
      .catch(err => console.error('[UpdateRoute] Apply update background task error:', err));
      
    return reply.send({ success: true, message: 'بدأ تحديث النظام في الخلفية' });
  });

  app.post('/simulate', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    const current = await updateManager.getCurrentVersion();
    server.io.emit('update_available', {
      currentVersion: current.version,
      newVersion: '2.1.0',
      changelog: {
        ar: ['مستقبل تحديثات الأجهزة وتأمين الاتصالات بالكامل 🔐', 'مخطط التحديث الذاتي عند الساعة 3:00 صباحاً'],
        en: ['Complete OTA update receiver and connection security 🔐', 'Autonomous 3:00 AM maintenance window updates']
      },
      size: 28401394,
      estimatedTime: 180
    });
    return reply.send({ success: true, message: 'تم إرسال إشعار محاكاة التحديث' });
  });
}
