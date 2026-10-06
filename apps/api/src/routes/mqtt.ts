import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const CONFIG_PATH = path.join(__dirname, '../config/mqtt_config.json');

export default async function mqttRoutes(fastify: FastifyInstance) {
  
  // Authenticate Device Connection (EMQX calls this on CONNECT)
  fastify.post('/auth', async (request, reply) => {
    const { clientid, username, password } = request.body as any;
    try {
      if (!clientid || !password) {
        return reply.status(401).send({ result: 'ignore' });
      }

      const credential = await prisma.deviceCredential.findUnique({
        where: { username },
        include: { device: { include: { room: { include: { home: true } } } } }
      });

      if (!credential || !credential.device) {
        fastify.log.warn(`[MQTT Auth] Rejecting unknown username ${username}`);
        return reply.status(401).send({ result: 'deny' });
      }

      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      if (passwordHash !== credential.passwordHash) {
        fastify.log.warn(`[MQTT Auth] Invalid password for username ${username}`);
        return reply.status(401).send({ result: 'deny' });
      }

      fastify.log.info(`[MQTT Auth] Device ${credential.device.id} authenticated successfully`);
      return reply.send({ result: 'allow', is_superuser: false });

    } catch (e) {
      fastify.log.error(e);
      return reply.status(500).send({ result: 'deny' });
    }
  });

  // Access Control (EMQX calls this on PUBLISH / SUBSCRIBE)
  fastify.post('/acl', async (request, reply) => {
    const { clientid, username, topic, access } = request.body as any;
    try {
      const device = await prisma.device.findUnique({
        where: { id: clientid },
        include: { room: true }
      });

      if (!device || !device.room) {
        return reply.status(403).send({ result: 'deny' });
      }

      const homeId = device.room.homeId;
      const expectedPrefix = `mosa/${homeId}/device/${clientid}/`;

      if (!topic.startsWith(expectedPrefix)) {
        fastify.log.warn(`[MQTT ACL] Device ${clientid} attempted escape to ${topic}`);
        return reply.status(403).send({ result: 'deny' });
      }

      if (access === 2) {
        if (topic.endsWith('/state') || topic.endsWith('/telemetry')) {
          return reply.send({ result: 'allow' });
        }
      }

      if (access === 1) {
        if (topic.endsWith('/command') || topic.endsWith('/ota')) {
          return reply.send({ result: 'allow' });
        }
      }

      fastify.log.warn(`[MQTT ACL] Device ${clientid} denied action ${access} on ${topic}`);
      return reply.send({ result: 'deny' });

    } catch (e) {
      fastify.log.error(e);
      return reply.status(500).send({ result: 'deny' });
    }
  });

  // GET /api/mqtt/config
  // Get active broker configuration settings
  fastify.get('/config', { preHandler: [verifyTenant, requireRole(Role.ADMIN)] }, async (request, reply) => {
    let config = {
      brokerUrl: process.env.MQTT_BROKER_URL || 'mqtts://localhost:8883',
      username: process.env.MQTT_USERNAME || '',
      password: '',
      clientId: process.env.MQTT_CLIENT_ID || 'mosa_backend',
      reconnectPeriod: 5000
    };

    if (fs.existsSync(CONFIG_PATH)) {
      try {
        const fileData = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        config.brokerUrl = fileData.brokerUrl || config.brokerUrl;
        if (fileData.options) {
          config.username = fileData.options.username || config.username;
          config.clientId = fileData.options.clientId || config.clientId;
          config.reconnectPeriod = fileData.options.reconnectPeriod || config.reconnectPeriod;
        }
      } catch (e) {
        fastify.log.error(e);
      }
    }

    return reply.send(config);
  });

  // POST /api/mqtt/config
  // Save new broker options and restart fastify.mqtt connection
  fastify.post('/config', { preHandler: [verifyTenant, requireRole(Role.ADMIN)] }, async (request, reply) => {
    const { brokerUrl, username, password, clientId, reconnectPeriod } = request.body as any;

    const newConfig = {
      brokerUrl,
      options: {
        username,
        password,
        clientId: clientId || 'mosa_backend',
        reconnectPeriod: reconnectPeriod ? parseInt(reconnectPeriod, 10) : 5000
      }
    };

    try {
      // Ensure config directory exists
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));

      // 1. Terminate old MQTT Client
      if (fastify.mqtt) {
        fastify.log.info('[MQTT Config] Disconnecting old broker connection...');
        await fastify.mqtt.disconnect();
      }

      // 2. Establish new connection
      const { MQTTService } = await import('@mosa/mqtt');
      const newMqttService = new MQTTService(brokerUrl, newConfig.options);
      await newMqttService.connect();

      // 3. Re-assign globally
      fastify.mqtt = newMqttService;

      // 4. Re-bind telemetries
      const { TelemetryProcessor } = await import('../services/telemetry.processor');
      const Redis = require('ioredis');
      const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      
      TelemetryProcessor.init(
        fastify as any,
        prisma as any,
        redisClient,
        fastify.mqtt,
        (global as any).automationEngine || {}
      );

      return reply.send({ success: true, isConnected: newMqttService.isConnected });
    } catch (e: any) {
      fastify.log.error(e);
      return reply.status(500).send({ error: e.message || 'فشلت عملية حفظ التكوين وإعادة التشغيل' });
    }
  });

  // Fetch recent MQTT logs for dashboard
  fastify.get('/logs', { preHandler: [verifyTenant, requireRole(Role.ADMIN)] }, async (request, reply) => {
    const { MqttService } = await import('../services/mqtt.service');
    return reply.send(MqttService.recentLogs);
  });
}
