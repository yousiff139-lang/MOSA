import mqtt, { MqttClient } from 'mqtt';
import fs from 'fs';
import path from 'path';

// Helper to convert MQTT + and # patterns to RegExp
function mqttPatternToRegex(pattern: string): RegExp {
  const regexString = '^' + pattern.replace(/\+/g, '[^/]+').replace(/#/g, '.*') + '$';
  return new RegExp(regexString);
}

export class MQTTService {
  private client: MqttClient | null = null;
  private routes: Array<{ regex: RegExp; callback: (msg: string, topic: string) => void }> = [];
  private subscribedTopics: Set<string> = new Set();
  private connectCallbacks: Array<() => void> = [];
  private isConnecting: boolean = false;
  
  constructor(private brokerUrl: string, private options?: mqtt.IClientOptions) {}

  get isConnected(): boolean {
    return this.client?.connected || false;
  }

  onConnect(cb: () => void) {
    this.connectCallbacks.push(cb);
    if (this.isConnected) {
      try { cb(); } catch (e) { console.error('[MQTT] onConnect callback error:', e); }
    }
  }

  connect(): Promise<void> {
    if (this.client && this.isConnecting) {
      return Promise.resolve();
    }
    this.isConnecting = true;

    return new Promise((resolve) => {
      let tlsOpts: any = {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined
      };
      try {
        const certsDir = fs.existsSync('/app/certs') 
          ? '/app/certs' 
          : fs.existsSync(path.resolve(process.cwd(), '..', '..', 'config', 'certs'))
            ? path.resolve(process.cwd(), '..', '..', 'config', 'certs')
            : path.join(process.cwd(), 'certs');
        const caPath = path.join(certsDir, 'ca.crt');
        const certPath = path.join(certsDir, 'backend.crt');
        const keyPath = path.join(certsDir, 'backend.key');

        if (fs.existsSync(caPath) && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
          tlsOpts.ca = [fs.readFileSync(caPath)];
          tlsOpts.cert = fs.readFileSync(certPath);
          tlsOpts.key = fs.readFileSync(keyPath);
        }
      } catch (e) {
        console.warn('[MQTT Driver] Warning loading TLS certs:', e);
      }

      const opts = { reconnectPeriod: 3000, connectTimeout: 10000, ...tlsOpts, ...this.options };
      this.client = mqtt.connect(this.brokerUrl, opts);

      let initialResolveDone = false;

      this.client.on('connect', () => {
        console.log('[MQTT Driver] Connected to Broker:', this.brokerUrl);
        
        // Resilient Auto-Re-subscribe: Re-subscribe all registered topics whenever connected/reconnected
        for (const topic of this.subscribedTopics) {
          this.client?.subscribe(topic, { qos: 1 }, (err) => {
            if (err) console.error(`[MQTT Driver] Error re-subscribing to ${topic}:`, err);
            else console.log(`[MQTT Driver] Subscribed to ${topic}`);
          });
        }

        // Trigger registered connect callbacks
        for (const cb of this.connectCallbacks) {
          try { cb(); } catch (e) { console.error('[MQTT Driver] Connect callback error:', e); }
        }

        if (!initialResolveDone) {
          initialResolveDone = true;
          resolve();
        }
      });

      this.client.on('error', (err) => {
        console.error(`[MQTT Driver] Connection error (${this.brokerUrl}):`, err.message || err);
        // Do NOT reject or kill client: keep background auto-reconnect alive!
        if (!initialResolveDone) {
          initialResolveDone = true;
          resolve(); // Resolve to allow backend initialization to proceed
        }
      });

      this.client.on('offline', () => console.warn(`[MQTT Driver] Client went offline (${this.brokerUrl})`));
      this.client.on('reconnect', () => console.log(`[MQTT Driver] Client reconnecting to ${this.brokerUrl}...`));

      // Centralized message listener fixing the leak
      this.client.on('message', (topic, msg) => {
        const payload = msg.toString();
        for (const route of this.routes) {
          if (route.regex.test(topic)) {
            try {
              route.callback(payload, topic);
            } catch (cbErr) {
              console.error(`[MQTT Driver] Error in route callback for ${topic}:`, cbErr);
            }
          }
        }
      });

      // Safety timeout: resolve within 2s regardless so server startup never blocks
      setTimeout(() => {
        if (!initialResolveDone) {
          initialResolveDone = true;
          resolve();
        }
      }, 2000);
    });
  }

  subscribe(topic: string, callback: (message: string, actualTopic: string) => void) {
    this.subscribedTopics.add(topic);
    this.routes.push({ regex: mqttPatternToRegex(topic), callback });

    if (this.client && this.client.connected) {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) console.error(`[MQTT Driver] Error subscribing to ${topic}:`, err);
      });
    }
  }

  publish(topic: string, message: string, options?: mqtt.IClientPublishOptions, callback?: (error?: Error) => void) {
    if (!this.client) {
      console.warn(`[MQTT Driver] Cannot publish, client not initialized: ${topic}`);
      if (callback) callback(new Error('Client not initialized'));
      return;
    }
    this.client.publish(topic, message, options || {}, callback);
  }

  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) return resolve();
      this.client.end(false, {}, () => {
        this.client = null;
        this.isConnecting = false;
        resolve();
      });
    });
  }
}
