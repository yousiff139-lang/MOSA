import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import os from 'os';

export async function adminRoutes(server: FastifyInstance) {
  // In a real app, protect this with a SUPER_ADMIN role check
  server.get('/stats', async (req, reply) => {
    try {
      // 1. Get total users, homes, devices
      const totalUsers = await prisma.user.count();
      const totalHomes = await prisma.home.count();
      const totalDevices = await prisma.device.count();

      // 2. Calculate mock MRR (Monthly Recurring Revenue) based on premium homes
      // Assuming 10% of homes are premium at $10/mo
      const premiumHomes = Math.floor(totalHomes * 0.1);
      const mrr = premiumHomes * 10;

      // 3. Get OS metrics
      const cpus = os.cpus();
      const load = os.loadavg();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();

      return reply.send({
        metrics: {
          totalUsers,
          totalHomes,
          totalDevices,
          mrr
        },
        server: {
          cpuLoad: load[0], // 1 min load average
          cpuCount: cpus.length,
          memoryUsagePercent: ((totalMem - freeMem) / totalMem) * 100,
          uptimeSeconds: os.uptime()
        }
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ message: 'Failed to fetch global stats' });
    }
  });

  // Mock endpoint for OTA firmware blast
  server.post('/ota/blast', async (req, reply) => {
    try {
      // In reality, you'd save the uploaded .bin file to an S3 bucket
      const firmwareUrl = "http://api.mosa.com/firmware/v2.bin";
      
      // Broadcast to ALL devices (Wildcard MQTT publish)
      // "mosa/+/device/+/command" is not valid for publish in MQTT, 
      // so we would loop over active homes or publish to a dedicated global broadcast topic: "mosa/broadcast/ota"
      await server.mqtt.publish("mosa/broadcast/ota", JSON.stringify({
        action: "FIRMWARE_UPDATE",
        url: firmwareUrl,
        version: "v2.0.0"
      }));

      return reply.send({ message: "OTA Blast Command Issued to all 10,000 devices." });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ message: 'Failed to issue OTA blast' });
    }
  });

  // --- Supervisor Proxy Routes ---

  const SUPERVISOR_URL = process.env.SUPERVISOR_URL || 'http://localhost:9001';
  const SUPERVISOR_SECRET = process.env.SUPERVISOR_SECRET || 'mosa-super-secret-key-123';

  server.get('/supervisor/health', async (req, reply) => {
    try {
      const response = await fetch(`${SUPERVISOR_URL}/api/health`, {
        headers: { 'Authorization': `Bearer ${SUPERVISOR_SECRET}` }
      });
      const data = await response.json();
      return reply.send(data);
    } catch (error: any) {
      return reply.status(503).send({ message: 'Supervisor is offline or unreachable' });
    }
  });

  server.post('/supervisor/backup', async (req, reply) => {
    try {
      const response = await fetch(`${SUPERVISOR_URL}/api/backup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPERVISOR_SECRET}` }
      });
      const data = await response.json();
      return reply.status(response.status).send(data);
    } catch (error: any) {
      return reply.status(503).send({ message: 'Supervisor is offline or unreachable' });
    }
  });

  server.post<{ Params: { name: string } }>('/supervisor/containers/:name/restart', async (req, reply) => {
    try {
      const response = await fetch(`${SUPERVISOR_URL}/api/containers/${req.params.name}/restart`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPERVISOR_SECRET}` }
      });
      const data = await response.json();
      return reply.status(response.status).send(data);
    } catch (error: any) {
      return reply.status(503).send({ message: 'Supervisor is offline or unreachable' });
    }
  });
}
