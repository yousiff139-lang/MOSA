import { FastifyInstance } from 'fastify';
import { getTenantPrisma } from '../lib/tenantPrisma';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import { z } from 'zod';

const createScheduleSchema = z.object({
  name: z.string(),
  schedule: z.string(), // Cron expression e.g. "0 6 * * *"
  deviceId: z.string(),
  state: z.enum(['ON', 'OFF']),
  durationMinutes: z.number().min(1).max(120).optional() // For local fail-safe command simulation
});

export async function irrigationRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // GET /api/irrigation
  server.get('/', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;
    const tPrisma = getTenantPrisma(homeId);

    const routines = await tPrisma.routine.findMany({
      where: {
        homeId,
        name: { contains: 'irrigation' }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send(routines);
  });

  // POST /api/irrigation - Create schedule with conflict detection
  server.post('/', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const data = createScheduleSchema.parse(req.body);
      const homeId = req.tenant.homeId;
      const tPrisma = getTenantPrisma(homeId);

      // Conflict validation: Prevent duplicate schedules for the same device/time
      const existingConflict = await tPrisma.routine.findFirst({
        where: {
          homeId,
          schedule: data.schedule,
          name: { contains: 'irrigation' }
        }
      });

      if (existingConflict) {
        return reply.code(409).send({ 
          message: `يوجد جدول ري مسجل مسبقاً (${existingConflict.name.replace('irrigation_', '')}) في نفس الموعد الزمني المحدد. يرجى اختيار موعد آخر لتفادي التعارض.` 
        });
      }

      // Create routine action payload
      const actions = [{
        type: 'device_control',
        deviceId: data.deviceId,
        state: data.state,
        durationMinutes: data.durationMinutes || 15 // Local fail-safe duration payload
      }];

      const routine = await tPrisma.routine.create({
        data: {
          homeId,
          name: `irrigation_${data.name}`,
          schedule: data.schedule,
          actions: actions,
          isActive: true
        }
      });

      return reply.status(201).send(routine);
    } catch (error: any) {
      server.log.error(error);
      return reply.status(400).send({ message: error.message || 'بيانات الجدولة غير صالحة' });
    }
  });

  // DELETE /api/irrigation/:id
  server.delete('/:id', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const homeId = req.tenant.homeId;
      const tPrisma = getTenantPrisma(homeId);

      await tPrisma.routine.delete({
        where: { id, homeId }
      });

      return reply.status(204).send();
    } catch (error) {
      server.log.error(error);
      return reply.status(404).send({ message: 'الجدول غير موجود' });
    }
  });
}
