import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { AutomationEngine } from '../services/automation.engine';
import { verifyTenant } from '../lib/permissions';

const actionSchema = z.object({
  type: z.enum(['device_control', 'notification']),
  deviceId: z.string().optional(),
  mqttTopic: z.string().optional(),
  state: z.enum(['ON', 'OFF']).optional(),
  message: z.string().optional()
});

const createSceneSchema = z.object({
  name: z.string(),
  actions: z.array(actionSchema),
  icon: z.string().optional()
});

const scheduleSceneSchema = z.object({
  time: z.string(),
  days: z.array(z.string())
});

export async function sceneRoutes(server: FastifyInstance, automationEngine: AutomationEngine) {
  server.addHook('preHandler', verifyTenant);

  // GET /api/scenes
  server.get('/', async (req, reply) => {
    // Return automations where conditions are empty or equals '[]'
    const automations = await prisma.automation.findMany({
       where: { homeId: req.tenant.homeId }
    });
    
    // A scene is an automation with no conditions or an empty conditions array
    const scenes = automations.filter(a => {
      const conds = a.condition as any[];
      return !conds || conds.length === 0;
    });

    const mapped = scenes.map(s => ({
      id: s.id,
      homeId: (s as any).homeId,
      name: s.name,
      actions: s.action ? (s.action as any) : [],
      icon: (s as any).icon || '🎬', // default icon if not in DB schema
      isActive: s.isActive
    }));

    return reply.send(mapped);
  });

  // POST /api/scenes
  server.post('/', async (req, reply) => {
    try {
      const data = createSceneSchema.parse(req.body);
      
      const scene = await prisma.automation.create({
        data: {
          homeId: req.tenant.homeId,
          name: data.name,
          condition: [], // Empty condition means it's a scene
          action: data.actions || [],
          isActive: true
        }
      });
      
      return reply.status(201).send({
        id: scene.id,
        name: scene.name,
        actions: scene.action,
        icon: data.icon || '🎬'
      });
    } catch (error: any) {
      return reply.status(400).send({ message: (error.errors && error.errors.length > 0) ? error.errors[0].message : ((error.issues && error.issues.length > 0) ? error.issues[0].message : (error.message || 'بيانات غير صالحة')) });
    }
  });

  // POST /api/scenes/:id/execute
  server.post('/:id/execute', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const scene = await prisma.automation.findUnique({ where: { id, homeId: req.tenant.homeId } });
      if (!scene) return reply.status(404).send({ message: 'السيناريو غير موجود' });

      const success = await automationEngine.executeScene(id);
      if (!success) {
        return reply.status(404).send({ message: 'فشل في تنفيذ السيناريو' });
      }
      return reply.send({ success: true, message: 'تم تنفيذ السيناريو' });
    } catch (err) {
      return reply.status(500).send({ message: 'حدث خطأ أثناء التنفيذ' });
    }
  });

  // POST /api/scenes/:id/schedule
  server.post('/:id/schedule', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const data = scheduleSceneSchema.parse(req.body);
      
      const updated = await prisma.automation.update({
        where: { id, homeId: req.tenant.homeId },
        data: {
          condition: [{
            type: 'time',
            time: data.time,
            days: data.days
          }]
        }
      });
      return reply.send(updated);
    } catch (error: any) {
      return reply.status(404).send({ message: 'السيناريو غير موجود أو البيانات غير صالحة' });
    }
  });

  // PUT /api/scenes/:id
  server.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const data = createSceneSchema.parse(req.body);
      const updated = await prisma.automation.update({
        where: { id, homeId: req.tenant.homeId },
        data: {
          name: data.name,
          action: data.actions || []
        }
      });
      return reply.send({
        id: updated.id,
        name: updated.name,
        actions: updated.action,
        icon: data.icon || '🎬'
      });
    } catch (error: any) {
      return reply.status(400).send({ message: 'فشل في تحديث السيناريو' });
    }
  });

  // DELETE /api/scenes/:id
  server.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await prisma.automation.delete({ where: { id, homeId: req.tenant.homeId } });
      return reply.status(204).send();
    } catch (error) {
      return reply.status(404).send({ message: 'السيناريو غير موجود' });
    }
  });
}
