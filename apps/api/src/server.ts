import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import fastifySocketIO from 'fastify-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
// SECURITY FIX #20: Removed unused 'xss' import (global sanitizer was already removed)
import { env } from './config/env';
import { setTenantContext } from './middleware/tenant';
import { MQTTService } from '@mosa/mqtt';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import { deviceRoutes } from './routes/devices';
import { controllerRoutes } from './routes/controllers';
import { networkRoutes } from './routes/network';
import { userRoutes } from './routes/users';
import { automationRoutes } from './routes/automations';
import { sceneRoutes } from './routes/scenes';
import { climateRoutes } from './routes/climate';
import { motionRoutes } from './routes/motion';
import { energyRoutes } from './routes/energy';
import { floorplanRoutes } from './routes/floorplan';
import { commandRoutes } from './routes/command';
import { healthRoutes, getSystemMetrics } from './routes/health';
import { settingsRoutes } from './routes/settings';
import { configRoutes } from './routes/config';
import { developerRoutes } from './routes/developer';
import { otaRoutes } from './routes/ota';
import { roomRoutes } from './routes/rooms';
import { AutomationEngine } from './services/automation.engine';
import { PluginEngine } from './services/plugin.engine';
import { initTelegram, sendTelegram } from './services/telegram';
import { versionRoutes } from './routes/version';
import { backupRoutes } from './routes/backups';
import path from 'path';
import discoveryRoutes from './routes/discovery';
import { memberRoutes } from './routes/members';
import brandingRoutes from './routes/branding';
import { invitationRoutes } from './routes/invitations';
import { telemetryRoutes } from './routes/telemetry';
import { provisioningRoutes } from './routes/provisioning';
import { analyticsRoutes } from './routes/analytics';
import { billingRoutes } from './routes/billing';
import mqttRoutes from './routes/mqtt';
import firmwareRoutes from './routes/firmware';
import zigbeeRoutes from './routes/zigbee';
import { ZigbeeService } from './services/zigbee.service';
import { pluginRoutes } from './routes/plugins';
import { voiceRoutes } from './routes/voice';
import { updateRoutes } from './routes/update.routes';
import { chaosRoutes } from './routes/chaos';
import dashboardRoutes from './routes/dashboard';
import oauthRoutes from './routes/oauth';
import alexaRoutes from './routes/alexa';
import googleHomeRoutes from './routes/google-home';
import { aiRoutes } from './routes/ai';
import { securityRoutes } from './routes/security';
import { startCronJobs } from './services/cron';
import { logsRoutes } from './routes/logs';
import { setupRoutes } from './routes/setup';
import { pushRoutes } from './routes/push';
import weatherRoutes from './routes/weather';
import notificationRoutes from './routes/notifications';
import { ttsRoutes } from './routes/tts';
import { irrigationRoutes } from './routes/irrigation';
import { adminRoutes } from './routes/admin';
import { partnerRoutes } from './routes/partner';
import entertainmentRoutes from './routes/entertainment';
import { integrationsRoutes } from './routes/integrations';
import { audioRoutes } from './routes/audio';
import { nfcRoutes } from './routes/nfc';
import { flasherRoutes } from './routes/flasher';
import { MqttService } from './services/mqtt.service';
import { SocketService } from './services/socket.service';
import { TelemetryProcessor } from './services/telemetry.processor';
import { TelemetryBufferService } from './services/telemetry.buffer';

import { DiscoveryEngine } from './services/discovery.engine';
import { ZigbeeEngine } from './services/zigbee.engine';

import { LocalAIService } from './services/ai.service';
import { DiscoveryService } from './services/discovery.service';
import { PredictionEngine } from './services/prediction.service';
import { EnergyEngine } from './services/energy.service';
import { TunnelService } from './services/tunnel.service';

declare module 'fastify' {
  interface FastifyInstance {
    mqtt: MQTTService;
    io: any;
  }
}

import { withTimeout } from './lib/prisma';

const server = fastify({ 
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }, 
  trustProxy: 1,
  ignoreTrailingSlash: true
});
export { server };
const prisma = new PrismaClient().$extends({
  query: {
    device: {
      async findMany({ args, query }: { args: any, query: any }) {
        if (!args.where?.homeId) {
          throw new Error('homeId required for all Device queries');
        }
        return query(args);
      }
    }
  }
}) as unknown as PrismaClient;

export const automationEngine = new AutomationEngine(server);
export const pluginEngine = new PluginEngine(server);
export const discoveryEngine = new DiscoveryEngine(server);
export const zigbeeEngine = new ZigbeeEngine(server);

// Make prisma accessible in routes if needed by decorating or just importing
server.decorate('prisma', prisma);

import fs from 'fs';

const firmwareDir = path.resolve(process.cwd(), 'uploads/firmware');
if (!fs.existsSync(firmwareDir)) {
  fs.mkdirSync(firmwareDir, { recursive: true });
}

server.register(import('@fastify/multipart'), {
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});
server.register(import('@fastify/static'), {
  root: firmwareDir,
  prefix: '/firmware/',
});

const brandsDir = path.join(__dirname, '../../uploads/brands');
if (!fs.existsSync(brandsDir)) {
  fs.mkdirSync(brandsDir, { recursive: true });
}
server.register(import('@fastify/static'), {
  root: brandsDir,
  prefix: '/uploads/brands/',
  decorateReply: false
});

// Secure Origin Validator for CORS (Allows Localhost, Private LAN Subnets, Tailscale *.ts.net, and configured domains)
export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();

    // Localhost & loopback
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;

    // Tailscale MagicDNS / local mDNS
    if (host.endsWith('.ts.net') || host.endsWith('.local')) return true;

    // Private Subnets (192.168.x.x, 10.x.x.x, 172.16-31.x.x, 100.x.x.x Tailscale CGNAT)
    if (
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(host)
    ) {
      return true;
    }

    if (process.env.ALLOWED_ORIGINS) {
      const allowed = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim().toLowerCase());
      if (allowed.includes(origin.toLowerCase()) || allowed.includes(host)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Security Plugins (CORS must be first)
server.register(cors, {
  origin: (origin, cb) => {
    if (isOriginAllowed(origin)) {
      cb(null, true);
    } else {
      cb(new Error('CORS access denied for origin'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});

// Helmet is registered in the plugin below (line 478) with proper CSP config
// Removed duplicate root-level registration

// Global Rate Limiting (2000 req/min for SPA dashboards, localized error)
server.register(rateLimit, {
  global: true,
  max: 2000,
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
  },
  errorResponseBuilder: (req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'تم تجاوز الحد المسموح من الطلبات، يرجى الانتظار دقيقة واحدة.',
    retryAfter: context.after
  })
});

// Strict rate limiting for sensitive authentication routes (20 attempts per 1 minute)
server.addHook('onRoute', (routeOptions) => {
  if (routeOptions.url === '/api/auth/login' || routeOptions.url === '/api/auth/register' || routeOptions.url === '/api/auth/reset-pinCode') {
    routeOptions.config = {
      ...(routeOptions.config || {}),
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
        keyGenerator: (req: any) => (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1',
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'محاولات دخول متكررة، يرجى الانتظار دقيقة واحدة قبل المحاولة مجدداً.'
        })
      }
    };
  }
});

server.get('/health', async (req, reply) => {
  return reply.send({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Export pubClient so it can be used for blacklisting in other files
export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy: () => null,
  reconnectOnError: () => false
});
redisClient.connect().catch(() => {});
const subClient = redisClient.duplicate();
subClient.connect().catch(() => {});
redisClient.on('error', () => {});
subClient.on('error', () => {});

// Security Plugins
server.register(fastifyCookie, {
  secret: env.COOKIE_SECRET,
  parseOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  }
});

server.register(jwt, { 
  secret: env.JWT_SECRET,
  verify: {
    extractToken: (request: any) => {
      if (request.cookies && request.cookies.access_token) {
         return request.cookies.access_token;
      }
      if (request.cookies && request.cookies.token) {
         return request.cookies.token;
      }
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
         return authHeader.substring(7);
      }
      return undefined;
    }
  }
});

// Global hook to check Redis for revoked tokens
server.addHook('preHandler', async (request: any, reply) => {
  let token: string | undefined;
  if (request.cookies && request.cookies.access_token) {
    token = request.cookies.access_token;
  } else if (request.cookies && request.cookies.token) {
    token = request.cookies.token;
  } else {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (token) {
    try {
      if (redisClient.status === 'ready') {
        const isBlacklisted = await Promise.race([
          redisClient.get(`bl_${token}`),
          new Promise((_, reject) => setTimeout(reject, 50))
        ]).catch(() => null);
        if (isBlacklisted) {
          return reply.status(401).send({ error: 'Token has been revoked' });
        }
      }
      
      // Inject Tenant Context if token is valid and contains homeId
      const decoded: any = server.jwt.decode(token);
      if (decoded && decoded.homeId) {
        await setTenantContext(prisma, decoded.homeId).catch(() => {});
      }
    } catch (err) {
      server.log.warn('Redis is offline. Bypassing token blacklist check for high availability.');
    }
  }
});

// Sanitized Production Error Handler (No stack leaks)
server.setErrorHandler((error: any, request, reply) => {
  if (reply.sent) return;
  const statusCode = error.statusCode || 500;
  server.log.error(error);
  if (statusCode >= 500) {
    return reply.status(statusCode).send({
      statusCode,
      error: 'Internal Server Error',
      message: 'حدث خطأ غير متوقع في الخادم، يرجى المحاولة لاحقاً.'
    });
  }
  return reply.status(statusCode).send({
    statusCode,
    error: error.name || 'Error',
    message: error.message || 'بيانات غير صالحة',
    details: error.validation || undefined
  });
});

server.register(fastifySocketIO, {
  cors: {
    origin: (origin: any, callback: any) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Socket.IO CORS origin rejected'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// MQTT Service Init (Strict TLS when CA certificates are available)
let brokerUrl = env.MQTT_BROKER_URL;

const caCandidatePaths = [
  path.resolve(process.cwd(), 'config/certs/ca_chain.crt'),
  path.resolve(process.cwd(), 'config/certs/ca.crt'),
  path.resolve('/app/certs/ca_chain.crt'),
  path.resolve('/app/certs/ca.crt'),
  path.resolve(__dirname, '../../config/certs/ca_chain.crt'),
  path.resolve(__dirname, '../../config/certs/ca.crt')
];

let caCertBuffer: Buffer | undefined;
for (const p of caCandidatePaths) {
  if (fs.existsSync(p)) {
    try {
      caCertBuffer = fs.readFileSync(p);
      break;
    } catch {}
  }
}

let mqttOptions: any = {
  clientId: env.MQTT_CLIENT_ID,
  username: env.MQTT_USERNAME,
  password: env.MQTT_PASSWORD,
  reconnectPeriod: parseInt(env.MQTT_RECONNECT_PERIOD, 10),
  rejectUnauthorized: !!caCertBuffer,
  ...(caCertBuffer ? { ca: caCertBuffer } : {})
};

const mqttConfigPath = path.join(__dirname, 'config/mqtt_config.json');
if (fs.existsSync(mqttConfigPath)) {
  try {
    const fileData = JSON.parse(fs.readFileSync(mqttConfigPath, 'utf-8'));
    brokerUrl = fileData.brokerUrl || brokerUrl;
    if (fileData.options) {
      mqttOptions = { ...mqttOptions, ...fileData.options };
    }
  } catch (e) {
    console.error('Failed to load custom mqtt_config.json file', e);
  }
}

const mqttService = new MQTTService(brokerUrl, mqttOptions);
server.decorate('mqtt', mqttService);

server.register(require('fastify-metrics'), {
  endpoint: '/metrics'
});

server.get('/ping', async (request, reply) => {
  return { status: 'ok' };
});



server.post('/api/devices/reorder', async (request, reply) => {
  const body = request.body as any;
  const items = body?.items || (Array.isArray(body?.orderedIds) ? body.orderedIds.map((id: string, index: number) => ({ id, orderIndex: index })) : null);
  
  if (!Array.isArray(items)) return reply.status(400).send({ error: 'Invalid items or orderedIds payload' });
  
  try {
    await prisma.$transaction(async (tx: any) => {
      for (const item of items) {
        if (item && item.id) {
          const device = await tx.device.findUnique({ where: { id: item.id } });
          if (device) {
            const currentState = (device.state as any) || {};
            await tx.device.update({
              where: { id: item.id },
              data: { state: { ...currentState, orderIndex: item.orderIndex ?? item.order ?? 0 } }
            });
          }
        }
      }
    });
    return reply.send({ success: true });
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: 'Failed to update device order' });
  }
});

server.get('/api/telemetry/history', async (request, reply) => {
  try {
    const [energyLogs, climateLogs] = await Promise.all([
      withTimeout(prisma.energyLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 50
      }), 150).catch(() => [] as any[]),
      withTimeout(prisma.climateLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 50
      }), 150).catch(() => [] as any[])
    ]);

    const latestClimate = ((climateLogs || []) as any[])[0];
    const defaultTemp = latestClimate?.temperature || 24;
    const defaultHum = latestClimate?.humidity || 45;

    const mapped = ((energyLogs || []) as any[]).reverse().map((log: any) => ({
      timestamp: log.timestamp ? new Date(log.timestamp).getTime() : Date.now(),
      temperature: defaultTemp,
      humidity: defaultHum,
      powerUsage: log.powerW || 0,
      totalKWh: 0
    }));

    return reply.send(mapped);
  } catch (error) {
    return reply.send([]);
  }
});


server.register(async function (app) {
  // Application Security Headers
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "wss:", "https:"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"]
      }
    },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    xssFilter: true,
    noSniff: true,
    hidePoweredBy: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });

  app.register(authRoutes, { 
    prefix: '/api/auth',
    config: {
      rateLimit: {
        max: 100,
        timeWindow: '1 minute',
        errorResponseBuilder: function (request: any, context: any) {
          return {
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'محاولات كثيرة، انتظر دقيقة وحاول مجدداً'
          }
        }
      }
    }
  });
  app.register(setupRoutes, { prefix: '/api/setup' });
  // PERFORMANCE FIX #2: Dashboard init endpoint for parallel data loading
  app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  app.register(pushRoutes, { prefix: '/api/push' });
  app.register(provisioningRoutes, { prefix: '/api/provisioning' });
  app.register(deviceRoutes, { prefix: '/api/devices' });
  app.register(commandRoutes, { prefix: '/api/command' });
  app.register(controllerRoutes, { prefix: '/api/controllers' });
  app.register(networkRoutes, { prefix: '/api/network' });
  app.register(aiRoutes, { prefix: '/api/ai' });
  app.register(weatherRoutes, { prefix: '/api/weather' });
  app.register(userRoutes, { prefix: '/api/users' });
  app.register(automationRoutes, { prefix: '/api/automations' });
  app.register(climateRoutes, { prefix: '/api/climate' });
  app.register(motionRoutes, { prefix: '/api/motion' });
  app.register(energyRoutes, { prefix: '/api/energy' });
  app.register(configRoutes, { prefix: '/api/config' });
  app.register(developerRoutes, { prefix: '/api/developer' });
  app.register(floorplanRoutes, { prefix: '/api/floorplan' });
  app.register(settingsRoutes, { prefix: '/api/settings' });
  app.register(telemetryRoutes, { prefix: '/api/telemetry' });
  app.register(logsRoutes, { prefix: '/api/logs' });
  app.register(notificationRoutes, { prefix: '/api/notifications' });
  app.register(securityRoutes, { prefix: '/api/security' });
  app.register(otaRoutes, { prefix: '/api/ota' });
  app.register(irrigationRoutes, { prefix: '/api/irrigation' });
  app.register(healthRoutes, { prefix: '/api/system/health' });
  app.get('/api/system/metrics', async (req, reply) => {
    const metrics = await getSystemMetrics();
    return reply.send(metrics);
  });
  app.register(updateRoutes, { prefix: '/api/system' });
  app.register(versionRoutes, { prefix: '/api/system-release' });
  app.register(roomRoutes, { prefix: '/api/rooms' });
  app.register(analyticsRoutes, { prefix: '/api/analytics' });
  app.register(billingRoutes, { prefix: '/api/billing' });
  app.register(mqttRoutes, { prefix: '/api/mqtt' });
  app.register(firmwareRoutes, { prefix: '/api/firmware' });
  app.register(zigbeeRoutes, { prefix: '/api/zigbee' });
  app.register(entertainmentRoutes, { prefix: '/api/entertainment' });
  // GET /api/csrf
  server.get('/api/csrf', async (req, reply) => {
    try {
      if (typeof (reply as any).generateCsrf === 'function') {
        const token = await (reply as any).generateCsrf();
        return { csrfToken: token };
      }
    } catch {}
    return { csrfToken: 'csrf_disabled_stateless' };
  });

  app.register(alexaRoutes, { prefix: '/api/integrations/alexa' });
  app.register(googleHomeRoutes, { prefix: '/api/integrations/google' });
  app.register(ttsRoutes, { prefix: '/api/tts' });
  app.register(discoveryRoutes, { prefix: '/api' }); // Since the route internally has /discovery/...
  app.register(memberRoutes, { prefix: '/api/homes' }); // e.g. /api/homes/:homeId/members
  app.register(brandingRoutes, { prefix: '/api/branding' });
  app.register(invitationRoutes, { prefix: '/api/invitations' });
  app.register(oauthRoutes, { prefix: '/api/oauth' });
  app.register(adminRoutes, { prefix: '/api/admin' });
  app.register(backupRoutes, { prefix: '/api/admin/backups' });
  app.register(partnerRoutes, { prefix: '/api/partner' });
  app.register(integrationsRoutes, { prefix: '/api/integrations' });
  app.register(entertainmentRoutes, { prefix: '/api/entertainment' });
  app.register(pluginRoutes, { prefix: '/api/plugins' });
  app.register(voiceRoutes, { prefix: '/api/voice' });
  app.register(flasherRoutes, { prefix: '/api/flasher' });
  app.register(chaosRoutes, { prefix: '/api/chaos' });
  app.register(audioRoutes, { prefix: '/api/audio' });
  app.register(nfcRoutes, { prefix: '/api/nfc' });

  app.register((app, opts, done) => {
    sceneRoutes(app, automationEngine);
    done();
  }, { prefix: '/api/scenes' });
});

const start = async () => {
  try {
    await initTelegram();

    startCronJobs(prisma);
    discoveryEngine.start();
    zigbeeEngine.start();
    
    DiscoveryService.start(server);
    PredictionEngine.start();
    EnergyEngine.start();

    const { initMatterBridge } = await import('./services/matter.bridge');
    initMatterBridge().catch(e => console.error('[Matter Bridge] Start error:', e));

    const { initHomeKitBridge } = await import('./services/homekit.bridge');
    initHomeKitBridge(mqttService).catch(e => console.error('[HomeKit Bridge] Start error:', e));

    await server.listen({ port: parseInt(env.PORT, 10), host: '0.0.0.0' });
    console.log(`Server listening at http://0.0.0.0:8080`);

    // Initialize extracted services
    SocketService.init(server, prisma as any, redisClient, mqttService);
    TelemetryProcessor.init(server, prisma as any, redisClient, mqttService, automationEngine);
    TelemetryBufferService.startWorker(prisma as any, redisClient);

    MqttService.init();

    // Start Cloud Relay Tunnel (Assuming this backend is HOME_123 for now)
    const relayUrl = process.env.CLOUD_RELAY_URL || 'ws://localhost:4000';
    const homeId = process.env.HOME_ID || 'HOME_123';
    const tunnel = new TunnelService(server, homeId, relayUrl);
    tunnel.start();

    if (process.env.ENABLE_TELEMETRY_SIMULATION === 'true') {
      server.log.warn('[WARNING] Telemetry simulation is ENABLED! This should NEVER be true in production.');
    } else {
      server.log.info('[Telemetry] Real ESP32 sensors only mode (zero-mock compliant).');
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}
