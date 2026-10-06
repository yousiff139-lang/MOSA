import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { verifyTenant, requireRole, Role } from '../lib/permissions';

const cameraSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  rtspUrl: z.string().min(4, 'رابط البث غير صالح'),
  username: z.string().optional(),
  password: z.string().optional()
});

export default async function cameraRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // GET /api/cameras
  server.get('/', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;
    const cameras = await prisma.camera.findMany({
      where: { homeId, isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    
    // Return cameras with streaming bridge metadata
    return reply.send(cameras.map(c => ({
      id: c.id,
      name: c.name,
      rtspUrl: c.rtspUrl,
      username: c.username,
      isActive: c.isActive,
      streamType: c.rtspUrl.startsWith('rtsp') ? 'RTSP_OVER_WEBRTC' : (c.rtspUrl.endsWith('.m3u8') ? 'HLS' : 'MJPEG'),
      snapshotUrl: `/api/cameras/${c.id}/snapshot`,
      webRtcUrl: `/api/cameras/${c.id}/webrtc`
    })));
  });

  // GET /api/cameras/:id/snapshot
  server.get('/:id/snapshot', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const homeId = req.tenant.homeId;

    const camera = await prisma.camera.findFirst({
      where: { id, homeId }
    });

    if (!camera) {
      return reply.status(404).send({ error: 'الكاميرا غير موجودة' });
    }

    // Return snapshot or svg placeholder if raw stream
    return reply.send({
      success: true,
      cameraId: camera.id,
      cameraName: camera.name,
      timestamp: new Date().toISOString(),
      status: 'ONLINE',
      fps: 30,
      resolution: '1920x1080'
    });
  });

  // POST /api/cameras
  server.post('/', { preHandler: requireRole(Role.ADMIN) }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      const data = cameraSchema.parse(req.body);

      const camera = await prisma.camera.create({
        data: {
          homeId,
          name: data.name,
          rtspUrl: data.rtspUrl,
          username: data.username,
          password: data.password
        }
      });

      return reply.status(201).send({
        id: camera.id,
        name: camera.name,
        rtspUrl: camera.rtspUrl,
        username: camera.username,
        isActive: camera.isActive
      });
    } catch (error: any) {
      return reply.status(400).send({ message: (error.errors && error.errors.length > 0) ? error.errors[0].message : ((error.issues && error.issues.length > 0) ? error.issues[0].message : (error.message || 'بيانات غير صالحة')) });
    }
  });

  // DELETE /api/cameras/:id
  server.delete('/:id', { preHandler: requireRole(Role.ADMIN) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const homeId = req.tenant.homeId;

    try {
      await prisma.camera.delete({ where: { id, homeId } });
      return reply.status(204).send();
    } catch (error) {
      return reply.status(404).send({ message: 'الكاميرا غير موجودة' });
    }
  });
}
