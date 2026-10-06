import { Bonjour } from 'bonjour-service';
import { FastifyInstance } from 'fastify';

export class DiscoveryService {
  private static bonjour: Bonjour;
  private static discoveredDevices = new Map<string, any>();
  private static server: FastifyInstance;

  static start(server: FastifyInstance) {
    try {
      this.server = server;
      this.bonjour = new Bonjour();
      
      const browser = this.bonjour.find({ type: 'http' });
      
      browser.on('up', (service: any) => {
         const deviceData = {
            name: service.name,
            type: service.type,
            host: service.host,
            port: service.port,
            txt: service.txt,
            discoveredAt: Date.now()
         };
         
         if (!this.discoveredDevices.has(service.name)) {
            this.discoveredDevices.set(service.name, deviceData);
            this.notifyFrontend(deviceData);
         }
      });
      
            // Note: Do not broadcast mosa-mqtt from inside Docker bridge network
       // to avoid advertising internal container IPs (172.18.x.x) to physical LAN nodes.
    } catch (error) {
      console.error('Failed to start Discovery Engine:', error);
    }
  }

  private static notifyFrontend(device: any) {
    if (this.server && this.server.io) {
        this.server.io.emit('notification', {
           id: Math.random().toString(),
           type: 'INFO',
           title: '✨ جهاز جديد متاح (mDNS)',
           message: `تم اكتشاف ${device.name} على الشبكة المحلية. انقر للربط.`,
           read: false,
           timestamp: new Date()
        });
    }
  }

  static getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values());
  }
}
