import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

function findFirmwareInoPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'R1_Refactored/R1_Refactored.ino'),
    path.resolve(process.cwd(), '../../R1_Refactored/R1_Refactored.ino'),
    path.resolve(process.cwd(), '../R1_Refactored/R1_Refactored.ino'),
    path.resolve(__dirname, '../../../../R1_Refactored/R1_Refactored.ino'),
    path.resolve(__dirname, '../../../R1_Refactored/R1_Refactored.ino'),
    '/app/R1_Refactored/R1_Refactored.ino'
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return null;
}

function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

function parseInoConstants(content: string) {
  const ssidMatch = content.match(/const\s+char\*\s+default_wifi_ssid\s*=\s*"([^"]*)";/);
  const passMatch = content.match(/const\s+char\*\s+default_wifi_pass\s*=\s*"([^"]*)";/);
  const homeMatch = content.match(/const\s+char\*\s+default_home_id\s*=\s*"([^"]*)";/);
  const mqttMatch = content.match(/const\s+char\*\s+default_mqtt_host\s*=\s*"([^"]*)";/);

  return {
    default_wifi_ssid: ssidMatch ? ssidMatch[1] : '',
    default_wifi_pass: passMatch ? passMatch[1] : '',
    default_home_id: homeMatch ? homeMatch[1] : '',
    default_mqtt_host: mqttMatch ? mqttMatch[1] : ''
  };
}

export async function flasherRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // GET /api/flasher/system-config
  server.get('/system-config', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      // 1. Get user homes from DB
      const user = (req as any).user;
      const tenantHomeId = req.tenant?.homeId;
      let homes: Array<{ id: string; name: string; isActive: boolean }> = [];

      try {
        const allHomes = await prisma.home.findMany({
          select: { id: true, name: true }
        });
        homes = allHomes.map((h, i) => ({
          id: h.id,
          name: h.name,
          isActive: tenantHomeId ? h.id === tenantHomeId : (user?.homeId ? h.id === user.homeId : i === 0)
        }));
      } catch (e) {
        homes = [{ id: tenantHomeId || 'c55f83aa-2a04-493b-9301-a29a978d9be5', name: 'My Home', isActive: true }];
      }

      const activeHome = homes.find(h => h.isActive) || homes[0] || { id: tenantHomeId || 'c55f83aa-2a04-493b-9301-a29a978d9be5', name: 'My Home', isActive: true };

      // 2. Get Real Raspberry Pi Host Network IPs & Endpoints
      const rawDetectedIps = getLocalIpAddresses();
      
      // Filter out internal docker bridge IPs (172.18.x, 172.17.x, 127.0.0.1) and outdated laptop IP (192.168.1.103)
      const validLanIps = rawDetectedIps.filter(ip => 
        !ip.startsWith('127.') && 
        !ip.startsWith('172.18.') && 
        !ip.startsWith('172.17.') && 
        ip !== '192.168.1.103'
      );

      // Determine Host Server IP: prioritize real Raspberry Pi IP (SERVER_IP, or default 192.168.1.110)
      const rpiServerIp = (process.env.SERVER_IP && process.env.SERVER_IP !== '192.168.1.103') 
        ? process.env.SERVER_IP 
        : (validLanIps[0] || '192.168.1.110');
        
      const tailscaleDomain = process.env.TAILSCALE_DOMAIN || 'mosa-home.tail01b9ef.ts.net';
      const tailscaleIp = process.env.TAILSCALE_IP || '100.84.195.7';

      // Check incoming request host header (e.g. if accessed via MagicDNS)
      const reqHostHeader = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || '';
      const reqHost = reqHostHeader.split(':')[0];

      // Assemble server IP options
      const serverIpsSet = new Set<string>();
      if (rpiServerIp) serverIpsSet.add(rpiServerIp);
      if (reqHost && reqHost !== 'localhost' && reqHost !== '127.0.0.1' && reqHost !== '192.168.1.103') {
        serverIpsSet.add(reqHost);
      }
      validLanIps.forEach(ip => serverIpsSet.add(ip));
      if (tailscaleDomain) serverIpsSet.add(tailscaleDomain);
      if (tailscaleIp) serverIpsSet.add(tailscaleIp);

      const serverIps = Array.from(serverIpsSet);
      const primaryIp = rpiServerIp;

      // 3. Read current constants from R1_Refactored.ino
      const inoPath = findFirmwareInoPath();
      let currentConstants = {
        default_wifi_ssid: '',
        default_wifi_pass: '',
        default_home_id: activeHome.id,
        default_mqtt_host: primaryIp
      };

      if (inoPath) {
        try {
          const content = fs.readFileSync(inoPath, 'utf8');
          currentConstants = parseInoConstants(content);
          if (currentConstants.default_mqtt_host === '192.168.1.103') {
            currentConstants.default_mqtt_host = primaryIp;
          }
        } catch {}
      }

      return reply.send({
        success: true,
        activeHomeId: activeHome.id,
        activeHomeName: activeHome.name,
        homes,
        serverIps,
        primaryServerIp: primaryIp,
        serverDetails: {
          host: 'mosa-home',
          platform: 'Raspberry Pi 4 (Mosa OS Linux aarch64)',
          lanIp: rpiServerIp,
          tailscaleDomain,
          tailscaleIp,
          mqttPort: 8883,
          mqttTls: true
        },
        mqtt: {
          port: 8883,
          tlsPort: 8883,
          authType: 'mTLS_Identity_Certificates',
          clientIdentity: 'MOSA-ESP-001'
        },
        firmware: {
          inoPathFound: !!inoPath,
          inoRelativePath: 'R1_Refactored/R1_Refactored.ino',
          constants: currentConstants
        }
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message || 'فشل جلب إعدادات الفلاشر التلقائية'
      });
    }
  });

  // POST /api/flasher/inject-firmware
  const injectSchema = z.object({
    wifiSSID: z.string().default(''),
    wifiPass: z.string().default(''),
    homeId: z.string().min(1),
    mqttHost: z.string().min(1)
  });

  server.post('/inject-firmware', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const data = injectSchema.parse(req.body);
      const inoPath = findFirmwareInoPath();

      if (!inoPath) {
        return reply.status(404).send({
          success: false,
          error: 'لم يتم العثور على ملف R1_Refactored.ino في مسار المشروع'
        });
      }

      let content = fs.readFileSync(inoPath, 'utf8');

      // Replace default constants block safely
      const updatedSsid = `const char* default_wifi_ssid   = "${data.wifiSSID}";`;
      const updatedPass = `const char* default_wifi_pass   = "${data.wifiPass}";`;
      const updatedHome = `const char* default_home_id     = "${data.homeId}";`;
      const updatedMqtt = `const char* default_mqtt_host   = "${data.mqttHost}";`;

      content = content.replace(/const\s+char\*\s+default_wifi_ssid\s*=\s*"[^"]*";/, updatedSsid);
      content = content.replace(/const\s+char\*\s+default_wifi_pass\s*=\s*"[^"]*";/, updatedPass);
      content = content.replace(/const\s+char\*\s+default_home_id\s*=\s*"[^"]*";/, updatedHome);
      content = content.replace(/const\s+char\*\s+default_mqtt_host\s*=\s*"[^"]*";/, updatedMqtt);

      fs.writeFileSync(inoPath, content, 'utf8');

      return reply.send({
        success: true,
        message: 'تم حقن وتحديث الثوابت بنجاح داخل كود الفيرموير R1_Refactored.ino!',
        updatedConstants: {
          default_wifi_ssid: data.wifiSSID,
          default_wifi_pass: data.wifiPass,
          default_home_id: data.homeId,
          default_mqtt_host: data.mqttHost
        }
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message || 'فشل حقن الإعدادات في ملف الفيرموير'
      });
    }
  });

  // GET /api/flasher/download-header
  server.get('/download-header', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const q = req.query as any;
      const ssid = q.ssid || '';
      const pass = q.pass || '';
      const homeId = q.homeId || 'home-1';
      const mqttHost = (q.mqttHost && q.mqttHost !== '192.168.1.103') 
        ? q.mqttHost 
        : ((process.env.SERVER_IP && process.env.SERVER_IP !== '192.168.1.103') ? process.env.SERVER_IP : '192.168.1.110');

      const headerContent = `// ============================================================================
// 🚀 MOSA Universal IoT Node - Generated Configuration Header (Constants.h)
// Generated dynamically by MOSA Smart Platform
// ============================================================================

#ifndef MOSA_CONSTANTS_H
#define MOSA_CONSTANTS_H

const char* default_wifi_ssid   = "${ssid}";
const char* default_wifi_pass   = "${pass}";
const char* default_home_id     = "${homeId}";
const char* default_mqtt_host   = "${mqttHost}";

#endif // MOSA_CONSTANTS_H
`;

      reply.header('Content-Type', 'text/x-c++hdr');
      reply.header('Content-Disposition', 'attachment; filename="Constants.h"');
      return reply.send(headerContent);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
