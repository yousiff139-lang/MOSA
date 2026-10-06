import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const pluginSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  code: z.string(),
  isActive: z.boolean().default(false)
});

export async function pluginRoutes(server: FastifyInstance) {
  // GET /api/plugins
  server.get('/', async (req, reply) => {
    try {
      const plugins = await prisma.plugin.findMany();
      return reply.send(plugins);
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ message: 'فشل جلب الإضافات' });
    }
  });

  // POST /api/plugins
  server.post('/', async (req, reply) => {
    try {
      const data = pluginSchema.parse(req.body);
      const plugin = await prisma.plugin.create({
        data
      });
      
      // If active, we should load it into the engine
      if (plugin.isActive) {
         const { pluginEngine } = await import('../server');
         await pluginEngine.loadPlugin(plugin.name, plugin.code);
      }
      
      return reply.status(201).send(plugin);
    } catch (error: any) {
      server.log.error(error);
      return reply.status(400).send({ message: 'بيانات غير صالحة' });
    }
  });

  // PATCH /api/plugins/:id/toggle
  server.patch('/:id/toggle', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const plugin = await prisma.plugin.findUnique({ where: { id }});
      if (!plugin) return reply.status(404).send({ message: 'الإضافة غير موجودة' });
      
      const updated = await prisma.plugin.update({
        where: { id },
        data: { isActive: !plugin.isActive }
      });
      
      const { pluginEngine } = await import('../server');
      if (updated.isActive) {
         await pluginEngine.loadPlugin(updated.name, updated.code);
      } else {
         pluginEngine.unloadPlugin(updated.name);
      }
      
      return reply.send(updated);
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ message: 'فشل تغيير حالة الإضافة' });
    }
  });
}
