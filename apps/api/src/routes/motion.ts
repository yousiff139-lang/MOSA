import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export async function motionRoutes(server: FastifyInstance) {
  // GET /api/motion/logs
  server.get('/logs', async (req, reply) => {
    const { deviceId, from, to, limit = 50 } = req.query as any;
    
    const where: any = {};
    if (deviceId) where.deviceId = deviceId;
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }

    try {
      const logs = await prisma.motionLog.findMany({
        where,
        take: Number(limit),
        orderBy: { timestamp: 'desc' },
        include: {
          device: {
            include: { room: true }
          }
        }
      });
      return reply.send(logs);
    } catch (error) {
      return reply.status(500).send({ message: 'Error fetching motion logs' });
    }
  });

  // DELETE /api/motion/logs
  server.delete('/logs', async (req, reply) => {
    try {
      await prisma.motionLog.deleteMany({});
      return reply.status(204).send();
    } catch (error) {
      return reply.status(500).send({ message: 'Error clearing motion logs' });
    }
  });
}
