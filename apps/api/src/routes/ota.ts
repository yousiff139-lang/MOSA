import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import nacl from 'tweetnacl';
import crypto from 'crypto';
import { server } from '../server';
import { sendTelegram } from '../services/telegram';
import os from 'os';

function getServerIp(req?: any): string {
  if (process.env.SERVER_IP && process.env.SERVER_IP !== 'localhost' && !process.env.SERVER_IP.startsWith('172.')) {
    return process.env.SERVER_IP;
  }
  
  if (req) {
    const rawHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(':')[0];
    if (rawHost && !rawHost.startsWith('172.') && !rawHost.startsWith('127.') && !rawHost.startsWith('10.') && rawHost !== 'localhost' && rawHost !== 'mosa-backend') {
      return rawHost;
    }
  }

  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('172.')) {
        return iface.address;
      }
    }
  }

  return '192.168.1.102';
}

// In production, this must be loaded from HashiCorp Vault.
// For demo, we generate an ephemeral key or use a hardcoded fallback.
const OTA_PRIVATE_KEY_B64 = process.env.OTA_PRIVATE_KEY || 'jX6j/q1R2K...'; // Placeholder
let keyPair: nacl.SignKeyPair;
try {
  const secretKey = Buffer.from(OTA_PRIVATE_KEY_B64, 'base64');
  if (secretKey.length === 64) {
    keyPair = nacl.sign.keyPair.fromSecretKey(secretKey);
  } else {
    keyPair = nacl.sign.keyPair(); // Ephemeral fallback
  }
} catch {
  keyPair = nacl.sign.keyPair();
}
const publicKeyBase64 = Buffer.from(keyPair.publicKey).toString('base64');

export async function otaRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);
  
  // POST /api/admin/ota/rollout
  server.get('/versions', async (req, reply) => {
    try {
      const versions = await prisma.firmwareVersion.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return reply.send(versions);
    } catch (err) {
      return reply.status(500).send({ message: 'Error fetching firmware versions' });
    }
  });

  // POST /api/ota/upload
  server.post('/upload', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const data = await req.file({ limits: { fileSize: 50 * 1024 * 1024 } });
      if (!data) return reply.status(400).send({ message: 'لا يوجد ملف' });

      // 1. Extension check
      if (!data.filename.endsWith('.bin')) {
        return reply.status(400).send({ message: 'Only .bin files allowed' });
      }

      // 2. Read the file into a buffer to validate magic bytes and size
      const fileBuffer = await data.toBuffer();

      // 3. Size check (max 4MB for standard ESP32)
      if (fileBuffer.length > 4 * 1024 * 1024) {
        return reply.status(400).send({ message: 'File too large (max 4MB)' });
      }

      // 4. ESP32 magic byte check (first byte = 0xE9)
      if (fileBuffer[0] !== 0xE9) {
        return reply.status(400).send({ message: 'Invalid ESP32 firmware signature' });
      }

      // We need to extract other fields: version, notes
      const versionField = data.fields['version'] as any;
      const notesField = data.fields['notes'] as any;
      
      const version = versionField ? versionField.value : '1.0.0';
      const notes = notesField ? notesField.value : '';

      // 5. UUID filename (no user input in path)
      const filename = `${crypto.randomUUID()}.bin`;
      const firmwareDir = path.resolve(process.cwd(), 'uploads/firmware');
      if (!fs.existsSync(firmwareDir)) {
        fs.mkdirSync(firmwareDir, { recursive: true });
      }
      const uploadPath = path.join(firmwareDir, filename);
      
      await fs.promises.writeFile(uploadPath, fileBuffer);
      const stat = await fs.promises.stat(uploadPath);

      const fw = await prisma.firmwareVersion.create({
        data: {
          version,
          filename,
          fileSize: stat.size,
          filePath: `/firmware/${filename}`,
          notes,
          isStable: false
        }
      });

      // Phase 5: Ed25519 Firmware Signing
      // File buffer is already in memory
      const signature = nacl.sign.detached(fileBuffer, keyPair.secretKey);
      const signatureBase64 = Buffer.from(signature).toString('base64');

      await prisma.firmwareSignature.create({
        data: {
          versionId: fw.id,
          publicKey: publicKeyBase64,
          signature: signatureBase64,
          algorithm: 'Ed25519'
        }
      });

      server.log.info(`[OTA Security] Firmware ${version} signed with Ed25519. Sig: ${signatureBase64.substring(0, 10)}...`);

      const boardIdField = data.fields['boardId'] as any;
      const boardId = boardIdField ? boardIdField.value : null;

      if (boardId) {
         // Auto-trigger flash for this board
         const controller = await prisma.node.findUnique({ 
            where: { id: boardId } 
         });
         if (controller) {
            await prisma.otaUpdate.create({
              data: { controllerId: boardId, versionId: fw.id, status: 'PENDING' }
            });
            const serverIp = getServerIp(req);
            const port = process.env.PORT || 8080;
            const payload = {
              action: 'OTA',
              targetBoardId: controller.id,
              boardId: controller.id,
              url: `http://${serverIp}/firmware/${fw.filename}`,
              version: fw.version,
              signature: signatureBase64
            };
            const topic = `mosa/${req.tenant?.homeId || 'home-1'}/device/${controller.id}/command`;
            if (server.mqtt) {
              server.mqtt.publish(topic, JSON.stringify(payload), { qos: 1, retain: false });
              server.mqtt.publish(`mosa/broadcast/command`, JSON.stringify(payload), { qos: 1, retain: false });
            }
         }
      }

      return reply.send({ ...fw, signature: signatureBase64 });
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ message: 'فشل رفع الملف' });
    }
  });

  // POST /api/ota/flash/:controllerId
  server.post('/flash/:controllerId', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { controllerId } = req.params as { controllerId: string };
      const { versionId } = req.body as { versionId: string };

      const controller = await prisma.node.findUnique({ 
         where: { id: controllerId, homeId: req.tenant.homeId } 
      });
      if (!controller) return reply.status(404).send({ message: 'المتحكم غير موجود' });

      const fw = await prisma.firmwareVersion.findUnique({ where: { id: versionId } });
      if (!fw) return reply.status(404).send({ message: 'الإصدار غير موجود' });

      // Create OTA Update Record
      const updateReq = await prisma.otaUpdate.create({
        data: {
          controllerId,
          versionId,
          status: 'PENDING'
        }
      });

      // Emit MQTT message to ESP32 on standard command topic
      const serverIp = getServerIp(req);
      const port = process.env.PORT || 8080;
      
      const fwSig = await prisma.firmwareSignature.findFirst({ where: { versionId: fw.id } });
      const signature = fwSig ? fwSig.signature : '';

      const payload = {
        action: 'OTA',
        targetBoardId: controller.id,
        boardId: controller.id,
        url: `http://${serverIp}/firmware/${fw.filename}`,
        version: fw.version,
        signature: signature
      };

      const topic = `mosa/${req.tenant.homeId}/device/${controller.id}/command`;
      if (server.mqtt) {
        server.mqtt.publish(topic, JSON.stringify(payload), { qos: 1, retain: false });
        server.mqtt.publish(`mosa/broadcast/command`, JSON.stringify(payload), { qos: 1, retain: false });
      }

      return reply.send(updateReq);
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ message: 'فشل بدء التحديث' });
    }
  });

  // POST /api/ota/rollout
  server.post('/rollout', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { versionId, targetType, targetValue } = req.body as { 
         versionId: string, 
         targetType: 'ALL' | 'VERSION', 
         targetValue?: string 
      };

      const fw = await prisma.firmwareVersion.findUnique({ where: { id: versionId } });
      if (!fw) return reply.status(404).send({ message: 'الإصدار غير موجود' });

      let controllers: any[] = [];
      if (targetType === 'ALL') {
         controllers = await prisma.node.findMany({ where: { homeId: req.tenant.homeId } });
      } else if (targetType === 'VERSION' && targetValue) {
         controllers = await prisma.node.findMany({ 
            where: { homeId: req.tenant.homeId, firmware: targetValue } 
         });
      }

      if (controllers.length === 0) {
         return reply.status(400).send({ message: 'لا توجد أجهزة مطابقة' });
      }

      const fwSig = await prisma.firmwareSignature.findFirst({ where: { versionId: fw.id } });
      const signature = fwSig ? fwSig.signature : '';
      const serverIp = getServerIp(req);
      const port = process.env.PORT || 8080;
      const payload = { url: `http://${serverIp}/firmware/${fw.filename}`, version: fw.version, signature: signature };

      for (const controller of controllers) {
         await prisma.otaUpdate.create({
            data: { controllerId: controller.id, versionId, status: 'PENDING' }
         });

         const topic = `mosa/${req.tenant.homeId}/device/${controller.id}/command`;
         server.mqtt.publish(topic, JSON.stringify({ action: 'OTA', ...payload }));
      }

      return reply.send({ success: true, count: controllers.length });
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ message: 'فشل بدء التحديث الجماعي' });
    }
  });

  // GET /api/ota/status/:controllerId
  server.get('/status/:controllerId', async (req, reply) => {
    try {
      const { controllerId } = req.params as { controllerId: string };
      const latestUpdate = await prisma.otaUpdate.findFirst({
        where: { controllerId },
        orderBy: { startedAt: 'desc' },
      });
      return reply.send(latestUpdate || { status: 'NONE' });
    } catch (err) {
      return reply.status(500).send({ message: 'Error fetching OTA status' });
    }
  });

  // PATCH /api/ota/versions/:id/stable
  server.patch('/versions/:id/stable', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { isStable } = req.body as { isStable: boolean };
    const updated = await prisma.firmwareVersion.update({
      where: { id },
      data: { isStable }
    });
    return reply.send(updated);
  });
  
  // DELETE /api/ota/versions/:id
  server.delete('/versions/:id', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const fw = await prisma.firmwareVersion.delete({ where: { id } });
      const fullPath = path.join(__dirname, '../../uploads/firmware', fw.filename);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      return reply.send({ success: true });
    } catch (err) {
      return reply.status(500).send({ message: 'فشل الحذف' });
    }
  });
}

export async function handleOTAResult(
  homeId: string,
  mac: string,
  payload: {
    status: 'SUCCESS' | 'FAILED' | 'DOWNLOADING' | 'PENDING';
    version?: string;
    error?: string;
    reason?: string;
  }
) {
  const node = await prisma.node.findFirst({
    where: { homeId, mac }
  });
  
  if (!node) return;
  
  if (payload.status === 'SUCCESS') {
    // Update node firmware version
    await prisma.node.update({
      where: { id: node.id },
      data: { firmware: payload.version }
    });
    
    // Update OTA record
    await prisma.otaUpdate.updateMany({
      where: { controllerId: node.id, status: 'PENDING' },
      data: { 
        status: 'SUCCESS',
        completedAt: new Date()
      }
    });
    
    // Emit to frontend
    server.io?.to(`home:${homeId}`).emit('ota_complete', {
      nodeId: node.id,
      nodeName: node.name,
      version: payload.version,
      message: `تم تحديث ${node.name || 'الجهاز'} بنجاح ✅`
    });
    
    await sendTelegram(`✅ تم تحديث ${node.name || 'الجهاز'} إلى ${payload.version}`);
  } else if (payload.status === 'FAILED') {
    await prisma.otaUpdate.updateMany({
      where: { controllerId: node.id, status: 'PENDING' },
      data: {
        status: 'FAILED',
        completedAt: new Date()
      }
    });
    
    server.io?.to(`home:${homeId}`).emit('ota_failed', {
      nodeId: node.id,
      nodeName: node.name,
      error: payload.error || 'خطأ غير معروف',
      message: `فشل تحديث ${node.name || 'الجهاز'} ❌`
    });
  }
}
