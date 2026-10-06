import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import { getTenantPrisma } from '../lib/tenantPrisma';
import crypto from 'crypto';
import { ActivityService } from '../services/activity.service';

const climateControlSchema = z.object({
  targetTemp: z.number().min(16).max(30).optional(),
  mode: z.enum(['COOL', 'HEAT', 'FAN', 'DRY', 'AUTO']).optional(),
  fanSpeed: z.enum(['LOW', 'MEDIUM', 'HIGH', 'AUTO']).optional(),
  swing: z.enum(['ON', 'OFF']).optional(),
  state: z.enum(['ON', 'OFF']).optional(),
});

export async function climateRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // POST /api/climate/:deviceId/control
  server.post('/:deviceId/control', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    try {
      const { deviceId } = req.params as { deviceId: string };
      const data = climateControlSchema.parse(req.body);
      const homeId = req.tenant.homeId;
      const tPrisma = getTenantPrisma(homeId);

      const device = await tPrisma.device.findUnique({ where: { id: deviceId } });
      if (!device || device.type !== 'climate') {
        return reply.status(404).send({ message: 'جهاز التكييف غير موجود' });
      }

      const mqttTopic = `mosa/${homeId}/device/${deviceId}/command`;
      
      const payload = {
        action: 'CLIMATE_CONTROL',
        ...data,
        issuer: req.tenant.userId,
        nonce: crypto.randomUUID(),
        timestamp: Date.now()
      };

      server.mqtt.publish(mqttTopic, JSON.stringify(payload), { retain: false });
      
      await ActivityService.log({
        homeId,
        userId: req.tenant.userId,
        action: 'CLIMATE_CONTROL',
        targetType: 'DEVICE',
        targetId: deviceId,
        ipAddress: req.ip,
        metadata: data
      });

      server.io.to(`home:${homeId}`).emit('notification', {
        title: 'تغيير إعدادات التكييف',
        message: `تم إرسال أمر لتكييف ${device.name}`,
        type: 'INFO'
      });

      return reply.send({ status: 'command_sent', topic: mqttTopic });
    } catch (error: any) {
      return reply.status(400).send({ message: (error.errors && error.errors.length > 0) ? error.errors[0].message : ((error.issues && error.issues.length > 0) ? error.issues[0].message : (error.message || 'بيانات غير صالحة')) });
    }
  });
}
