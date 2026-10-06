import { FastifyInstance } from 'fastify';
import { prisma, withTimeout } from '../lib/prisma';
import { z } from 'zod';
import { verifyTenant } from '../lib/permissions';

import { getTenantPrisma } from '../lib/tenantPrisma';

const conditionSchema = z.object({
  type: z.enum(['sensor_value', 'device_state', 'time']),
  deviceId: z.string().optional(),
  operator: z.enum(['>', '<', '==', '!=']).optional(),
  value: z.any().optional(),
  unit: z.string().optional(),
  state: z.enum(['ON', 'OFF']).optional(),
  time: z.string().optional(),
  days: z.array(z.string()).optional()
});

const actionSchema = z.object({
  type: z.enum(['device_control', 'notification']),
  deviceId: z.string().optional(),
  mqttTopic: z.string().optional(),
  state: z.enum(['ON', 'OFF']).optional(),
  message: z.string().optional()
});

const createAutomationSchema = z.object({
  name: z.string(),
  conditions: z.array(conditionSchema).nullable().optional(),
  actions: z.array(actionSchema).nullable().optional(),
  flowData: z.any().optional(),
  isActive: z.boolean().default(true)
});

const updateAutomationSchema = createAutomationSchema.partial();

export async function automationRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // GET /api/automations
  server.get('/', async (req, reply) => {
    if (!req.tenant.homeId) return reply.send([]);
    let automations: any[] = [];
    try {
      automations = await withTimeout(prisma.automation.findMany({
        where: { homeId: req.tenant.homeId, deletedAt: null }
      }), 200).catch(() => []);
    } catch {
      automations = [];
    }
    const mapped = automations.map((a: any) => ({
      id: a.id,
      name: a.name,
      conditions: a.condition ? (a.condition as any) : null,
      actions: a.action ? (a.action as any) : [],
      flowData: a.flowData,
      isActive: a.isActive
    }));
    return reply.send(mapped);
  });

  // POST /api/automations
  server.post('/', async (req, reply) => {
    try {
      const data = createAutomationSchema.parse(req.body);
      const tPrisma = getTenantPrisma(req.tenant.homeId);
      const automation = await tPrisma.automation.create({
        data: {
          homeId: req.tenant.homeId,
          name: data.name,
          condition: data.conditions || [],
          action: data.actions || [],
          flowData: data.flowData || null,
          isActive: data.isActive
        }
      });
      return reply.status(201).send({
        id: automation.id,
        name: automation.name,
        conditions: automation.condition,
        actions: automation.action,
        flowData: automation.flowData,
        isActive: automation.isActive
      });
    } catch (error: any) {
      return reply.status(400).send({ message: (error.errors && error.errors.length > 0) ? error.errors[0].message : ((error.issues && error.issues.length > 0) ? error.issues[0].message : (error.message || 'بيانات غير صالحة')) });
    }
  });

  // POST /api/automations/ast
  server.post('/ast', async (req, reply) => {
    try {
      const ast = req.body as any;
      // We import it here dynamically or lazily to avoid circular dependency at load time
      const { automationEngine } = await import('../server');
      const newAutomation = await automationEngine.parseAndRegisterAST(ast, req.tenant.homeId);
      return reply.status(201).send(newAutomation);
    } catch (error: any) {
      server.log.error(error);
      return reply.status(400).send({ message: 'فشل في حفظ الأتمتة البصرية' });
    }
  });

  // PATCH /api/automations/:id
  server.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const data = updateAutomationSchema.parse(req.body);
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.conditions !== undefined) updateData.condition = data.conditions || [];
      if (data.actions !== undefined) updateData.action = data.actions || [];
      if (data.flowData !== undefined) updateData.flowData = data.flowData || null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const tPrisma = getTenantPrisma(req.tenant.homeId);
      const updated = await tPrisma.automation.update({
        where: { id },
        data: updateData
      });
      return reply.send(updated);
    } catch (error) {
      return reply.status(404).send({ message: 'الأتمتة غير موجودة' });
    }
  });

  // DELETE /api/automations/:id
  server.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const tPrisma = getTenantPrisma(req.tenant.homeId);
      await tPrisma.automation.delete({ where: { id } });
      return reply.status(204).send();
    } catch (error) {
      return reply.status(404).send({ message: 'الأتمتة غير موجودة' });
    }
  });

  // POST /api/automations/:id/toggle
  server.post('/:id/toggle', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const tPrisma = getTenantPrisma(req.tenant.homeId);
      const automation = await tPrisma.automation.findUnique({ where: { id } });
      if (!automation) return reply.status(404).send({ message: 'الأتمتة غير موجودة' });

      const updated = await tPrisma.automation.update({
        where: { id },
        data: { isActive: !automation.isActive }
      });
      return reply.send({ isActive: updated.isActive });
    } catch (error) {
      return reply.status(400).send({ message: 'حدث خطأ' });
    }
  });
}
