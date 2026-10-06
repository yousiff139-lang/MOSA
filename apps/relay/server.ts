import Fastify from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const server = Fastify({ logger: true });

// homeId -> WebSocket connection of the local backend
const homeTunnels = new Map<string, WebSocket>();

// Track pending requests: requestId -> fastify reply object
const pendingRequests = new Map<string, any>();

// Initialize WebSocket server directly on Fastify's HTTP server
server.ready(err => {
  if (err) throw err;

  const wss = new WebSocketServer({ server: server.server });

  wss.on('connection', (ws, request) => {
    // Determine if this is a Home Backend connecting or a generic client
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const homeId = url.searchParams.get('homeId');
    const token = url.searchParams.get('token');

    if (homeId && token) {
      const expectedToken = process.env.RELAY_TUNNEL_SECRET;
      if (!expectedToken || token !== expectedToken) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      homeTunnels.set(homeId, ws);
      server.log.info(`Home Backend ${homeId} connected to Cloud Relay.`);

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === 'RESPONSE' && data.requestId) {
            const reply = pendingRequests.get(data.requestId);
            if (reply) {
              reply
                .code(data.statusCode || 200)
                .headers(data.headers || {})
                .send(data.body);
              pendingRequests.delete(data.requestId);
            }
          }
        } catch (e) {
          server.log.error({ err: e }, 'Failed to parse tunnel message');
        }
      });

      ws.on('close', () => {
        homeTunnels.delete(homeId);
        server.log.info(`Home Backend ${homeId} disconnected.`);
      });
    }
  });
});

// Proxy Route: The mobile app will send requests here
// e.g. POST /proxy/HOME_123/api/devices
server.all('/proxy/:homeId/*', async (request, reply) => {
  const { homeId } = request.params as { homeId: string };
  
  const tunnel = homeTunnels.get(homeId);
  if (!tunnel || tunnel.readyState !== WebSocket.OPEN) {
    return reply.status(502).send({ error: 'Home backend is offline or disconnected from relay.' });
  }

  const requestId = uuidv4();
  
  // Strip the /proxy/:homeId part to get the actual path
  const path = request.url.replace(`/proxy/${homeId}`, '');

  const payload = {
    type: 'REQUEST',
    requestId,
    method: request.method,
    url: path,
    headers: request.headers,
    body: request.body
  };

  // Wait for the home backend to respond
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, reply);

    // Timeout after 15 seconds
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reply.status(504).send({ error: 'Gateway Timeout' });
        resolve(null);
      }
    }, 15000);

    tunnel.send(JSON.stringify(payload));
  });
});

server.get('/health', async () => {
  return { status: 'ok', connectedHomes: homeTunnels.size };
});

// ==========================================
// VOICE ASSISTANT TUNNEL (Google Home / Alexa)
// ==========================================

// 1. OAuth2 Authorization Endpoint
server.get('/oauth/authorize', async (request, reply) => {
  // ⚠️ SECURITY WARNING: This is a MOCK implementation
  // Real authentication REQUIRED before production use
  // See docs/RELAY_OAUTH_FIX.md for proper implementation
  server.log.warn('[SECURITY] Mock OAuth authorize endpoint called - INSECURE!');
  
  const query = request.query as any;
  // In production, render a login page and redirect back with a code
  // For now, we auto-authorize (mock)
  const redirectUri = query.redirect_uri;
  const state = query.state;
  const authCode = 'mock_auth_code_' + uuidv4();
  
  return reply.redirect(`${redirectUri}?code=${authCode}&state=${state}`);
});

// 2. OAuth2 Token Endpoint
server.post('/oauth/token', async (request, reply) => {
  // ⚠️ SECURITY WARNING: This returns MOCK tokens with no authentication
  // Real token exchange REQUIRED before production use
  // See docs/RELAY_OAUTH_FIX.md for proper implementation
  server.log.warn('[SECURITY] Mock OAuth token endpoint called - INSECURE!');
  
  // In production, exchange auth code for access & refresh tokens via DB
  return {
    token_type: 'Bearer',
    access_token: 'mock_access_token_' + uuidv4(),
    refresh_token: 'mock_refresh_token_' + uuidv4(),
    expires_in: 3600
  };
});

// 3. Smart Home Fulfillment Endpoint
server.post('/smarthome', async (request, reply) => {
  const body = request.body as any;
  // Get homeId from the user associated with the Bearer token
  // For this implementation, we assume a single home 'HOME_123' or pass it in headers
  const homeId = request.headers['x-home-id'] as string || 'HOME_123';
  
  const tunnel = homeTunnels.get(homeId);
  if (!tunnel || tunnel.readyState !== WebSocket.OPEN) {
    server.log.error(`Home ${homeId} offline during voice command`);
    return reply.status(502).send({ error: 'Home is offline' });
  }

  const requestId = uuidv4();
  const payload = {
    type: 'REQUEST',
    requestId,
    method: 'POST',
    url: '/api/smarthome/fulfill', // The local backend will handle the translation
    headers: request.headers,
    body: request.body
  };

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, reply);
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reply.status(504).send({ error: 'Gateway Timeout' });
        resolve(null);
      }
    }, 15000);
    tunnel.send(JSON.stringify(payload));
  });
});

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 4000;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Cloud Relay listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
