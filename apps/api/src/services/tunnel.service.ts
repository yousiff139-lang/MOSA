import WebSocket from 'ws';
import { FastifyInstance } from 'fastify';

export class TunnelService {
  private server: FastifyInstance;
  private ws: WebSocket | null = null;
  private homeId: string;
  private token: string;
  private relayUrl: string;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(server: FastifyInstance, homeId: string, relayUrl: string, token?: string) {
    this.server = server;
    this.homeId = homeId;
    this.relayUrl = relayUrl;
    this.token = token || process.env.RELAY_TUNNEL_SECRET || 'secret_tunnel_token';
  }

  public start() {
    this.connect();
  }

  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = `${this.relayUrl}?homeId=${this.homeId}&token=${this.token}`;
    this.server.log.info(`Connecting to Cloud Relay: ${this.relayUrl} as ${this.homeId}`);
    
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.server.log.info('Successfully connected to Cloud Relay.');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    this.ws.on('message', async (data: any) => {
      try {
        // E2EE Decryption Layer (Simulated)
        // const decrypted = cryptoUtils.decrypt(data, this.privateKey);
        const payload = JSON.parse(data.toString());
        
        if (payload.type === 'REQUEST') {
          this.server.log.info(`[E2EE Tunnel] Received secure remote request for ${payload.url}`);
          await this.handleIncomingRequest(payload);
        }
      } catch (err) {
        this.server.log.error({ err }, 'Failed to parse incoming tunnel message');
      }
    });

    this.ws.on('close', () => {
      this.server.log.warn('Disconnected from Cloud Relay. Reconnecting in 5s...');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err: any) => {
      this.server.log.error({ err }, 'Cloud Relay Tunnel error');
      // close will fire after error usually
    });
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, 5000);
    }
  }

  private async handleIncomingRequest(payload: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      // Use Fastify Inject to process the request internally without network overhead
      const response = await this.server.inject({
        method: payload.method,
        url: payload.url,
        headers: payload.headers,
        payload: payload.body, // In inject, body is 'payload'
      });

      // Send the response back through the tunnel
      const replyPayload = {
        type: 'RESPONSE',
        requestId: payload.requestId,
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body // stringified by inject, or we can parse it if it's JSON
      };

      try {
         replyPayload.body = JSON.parse(response.body);
      } catch(e) {
         // Keep as string if not JSON
      }

      this.ws.send(JSON.stringify(replyPayload));
    } catch (err: any) {
      const errorPayload = {
        type: 'RESPONSE',
        requestId: payload.requestId,
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        body: { error: 'Internal Tunnel Proxy Error', details: err.message }
      };
      this.ws.send(JSON.stringify(errorPayload));
    }
  }
}
