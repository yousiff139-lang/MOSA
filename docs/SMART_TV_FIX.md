# 🎬 Smart TV Section Fix - Bug #5

## Problem Summary

The Smart TV section has **2 main issues**:

### Issue 1: mDNS/SSDP Discovery Not Populating
- ✅ Discovery engine exists (`discovery.engine.ts`)
- ✅ mDNS/Bonjour scanning works
- ❌ **Discovered TVs NOT saved to database**
- ❌ Frontend calls `/api/entertainment/discover` but it only reads from database
- ❌ No scan trigger to populate database with live discoveries

**Root cause:** The discovery engine broadcasts via WebSocket but never writes to `discoveredDevice` table.

### Issue 2: WebSocket TV Control Only Works on Same LAN
- ✅ This is a **network architecture limitation**, not a bug
- ❌ Current documentation doesn't explain this clearly
- ⚠️ Users deploying via Cloudflare Tunnel can't control TVs (TVs unreachable from tunnel)

**Root cause:** WebSocket TV control commands go:
```
Browser → Next.js API → Fastify API → TV IP (e.g., 192.168.1.100)
```

When the API is behind a Cloudflare Tunnel, it can't reach local IPs directly.

---

## ✅ Solution Part 1: Fix Discovery → Database Flow

### Current Flow (Broken):
```
1. DiscoveryEngine.start() → mDNS scan finds TVs
2. Emit 'device_discovered' via WebSocket
3. (No one saves to database)
4. Frontend calls /api/entertainment/discover
5. Query discoveredDevice table → EMPTY ❌
```

### Fixed Flow:
```
1. DiscoveryEngine.start() → mDNS scan finds TVs
2. Emit 'device_discovered' via WebSocket
3. ✅ SAVE to discoveredDevice table immediately
4. Frontend calls /api/entertainment/discover
5. Query discoveredDevice table → Returns TVs ✅
```

---

### Fix #1: Update DiscoveryEngine to Save to Database

**File:** `apps/api/src/services/discovery.engine.ts`

Add Prisma imports and database writes:

```typescript
import { Bonjour } from 'bonjour-service';
import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../lib/prisma'; // Add Prisma

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
    const browser = this.bonjour.find({ type: 'http' });

    browser.on('up', async (service) => { // ← Make async
      const macMatch = service.txt && service.txt.mac ? service.txt.mac : null;
      const id = macMatch || crypto.createHash('md5').update(service.host + service.name).digest('hex');

      if (!this.discoveredDevices.has(id)) {
        const deviceType = this.guessDeviceType(service.name);
        
        const deviceData = {
          id,
          name: service.name,
          host: service.host,
          port: service.port,
          type: deviceType,
          discoveredAt: new Date(),
        };

        this.discoveredDevices.set(id, deviceData);
        this.server.log.info(`[Discovery] Found new device: ${service.name} at ${service.host}`);

        // ✅ NEW: Save to database immediately
        try {
          await prisma.discoveredDevice.upsert({
            where: { id },
            create: {
              id,
              macAddress: macMatch || id,
              ipAddress: service.host || 'unknown',
              deviceType: deviceType,
              components: [
                {
                  name: service.name,
                  type: deviceType,
                  port: service.port || 80,
                  protocol: service.protocol || 'http'
                }
              ]
            },
            update: {
              ipAddress: service.host || 'unknown',
              deviceType: deviceType,
              components: [
                {
                  name: service.name,
                  type: deviceType,
                  port: service.port || 80,
                  protocol: service.protocol || 'http'
                }
              ],
              updatedAt: new Date()
            }
          });
          
          this.server.log.info(`[Discovery] Saved ${deviceType} to database: ${service.name}`);
        } catch (dbErr) {
          this.server.log.error(`[Discovery] Failed to save device to DB:`, dbErr);
        }

        // Broadcast to all connected WebSockets
        if (this.server.io) {
          this.server.io.emit('device_discovered', deviceData);
        }
      }
    });

    // Also scan for Google Cast / Apple AirPlay
    this.bonjour.find({ type: 'googlecast' }).on('up', async (service) => {
      const id = crypto.createHash('md5').update(service.host + service.name).digest('hex');
      if (!this.discoveredDevices.has(id)) {
        const deviceData = {
          id,
          name: service.name,
          host: service.host,
          type: 'Media Player (Google Cast)',
        };
        this.discoveredDevices.set(id, deviceData);
        
        // ✅ Save Google Cast to database
        try {
          await prisma.discoveredDevice.upsert({
            where: { id },
            create: {
              id,
              macAddress: id,
              ipAddress: service.host || 'unknown',
              deviceType: 'Media Player (Google Cast)',
              components: [{ name: service.name, type: 'googlecast' }]
            },
            update: {
              ipAddress: service.host || 'unknown',
              updatedAt: new Date()
            }
          });
        } catch (dbErr) {
          this.server.log.error(`[Discovery] Failed to save Google Cast:`, dbErr);
        }
        
        if (this.server.io) this.server.io.emit('device_discovered', deviceData);
      }
    });

    // ✅ NEW: Also scan for TCL, Samsung, LG specifically
    this.scanForSmartTvs();
  }

  // ✅ NEW: Dedicated Smart TV discovery
  private scanForSmartTvs() {
    // TCL Android TV
    this.bonjour.find({ type: 'googlecast' }).on('up', async (service) => {
      const name = service.name.toLowerCase();
      if (name.includes('tcl') || name.includes('android tv')) {
        const id = crypto.createHash('md5').update(service.host + 'tcl').digest('hex');
        await this.saveTvToDatabase(id, service.name, service.host, 'TCL Android TV', 8008);
      }
    });

    // Samsung Tizen
    this.bonjour.find({ type: 'samsung-tv' }).on('up', async (service) => {
      const id = crypto.createHash('md5').update(service.host + 'samsung').digest('hex');
      await this.saveTvToDatabase(id, service.name, service.host, 'Samsung Smart TV', 8001);
    });

    // LG webOS
    this.bonjour.find({ type: 'webos' }).on('up', async (service) => {
      const id = crypto.createHash('md5').update(service.host + 'lg').digest('hex');
      await this.saveTvToDatabase(id, service.name, service.host, 'LG webOS TV', 3000);
    });
  }

  private async saveTvToDatabase(id: string, name: string, host: string, deviceType: string, port: number) {
    try {
      await prisma.discoveredDevice.upsert({
        where: { id },
        create: {
          id,
          macAddress: id,
          ipAddress: host,
          deviceType,
          components: [{ name, type: deviceType, port }]
        },
        update: {
          ipAddress: host,
          updatedAt: new Date()
        }
      });
      this.server.log.info(`[Discovery] Saved ${deviceType} to database: ${name}`);
    } catch (err) {
      this.server.log.error(`[Discovery] Failed to save ${deviceType}:`, err);
    }
  }

  private guessDeviceType(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('hue') || lowerName.includes('philips')) return 'Philips Hue Bridge';
    if (lowerName.includes('shelly')) return 'Shelly Relay';
    if (lowerName.includes('apple tv')) return 'Apple TV';
    if (lowerName.includes('roku')) return 'Roku Player';
    if (lowerName.includes('tcl')) return 'TCL Smart TV';
    if (lowerName.includes('samsung')) return 'Samsung Smart TV';
    if (lowerName.includes('lg')) return 'LG Smart TV';
    if (lowerName.includes('sony')) return 'Sony Bravia TV';
    return 'Unknown Smart Device';
  }

  public getDiscoveredDevices() {
    return Array.from(this.discoveredDevices.values());
  }
}
```

---

### Fix #2: Add Manual Scan Trigger Endpoint

**File:** `apps/api/src/routes/discovery.ts`

Add a POST endpoint to trigger a fresh scan:

```typescript
import { FastifyInstance } from 'fastify';
import { verifyTenant } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { DiscoveryEngine } from '../services/discovery.engine';

export default async function discoveryRoutes(fastify: FastifyInstance) {
  
  // ✅ NEW: Manual scan trigger
  fastify.post('/discovery/scan', { preHandler: [verifyTenant] }, async (request, reply) => {
    fastify.log.info('[Discovery] Manual scan triggered by user');
    
    const scanner = new DiscoveryEngine(fastify);
    scanner.start();
    
    // Wait 5 seconds for devices to be discovered
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Return discovered devices from database
    const discovered = await prisma.discoveredDevice.findMany({
      where: {
        AND: [
          {
            OR: [
              { deviceType: { contains: 'TV', mode: 'insensitive' } },
              { deviceType: { contains: 'TCL', mode: 'insensitive' } },
              { deviceType: { contains: 'Samsung', mode: 'insensitive' } },
              { deviceType: { contains: 'webOS', mode: 'insensitive' } },
              { deviceType: { contains: 'Cast', mode: 'insensitive' } },
              { deviceType: { contains: 'Apple TV', mode: 'insensitive' } },
              { deviceType: { contains: 'Roku', mode: 'insensitive' } }
            ]
          },
          {
            NOT: [
              { deviceType: { contains: 'ESP', mode: 'insensitive' } },
              { deviceType: { contains: 'Node', mode: 'insensitive' } },
              { deviceType: { contains: 'Relay', mode: 'insensitive' } }
            ]
          }
        ]
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });
    
    return { 
      success: true, 
      message: 'Scan completed',
      devicesFound: discovered.length,
      devices: discovered 
    };
  });

  // Existing GET /discovery/devices route stays unchanged
  fastify.get('/discovery/devices', { preHandler: [verifyTenant] }, async (request, reply) => {
    const devices = await prisma.discoveredDevice.findMany({
      orderBy: { discoveredAt: 'desc' },
      take: 50
    });
    return { data: devices };
  });
}
```

---

### Fix #3: Frontend Manual Scan Button

**File:** `apps/web/src/app/tv/page.tsx`

Update the scan function to call the new endpoint:

```typescript
// Perform Wi-Fi Auto-Discovery Scan (Real Devices Only)
const startWifiDiscovery = async () => {
  setIsScanning(true);
  setDiscoveredTvs([]);
  
  try {
    // ✅ NEW: Call POST /discovery/scan instead of GET /discover
    const res = await fetchAuth('/api/discovery/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await res.json();
    
    if (data?.devices && Array.isArray(data.devices)) {
      setDiscoveredTvs(data.devices);
      showToast(`تم العثور على ${data.devicesFound} جهاز! 📺`);
    } else {
      showToast('لم يتم العثور على أجهزة تلفاز جديدة');
    }
  } catch (e) {
    console.warn('Auto discovery error:', e);
    showToast('فشل البحث التلقائي');
  } finally {
    setTimeout(() => setIsScanning(false), 1200);
  }
};
```

---

## ✅ Solution Part 2: Document Network Limitations

### Issue: Cloudflare Tunnel Can't Reach Local TVs

**Current architecture:**
```
User Browser (anywhere)
  ↓ HTTPS (Cloudflare Tunnel)
Next.js API (anywhere)
  ↓ HTTP
Fastify API (behind tunnel)
  ↓ WebSocket command
TV (192.168.1.100) ← ❌ UNREACHABLE if API is tunneled
```

**Why it fails:**
- Cloudflare Tunnel exposes the API to the internet
- The API server itself can't see local IPs (192.168.x.x)
- TV control requires **LAN connectivity**

### Solution Options:

#### Option A: LAN-Only Deployment (Recommended)
Deploy MOSA API on the **same network** as your TVs:
- ✅ Full TV control works
- ✅ No tunnel needed for home use
- ❌ Not accessible from outside home (use VPN for remote access)

#### Option B: Hybrid (Tunnel + Local Agent)
Keep Cloudflare Tunnel for remote access, but add a **local relay agent**:
```
User Browser (anywhere)
  ↓ HTTPS (Cloudflare Tunnel)
Next.js API (anywhere)
  ↓ MQTT command
Local MOSA Agent (on home network)
  ↓ WebSocket
TV (192.168.1.100) ✅ WORKS
```

The local agent subscribes to MQTT commands and forwards them to TVs.

#### Option C: Document Limitation
Add clear warning in UI:
```tsx
{/* Warning Banner */}
{isTunneledDeployment && (
  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
      <div>
        <h4 className="text-yellow-300 font-bold mb-1">تنبيه: التحكم عن بُعد غير متاح</h4>
        <p className="text-sm text-yellow-200/80">
          التحكم بالشاشات الذكية يعمل فقط عندما تكون على نفس الشبكة المحلية (Wi-Fi).
          إذا كنت تستخدم Cloudflare Tunnel أو Tailscale، استخدم VPN أو انشر MOSA محلياً.
        </p>
      </div>
    </div>
  </div>
)}
```

---

## 📦 Implementation Checklist

### Phase 1: Fix Discovery → Database (High Priority)
- [ ] Update `discovery.engine.ts` to save to database
- [ ] Add `POST /discovery/scan` endpoint
- [ ] Update frontend to call new scan endpoint
- [ ] Test: Run scan, verify `discoveredDevice` table populated
- [ ] Test: Frontend shows discovered TVs immediately

### Phase 2: Document Network Limitation (Medium Priority)
- [ ] Add network architecture diagram to docs
- [ ] Add warning banner to TV page when tunneled
- [ ] Document VPN/LAN-only deployment requirement
- [ ] Add FAQ: "Why can't I control my TV remotely?"

### Phase 3: Optional Local Agent (Low Priority)
- [ ] Design MQTT-to-WebSocket relay agent
- [ ] Package as standalone Node.js script
- [ ] Document setup in `DEPLOYMENT.md`

---

## 🎯 Success Criteria

### Discovery Fix:
- [ ] Click "Scan for TVs" button
- [ ] Wait 5 seconds
- [ ] See discovered TVs in modal (TCL, Samsung, LG, etc.)
- [ ] Click "Pair" on a TV
- [ ] TV saved to devices table
- [ ] TV appears in device list
- [ ] Can control TV via remote (on same LAN)

### Documentation:
- [ ] User understands TV control requires LAN connectivity
- [ ] Warning shown when deployed via tunnel
- [ ] VPN setup documented as workaround
- [ ] No user confusion about "TV not responding"

---

## 🚨 Troubleshooting

### "No TVs found after scan"
**Cause:** TVs not on same subnet, mDNS blocked, or TVs don't broadcast mDNS.

**Fix:**
1. Verify TV is on same Wi-Fi network as API server
2. Check router firewall (allow mDNS port 5353)
3. Use **Manual IP Add** feature (already works!)
4. Try IP range scan: `POST /api/entertainment/scan-range` (future enhancement)

### "TV paired but doesn't respond to commands"
**Cause:** API server behind Cloudflare Tunnel can't reach TV's local IP.

**Fix:**
1. Deploy API on LAN (not tunneled)
2. Use VPN to access from outside
3. Implement local relay agent (Option B above)

### "TV disappears after reboot"
**Cause:** Dynamic IP changed (DHCP lease expired).

**Fix:**
1. Set **static IP** for TV in router DHCP settings
2. Or use hostname (e.g., `tcl-living-room.local`) instead of IP
3. Add periodic re-discovery cron job to update IPs

---

## 📊 Current Status

| Component | Status | Action |
|-----------|--------|--------|
| **Discovery Engine** | 🟡 **Works but doesn't save** | Add database writes |
| **Scan Endpoint** | ❌ **Missing** | Add `POST /discovery/scan` |
| **Frontend Scan** | 🟡 **Calls wrong endpoint** | Update to use new endpoint |
| **Network Docs** | ❌ **Not documented** | Add LAN requirement to docs |
| **Manual IP Add** | ✅ **Already works** | No fix needed |

**Priority:** Fix discovery → database flow first (Phase 1). Network limitation is documented, not a code bug.

---

## ✅ Quick Fix Summary

**What's broken:**
- Discovery finds TVs but doesn't save to database
- Frontend reads empty database

**The fix:**
1. Add `prisma.discoveredDevice.upsert()` to `discovery.engine.ts`
2. Add `POST /discovery/scan` endpoint
3. Update frontend to call new endpoint
4. Document that TV control requires LAN connectivity

**Estimated time:** 2-3 hours

**Status:** 🟢 **Fix designed & ready for implementation**
