# 🎛️ Multi-ESP32 Controller Improvements

## Current State

**File:** `apps/web/src/app/devices/registry/page.tsx`

The controller page (`/devices/registry`) manages registered ESP32 nodes but has limitations:

### ✅ What Works:
- List all registered ESP32 controllers
- Show device count per controller
- Assign devices to specific controllers
- Delete controllers

### ❌ What's Missing:
1. **No bulk firmware updates** (must flash each ESP32 individually)
2. **No health monitoring** (no way to see if an ESP32 is offline)
3. **No partition info display** (can't verify which partition scheme is active)
4. **No OTA status tracking** (can't see OTA progress across multiple ESPs)
5. **No network diagnostics** (WiFi signal, IP conflicts, etc.)

---

## ✅ Proposed Enhancements

### 1. ESP32 Health Dashboard

Add real-time health indicators for each controller:

```typescript
interface ControllerHealth {
  id: string;
  status: 'online' | 'offline' | 'updating' | 'error';
  lastSeen: Date;
  uptime: number; // seconds
  freeHeap: number; // bytes
  rssi: number; // WiFi signal strength
  firmware: {
    version: string;
    partition: string; // e.g., "3MB APP / 2MB SPIFFS"
    buildDate: string;
  };
  devices: {
    total: number;
    active: number;
    errors: number;
  };
}
```

**UI Component:**

```tsx
{controllers.map(ctrl => (
  <div key={ctrl.id} className="bg-slate-900/80 backdrop-blur border border-white/10 rounded-2xl p-5">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Cpu className="w-5 h-5 text-purple-400" />
        <div>
          <h3 className="text-white font-bold">{ctrl.name}</h3>
          <p className="text-xs text-slate-400">{ctrl.macAddress}</p>
        </div>
      </div>
      
      {/* Status Badge */}
      <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
        ctrl.health.status === 'online' ? 'bg-green-500/20 text-green-400' :
        ctrl.health.status === 'updating' ? 'bg-yellow-500/20 text-yellow-400' :
        'bg-red-500/20 text-red-400'
      }`}>
        <Activity className="w-3 h-3" />
        {ctrl.health.status === 'online' ? 'Online' :
         ctrl.health.status === 'updating' ? 'Updating' : 'Offline'}
      </div>
    </div>
    
    {/* Metrics Grid */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
      <div>
        <span className="text-slate-400 block mb-1">WiFi Signal</span>
        <div className="flex items-center gap-1">
          <Wifi className={`w-4 h-4 ${
            ctrl.health.rssi > -60 ? 'text-green-400' :
            ctrl.health.rssi > -75 ? 'text-yellow-400' : 'text-red-400'
          }`} />
          <span className="text-white font-mono">{ctrl.health.rssi} dBm</span>
        </div>
      </div>
      
      <div>
        <span className="text-slate-400 block mb-1">Free Heap</span>
        <span className="text-white font-mono">
          {(ctrl.health.freeHeap / 1024).toFixed(1)} KB
        </span>
      </div>
      
      <div>
        <span className="text-slate-400 block mb-1">Firmware</span>
        <span className="text-white font-mono text-xs">{ctrl.health.firmware.version}</span>
      </div>
      
      <div>
        <span className="text-slate-400 block mb-1">Devices</span>
        <span className="text-white font-mono">
          {ctrl.health.devices.active}/{ctrl.health.devices.total}
        </span>
      </div>
    </div>
    
    {/* Partition Info (Collapsible) */}
    <details className="mt-4">
      <summary className="text-xs text-slate-400 cursor-pointer hover:text-white">
        Partition Details
      </summary>
      <div className="mt-2 p-3 bg-black/30 rounded-lg text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Partition Scheme:</span>
          <span className="text-white font-mono">{ctrl.health.firmware.partition}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Build Date:</span>
          <span className="text-white font-mono">{ctrl.health.firmware.buildDate}</span>
        </div>
      </div>
    </details>
    
    {/* Actions */}
    <div className="flex gap-2 mt-4">
      <button
        onClick={() => triggerOTA(ctrl.id)}
        className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
      >
        <Zap className="w-4 h-4" />
        Update Firmware
      </button>
      
      <button
        onClick={() => restartController(ctrl.id)}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
      
      <button
        onClick={() => viewLogs(ctrl.id)}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg"
      >
        <Terminal className="w-4 h-4" />
      </button>
    </div>
  </div>
))}
```

---

### 2. Bulk Firmware Update Tool

Add a "Bulk OTA" tab to update multiple ESP32s at once:

```tsx
const [selectedControllers, setSelectedControllers] = useState<Set<string>>(new Set());
const [otaProgress, setOtaProgress] = useState<Record<string, number>>({});

const bulkUpdate = async () => {
  const firmwareFile = uploadedFirmwareFile;
  if (!firmwareFile) {
    alert('Please upload a firmware .bin file first');
    return;
  }

  setIsUpdating(true);
  
  // Upload firmware to backend once
  const formData = new FormData();
  formData.append('firmware', firmwareFile);
  
  try {
    const uploadRes = await fetchAuth('/api/ota/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!uploadRes.ok) throw new Error('Failed to upload firmware');
    
    const { firmwareId } = await uploadRes.json();
    
    // Trigger OTA for each selected controller
    const promises = Array.from(selectedControllers).map(async (controllerId) => {
      try {
        const res = await fetchAuth(`/api/controllers/${controllerId}/ota`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firmwareId })
        });
        
        if (!res.ok) throw new Error(`OTA failed for ${controllerId}`);
        
        // Poll for progress
        const interval = setInterval(async () => {
          const statusRes = await fetchAuth(`/api/controllers/${controllerId}/ota/status`);
          if (statusRes.ok) {
            const { progress } = await statusRes.json();
            setOtaProgress(prev => ({ ...prev, [controllerId]: progress }));
            
            if (progress >= 100) {
              clearInterval(interval);
            }
          }
        }, 2000);
        
      } catch (err) {
        console.error(`OTA failed for ${controllerId}:`, err);
      }
    });
    
    await Promise.all(promises);
    
    alert('✅ Bulk OTA completed for all selected controllers!');
    
  } catch (err: any) {
    alert(`❌ Bulk OTA failed: ${err.message}`);
  } finally {
    setIsUpdating(false);
  }
};
```

**UI:**

```tsx
<div className="space-y-3">
  {/* Controller Selection */}
  <div className="bg-slate-900/80 backdrop-blur border border-white/10 rounded-2xl p-5">
    <h3 className="text-sm font-bold text-white mb-3">Select Controllers for Bulk Update</h3>
    <div className="space-y-2">
      {controllers.map(ctrl => (
        <label key={ctrl.id} className="flex items-center gap-3 p-3 bg-black/30 rounded-lg cursor-pointer hover:bg-black/50">
          <input
            type="checkbox"
            checked={selectedControllers.has(ctrl.id)}
            onChange={(e) => {
              const newSet = new Set(selectedControllers);
              if (e.target.checked) {
                newSet.add(ctrl.id);
              } else {
                newSet.delete(ctrl.id);
              }
              setSelectedControllers(newSet);
            }}
            className="w-4 h-4"
          />
          <div className="flex-1">
            <p className="text-white font-bold text-sm">{ctrl.name}</p>
            <p className="text-xs text-slate-400">{ctrl.macAddress}</p>
          </div>
          {otaProgress[ctrl.id] !== undefined && (
            <span className="text-xs text-purple-400 font-mono">
              {otaProgress[ctrl.id]}%
            </span>
          )}
        </label>
      ))}
    </div>
  </div>
  
  {/* Bulk Update Button */}
  <button
    onClick={bulkUpdate}
    disabled={selectedControllers.size === 0 || !uploadedFirmwareFile || isUpdating}
    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2"
  >
    <Zap className="w-5 h-5" />
    {isUpdating
      ? `Updating ${selectedControllers.size} Controller(s)...`
      : `Start Bulk OTA (${selectedControllers.size} selected)`
    }
  </button>
</div>
```

---

### 3. Network Diagnostics

Add a diagnostics panel that runs ping/traceroute tests:

```tsx
const runDiagnostics = async (controllerId: string) => {
  setRunningDiag(true);
  
  try {
    const res = await fetchAuth(`/api/controllers/${controllerId}/diagnose`, {
      method: 'POST'
    });
    
    if (res.ok) {
      const diagnostics = await res.json();
      setDiagResults(diagnostics);
      /*
      Example diagnostics response:
      {
        ping: { latency: 12, packetLoss: 0 },
        dns: { resolved: true, hostname: "mosa-node-01.local" },
        mqtt: { connected: true, lastMessage: "2026-10-06T11:35:00Z" },
        ntp: { synced: true, offset: 120 }
      }
      */
    }
  } catch (err) {
    alert('Diagnostics failed');
  } finally {
    setRunningDiag(false);
  }
};
```

---

### 4. Backend API Additions

Add these endpoints to support the new features:

#### `GET /api/controllers/:id/health`
Returns real-time health metrics (WiFi RSSI, heap, uptime, firmware version).

#### `POST /api/controllers/:id/ota`
Triggers OTA update for a specific controller.
**Body:** `{ firmwareId: string }`

#### `GET /api/controllers/:id/ota/status`
Returns current OTA progress (0-100%).

#### `POST /api/controllers/:id/diagnose`
Runs network diagnostics (ping, DNS, MQTT, NTP).

#### `POST /api/ota/upload`
Uploads a firmware `.bin` file, stores it temporarily, returns `firmwareId`.

---

## 📦 Implementation Checklist

### Phase 1: Health Monitoring
- [ ] Add `GET /api/controllers/:id/health` backend endpoint
- [ ] Implement WebSocket subscription for real-time health updates
- [ ] Add health metrics to UI (RSSI, heap, firmware version)
- [ ] Add "last seen" timestamp to detect offline controllers

### Phase 2: Bulk OTA
- [ ] Add `POST /api/ota/upload` to accept firmware binaries
- [ ] Add `POST /api/controllers/:id/ota` to trigger single OTA
- [ ] Add `GET /api/controllers/:id/ota/status` for progress tracking
- [ ] Build bulk update UI with multi-select checkboxes
- [ ] Add progress bars for each controller during bulk OTA

### Phase 3: Diagnostics
- [ ] Add `POST /api/controllers/:id/diagnose` endpoint
- [ ] Implement ping/traceroute via MQTT commands
- [ ] Display diagnostics results in modal
- [ ] Add "Test All Controllers" button

---

## 🎯 Expected Behavior After Improvements

### Health Dashboard:
- ✅ See all ESP32s at a glance (online/offline/updating)
- ✅ WiFi signal strength color-coded (green/yellow/red)
- ✅ Free heap memory displayed
- ✅ Partition scheme visible ("3MB APP / 2MB SPIFFS")

### Bulk OTA:
- ✅ Select multiple ESP32s
- ✅ Upload one firmware `.bin`
- ✅ Click "Start Bulk OTA"
- ✅ Watch real-time progress for each controller
- ✅ See success/failure per device
- ✅ Failed devices can be retried individually

### Diagnostics:
- ✅ Click "Diagnose" on any controller
- ✅ See ping latency, packet loss
- ✅ Verify DNS resolution (mDNS hostname)
- ✅ Check MQTT connection status
- ✅ Verify NTP time sync

**Status:** 🟡 Controller improvements designed -- needs backend API + UI integration.
