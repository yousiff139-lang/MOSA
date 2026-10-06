import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { buildCheckPermission, Role } from '../lib/permissions';

const PaginationQuery = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export async function telemetryRoutes(server: FastifyInstance) {
  server.get('/energy', async (req, reply) => {
    // Basic RBAC Check for demonstration (Can be expanded to Home specific)
    await buildCheckPermission(req, reply, Role.MEMBER);
    if (reply.sent) return;

    try {
      const { limit, cursor } = PaginationQuery.parse(req.query);
      const skipCount = cursor ? parseInt(cursor, 10) : 0;

      const logs = await prisma.energyLog.findMany({
        take: limit,
        skip: skipCount,
        orderBy: { timestamp: 'desc' },
      });

      let nextCursor: string | undefined = undefined;
      if (logs.length === limit) {
        nextCursor = (skipCount + limit).toString();
      }

      return reply.send({
        data: logs,
        nextCursor,
      });
    } catch (e: any) {
      return reply.status(400).send({ message: 'Invalid query parameters', details: e });
    }
  });

  server.get('/motion', async (req, reply) => {
    await buildCheckPermission(req, reply, Role.MEMBER);
    if (reply.sent) return;

    try {
      const { limit, cursor } = PaginationQuery.parse(req.query);

      const logs = await prisma.motionLog.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { timestamp: 'desc' },
      });

      let nextCursor: string | undefined = undefined;
      if (logs.length > limit) {
        const nextItem = logs.pop();
        nextCursor = nextItem!.id;
      }

      return reply.send({
        data: logs,
        nextCursor,
      });
    } catch (e: any) {
      return reply.status(400).send({ message: 'Invalid query parameters' });
    }
  });


  // POST /api/telemetry/crash-report (ESP32 Health & Reset Reason Crash Logging)
  server.post('/crash-report', async (req, reply) => {
    try {
      const { boardId, resetReason, freeHeap, fragmentation, loopLatency, wifiRssi } = req.body as any;

      if (!boardId || !resetReason) {
        return reply.status(400).send({ error: 'boardId and resetReason are required' });
      }

      console.warn(`[ESP32 Telemetry] Crash/Health Report from ${boardId}: Reason=${resetReason}, FreeHeap=${freeHeap}B, Latency=${loopLatency}ms`);

      // Look up node by mac, id or name to resolve the owner homeId
      const node = await prisma.node.findFirst({
        where: {
          OR: [
            { mac: String(boardId) },
            { id: String(boardId) },
            { name: String(boardId) }
          ]
        }
      });

      const targetHomeId = node?.homeId || (await prisma.home.findFirst())?.id;
      if (targetHomeId) {
        await prisma.activityLog.create({
          data: {
            homeId: targetHomeId,
            action: 'ESP32_DIAGNOSTIC_REPORT',
            targetType: 'ESP32_NODE',
            targetId: String(boardId),
            metadata: { boardId, resetReason, freeHeap, fragmentation, loopLatency, wifiRssi }
          }
        }).catch(console.error);
      }

      return reply.send({ success: true, message: 'Crash report recorded successfully' });
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to record telemetry report' });
    }
  });
}
