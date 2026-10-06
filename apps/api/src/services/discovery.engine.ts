import { Bonjour } from 'bonjour-service';
import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

export class DiscoveryEngine {
  private server: FastifyInstance;
  private bonjour: Bonjour;
  private discoveredDevices: Map<string, any> = new Map();

  constructor(server: FastifyInstance) {
    this.server = server;
    this.bonjour = new Bonjour();
  }

  public start() {
    this.server.log.info('[Discovery] Starting mDNS/Bonjour network scanner...');

    // Browse for common smart home services
    // _http._tcp usually catches Hue Bridges, Shelly relays, and Apple TVs
    const browser = this.bonjour.find({ type: 'http' });

    browser.on('up', (service) => {
      const macMatch = service.txt && service.txt.mac ? service.txt.mac : null;
      const id = macMatch || crypto.createHash('md5').update(service.host + service.name).digest('hex');

      if (!this.discoveredDevices.has(id)) {
        const deviceData = {
          id,
          name: service.name,
          host: service.host,
          port: service.port,
          type: this.guessDeviceType(service.name),
          discoveredAt: new Date(),
        };

        this.discoveredDevices.set(id, deviceData);
        this.server.log.info(`[Discovery] Found new device: ${service.name} at ${service.host}`);

        // Broadcast to all connected WebSockets
        if (this.server.io) {
          this.server.io.emit('device_discovered', deviceData);
        }
      }
    });

    // Also scan for Google Cast / Apple AirPlay
    this.bonjour.find({ type: 'googlecast' }).on('up', (service) => {
      const id = crypto.createHash('md5').update(service.host + service.name).digest('hex');
      if (!this.discoveredDevices.has(id)) {
        const deviceData = {
          id,
          name: service.name,
          host: service.host,
          type: 'Media Player (Google Cast)',
        };
        this.discoveredDevices.set(id, deviceData);
        if (this.server.io) this.server.io.emit('device_discovered', deviceData);
      }
    });
  }

  private guessDeviceType(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('hue') || lowerName.includes('philips')) return 'Philips Hue Bridge';
    if (lowerName.includes('shelly')) return 'Shelly Relay';
    if (lowerName.includes('apple tv')) return 'Apple TV';
    if (lowerName.includes('roku')) return 'Roku Player';
    return 'Unknown Smart Device';
  }

  public getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values());
  }
}
