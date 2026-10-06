import { FastifyInstance } from 'fastify';
import { prisma, withTimeout } from '../lib/prisma';
import { buildCheckPermission, Role } from '../lib/permissions';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

export default async function brandingRoutes(fastify: FastifyInstance) {
  
  // Get public branding (Used on Login Page without Auth)
  fastify.get('/', async (request, reply) => {
    const host = request.headers.host;
    
    let branding: any = null;
    try {
      branding = await withTimeout(prisma.tenantBranding.findFirst({
        where: { OR: [{ customDomain: host }, { tenantId: 'default' }] }
      }), 150).catch(() => null);

      if (!branding) {
        branding = await withTimeout(prisma.tenantBranding.findFirst(), 150).catch(() => null);
      }
    } catch {}

    return branding || { platformName: 'MOSA Smart Platform', colorPrimary: '#3b82f6' };
  });

  // Update branding (Requires SUPER_OWNER)
  fastify.put('/:homeId', async (request, reply) => {
    await buildCheckPermission(request, reply, Role.SUPER_OWNER);
    if (reply.sent) return;

    const { homeId } = request.params as { homeId: string };
    const updates = request.body as any;

    const branding = await prisma.tenantBranding.upsert({
      where: { tenantId: homeId },
      update: updates,
      create: {
        tenantId: homeId,
        ...updates
      }
    });

    return branding;
  });

  // Logo upload endpoint (Real local upload instead of mock S3)
  fastify.post('/:homeId/logo', async (request, reply) => {
    await buildCheckPermission(request, reply, Role.SUPER_OWNER);
    if (reply.sent) return;

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const { homeId } = request.params as { homeId: string };
    
    // Setup local upload directory
    const uploadDir = path.join(__dirname, '../../../../uploads/brands');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Clean up filename and setup path
    const sanitizedFilename = `logo-${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadDir, sanitizedFilename);

    try {
      // Pipe file stream to disk
      await pipeline(data.file, fs.createWriteStream(filePath));
      
      const realUrl = `/uploads/brands/${sanitizedFilename}`;

      await prisma.tenantBranding.upsert({
        where: { tenantId: homeId },
        update: { logoUrl: realUrl },
        create: { tenantId: homeId, logoUrl: realUrl }
      });

      return { url: realUrl };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to upload logo file' });
    }
  });

  // Background upload endpoint
  fastify.post('/:homeId/bg', async (request, reply) => {
    await buildCheckPermission(request, reply, Role.SUPER_OWNER);
    if (reply.sent) return;

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const { homeId } = request.params as { homeId: string };
    
    const uploadDir = path.join(__dirname, '../../../../uploads/brands');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const sanitizedFilename = `bg-${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadDir, sanitizedFilename);

    try {
      await pipeline(data.file, fs.createWriteStream(filePath));
      
      const realUrl = `/uploads/brands/${sanitizedFilename}`;

      await prisma.tenantBranding.upsert({
        where: { tenantId: homeId },
        update: { loginBgUrl: realUrl },
        create: { tenantId: homeId, loginBgUrl: realUrl }
      });

      return { url: realUrl };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to upload background file' });
    }
  });
}
