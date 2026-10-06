import { FastifyInstance } from 'fastify';
import find from 'local-devices';
import { prisma } from '../lib/prisma';
import { verifyTenant } from '../lib/permissions';

// Cache structure
let scanCache: any = null;
let lastScanTime = 0;
const CACHE_TTL = 60000; // 60 seconds

const ESP_MAC_PREFIXES = ['24:6F:28', '30:AE:A4', 'A4:CF:12', 'B4:E6:2D'];

function guessDeviceType(mac: string, hostname: string): string {
  const upperMac = mac.toUpperCase();
  if (ESP_MAC_PREFIXES.some(prefix => upperMac.startsWith(prefix))) {
    return 'ESP32';
  }
  
  const lowerHost = hostname.toLowerCase();
  if (lowerHost.includes('tv') || lowerHost.includes('samsung') || lowerHost.includes('lg')) {
    return 'Smart TV';
  }
  if (lowerHost.includes('router') || lowerHost.includes('gateway') || lowerHost.includes('tplink')) {
    return 'Router';
  }
  
  return 'Unknown';
}

export async function networkRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  server.get('/scan', async (request, reply) => {
    try {
      const now = Date.now();
      
      // Return cached results if within TTL
      if (scanCache && (now - lastScanTime < CACHE_TTL)) {
        return reply.send({ data: scanCache, cached: true });
      }

      // @ts-ignore
      // local-devices does parallel arp/ping natively in node
      const devices = await find(); 
      
      const existingControllers = await prisma.node.findMany({
        select: { mac: true, name: true }
      });
      const existingMacs = new Set(existingControllers.map(c => c.mac.toUpperCase()));

      const mapped = devices.map((dev: any) => {
        const isRegistered = existingMacs.has(dev.mac.toUpperCase());
        const deviceType = guessDeviceType(dev.mac, dev.name || '');
        
        return {
          ip: dev.ip,
          mac: dev.mac,
          hostname: dev.name || 'Unknown',
          isESP32: deviceType === 'ESP32' || isRegistered,
          deviceType,
          status: isRegistered ? 'REGISTERED' : 'NEW_DEVICE'
        };
      });

      // Update cache
      scanCache = mapped;
      lastScanTime = now;

      return reply.send({ data: mapped, cached: false });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ message: 'حدث خطأ أثناء فحص الشبكة' });
    }
  });
}
