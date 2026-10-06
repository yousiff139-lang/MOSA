import { FastifyInstance } from 'fastify';
import { FirmwareBuilderService, FirmwareConfig } from '../services/firmware.builder';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import util from 'util';
import { pipeline } from 'stream';
import { PrismaClient } from '@prisma/client';
import { requireRole, Role } from '../lib/permissions';

const pump = util.promisify(pipeline);
const prisma = new PrismaClient();

export default async function firmwareRoutes(fastify: FastifyInstance) {
  
  // Generate C++ Firmware Code (Admin Only)
  fastify.post('/generate', { preHandler: [requireRole(Role.ADMIN)] }, async (request, reply) => {
    try {
      const config = request.body as FirmwareConfig;
      
      // Basic Validation
      if (!config.components || !Array.isArray(config.components)) {
        return reply.status(400).send({ error: 'مكونات الهاردوير غير صحيحة' });
      }

      const cppCode = FirmwareBuilderService.generateCppCode(config);

      return reply.send({
        success: true,
        sourceCode: cppCode,
        message: 'تم توليد كود C++ بنجاح'
      });
      
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'فشل توليد الكود' });
    }
  });

  // OTA Firmware Upload Endpoint (Admin Only)
  fastify.post('/upload', { preHandler: [requireRole(Role.ADMIN)] }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      // Fields from multipart form
      const version = (data.fields.version as any)?.value || '1.0.0';
      const notes = (data.fields.notes as any)?.value || '';
      const targetNodeId = (data.fields.targetNodeId as any)?.value;

      let firmwareDir = path.join(process.cwd(), 'uploads/firmware');
      if (!fs.existsSync(path.dirname(firmwareDir))) {
        firmwareDir = path.join(__dirname, '../../../../uploads/firmware');
      }
      if (!fs.existsSync(firmwareDir)) {
        fs.mkdirSync(firmwareDir, { recursive: true });
      }

      // 🛡️ Path Traversal Defense: Sanitize raw filename before constructing path
      const rawName = data.filename || 'firmware.bin';
      const safeUploadName = rawName.replace(/[^a-zA-Z0-9.\-_]/g, '').replace(/\.+/g, '.');
      const filename = `${Date.now()}_${safeUploadName}`;
      const filePath = path.join(firmwareDir, filename);

      // Save file
      await pump(data.file, fs.createWriteStream(filePath));
      const fileSize = fs.statSync(filePath).size;

      // Calculate SHA-256 Checksum
      const fileBuffer = fs.readFileSync(filePath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      const hexHash = hashSum.digest('hex');

      // Save to DB
      const firmwareVersion = await prisma.firmwareVersion.create({
        data: {
          version,
          filename,
          fileSize,
          filePath: `/api/firmware/${filename}`,
          notes,
          isStable: true,
          signature: {
            create: {
              publicKey: process.env.FIRMWARE_SIGNING_PUBLIC_KEY || 'DEV_UNVERIFIED_KEY',
              signature: hexHash,
              algorithm: 'SHA-256-DIGEST'
            }
          }
        },
        include: { signature: true }
      });

      // If targetNodeId is provided, trigger the OTA via MQTT
      if (targetNodeId) {
        const node = await prisma.node.findUnique({ where: { id: targetNodeId } });
        if (node) {
          // 🛡️ Host Header Injection Defense: Refuse unconfigured BACKEND_URL (Fail-Closed)
          if (!process.env.BACKEND_URL) {
            fastify.log.error('[OTA 🛑] Refusing OTA dispatch: BACKEND_URL environment variable is not configured');
            return reply.status(500).send({
              error: 'Server Misconfiguration',
              message: 'BACKEND_URL must be configured in environment variables to prevent Host header injection'
            });
          }

          // Create OtaUpdate tracking record
          await prisma.otaUpdate.create({
            data: {
              controllerId: node.id,
              versionId: firmwareVersion.id,
              status: 'PENDING'
            }
          });

          const backendBaseUrl = process.env.BACKEND_URL.replace(/\/+$/, '');
          const url = `${backendBaseUrl}/api/firmware/${filename}`;
          const topic = `mosa/${node.homeId}/device/${node.id}/ota/start`;
          const payload = JSON.stringify({
            url,
            hash: hexHash
          });
          await fastify.mqtt.publish(topic, payload);
          fastify.log.info(`[OTA 🛡️] Triggered authenticated update for Node ${node.id} on topic ${topic}`);
        }
      }

      return reply.send({ success: true, firmware: firmwareVersion });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to upload firmware' });
    }
  });

  // Stream / Download Firmware Binary (Public for devices fetching binary)
  fastify.get('/:filename', async (request, reply) => {
    try {
      const { filename } = request.params as { filename: string };
      const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '').replace(/\.+/g, '.');
      
      const candidateDirs = [
        path.join(process.cwd(), 'uploads/firmware'),
        path.join(__dirname, '../../../../uploads/firmware'),
        path.join(__dirname, '../../../uploads/firmware'),
        path.join(process.cwd(), 'firmware')
      ];
      
      let filePath = '';
      for (const dir of candidateDirs) {
        const testPath = path.join(dir, safeFilename);
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          break;
        }
      }
      
      if (!filePath || !fs.existsSync(filePath)) {
        fastify.log.warn({ filename: safeFilename }, '[Firmware OTA] Requested firmware binary not found on disk');
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Firmware binary file not found'
        });
      }
      
      const stat = fs.statSync(filePath);
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Length', stat.size);
      reply.header('Content-Disposition', `attachment; filename="${safeFilename}"`);
      return reply.send(fs.createReadStream(filePath));
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to read firmware file' });
    }
  });

  // List Available Firmware Images (Admin Only)
  fastify.get('/list', { preHandler: [requireRole(Role.ADMIN)] }, async (request, reply) => {
    try {
      const versions = await prisma.firmwareVersion.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      return reply.send({ success: true, versions });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to list firmware' });
    }
  });
}

