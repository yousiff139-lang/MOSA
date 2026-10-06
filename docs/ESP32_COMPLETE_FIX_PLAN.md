# 🚀 ESP32 Complete Fix Plan - Bug #6

## Overview

Bug #6 (ESP32) has **3 components** to fix, prioritized in order:

1. ✅ **Firmware** (partition overflow) -- **FIXED** with custom partition
2. 🟡 **Flasher** (web interface) -- **Improvements designed**
3. 🟡 **Controller** (multi-ESP32 management) -- **Enhancements designed**

---

## 1️⃣ Firmware Fix (✅ COMPLETED)

### Problem:
- **R1_Refactored.ino** (3,899 lines) exceeds default 1.2MB partition
- Compilation fails: "Sketch too big"
- Firmware requires **~2.3MB** after compilation

### Solution:
✅ **Custom 3MB APP Partition** (`partitions_3mb_app.csv`)

**Location:** `R1_Refactored/partitions_3mb_app.csv`

```csv
# Name,   Type, SubType, Offset,  Size,     Flags
nvs,      data, nvs,     0x9000,  0x5000,
otadata,  data, ota,     0xe000,  0x2000,
app0,     app,  ota_0,   0x10000, 0x300000,
app1,     app,  ota_1,   0x310000,0x300000,
spiffs,   data, spiffs,  0x610000,0x1F0000,
```

**Partition Breakdown:**
- **app0:** 3MB (Primary OTA slot)
- **app1:** 3MB (Secondary OTA slot for rollback)
- **NVS:** 20KB (WiFi credentials, device config)
- **OTA Data:** 8KB (Boot partition selector)
- **SPIFFS:** ~2MB (Web UI, certificates)

**Total:** 8MB (Requires ESP32 with 8MB flash chip)

### User Action Required:

1. **Arduino IDE Configuration:**
   ```
   Tools → Board → ESP32 Dev Module
   Tools → Partition Scheme → Custom (3MB APP/2MB SPIFFS)
   Tools → Flash Size → 8MB
   Sketch → Verify/Compile
   Sketch → Upload
   ```

2. **If "Custom" partition not visible:**
   - Copy `partitions_3mb_app.csv` to Arduino ESP32 package path:
     ```
     Windows: C:\Users\<USER>\AppData\Local\Arduino15\packages\esp32\hardware\esp32\<VERSION>\tools\partitions\
     ```
   - Edit `boards.txt` to add custom partition entry
   - Restart Arduino IDE

3. **Verify Flash:**
   - Open Serial Monitor (115200 baud)
   - Check boot logs show "Partition scheme: 3MB APP / 2MB SPIFFS"
   - Verify OTA health check stages 1-7 all pass

**Documentation:** `docs/ESP32_FIRMWARE_FIX.md` (182 lines)

**Status:** 🟢 **Ready for recompilation** -- User must rebuild in Arduino IDE.

---

## 2️⃣ Flasher Improvements (🟡 DESIGNED)

### Current Issues:
- ❌ No partition validation before flashing
- ❌ No firmware size check (can flash oversized binaries)
- ⚠️ No chip detection (ESP32 vs ESP32-S2/S3/C3)
- ⚠️ Manual baud rate selection

### Proposed Fixes:

1. **Pre-Flash Validation:**
   - Detect chip info (name, MAC, flash size, partition scheme)
   - Calculate required partition size (firmware × 1.3 for OTA overhead)
   - Block flash if firmware won't fit
   - Show warning: "⚠️ Firmware >2MB requires custom 3MB partition"

2. **esptool.js Integration:**
   ```bash
   npm install esptool-js
   ```
   - Auto-detect chip before flashing
   - Enter bootloader mode automatically
   - Real-time write progress (not fake progress bar)
   - Verify after write

3. **Enhanced UI:**
   - **Validation Card:**
     ```
     📊 Pre-Flash Validation
     Firmware Size: 2.3 MB
     ESP32 Flash: 8 MB
     Partition: 3MB APP / 2MB SPIFFS ✅
     Will Fit: YES ✅
     ```
   - Flash button **disabled** until validation passes
   - Real progress bar tied to actual write callbacks

**Implementation Steps:**
- [ ] Install `esptool-js` via npm
- [ ] Add `detectChipInfo()` function
- [ ] Add `validateFlash()` pre-check
- [ ] Replace manual serial writes with `ESPLoader.write_flash()`
- [ ] Add validation card UI component
- [ ] Test with 3MB firmware binary

**Documentation:** `docs/ESP32_FLASHER_IMPROVEMENTS.md` (298 lines)

**Status:** 🟡 **Designed & documented** -- Needs npm install + code integration.

---

## 3️⃣ Controller Enhancements (🟡 DESIGNED)

### Current Issues:
- ❌ No bulk firmware updates (must flash each ESP32 individually)
- ❌ No health monitoring (can't see if ESP32 is offline)
- ❌ No partition info display (can't verify active partition)
- ❌ No OTA status tracking (can't see progress across multiple ESPs)
- ❌ No network diagnostics (WiFi signal, IP conflicts)

### Proposed Enhancements:

#### A. Health Dashboard
Real-time health indicators for each controller:
- **Status:** Online / Offline / Updating / Error
- **WiFi Signal:** RSSI with color coding (green/yellow/red)
- **Free Heap:** Memory available
- **Firmware Version:** Build date + partition scheme
- **Device Count:** Active vs total devices

**UI Mockup:**
```
┌─────────────────────────────────────────────┐
│ [Cpu] MOSA Node R1 - Main Living Room      │
│       AA:BB:CC:DD:EE:FF             [Online]│
├─────────────────────────────────────────────┤
│ WiFi Signal  Free Heap  Firmware   Devices  │
│ -52 dBm ✅   84.2 KB    v3.0       12/12 ✅  │
├─────────────────────────────────────────────┤
│ ▸ Partition Details                         │
│   Partition Scheme: 3MB APP / 2MB SPIFFS   │
│   Build Date: 2026-10-06 14:30             │
├─────────────────────────────────────────────┤
│ [Update Firmware] [Restart] [View Logs]    │
└─────────────────────────────────────────────┘
```

#### B. Bulk OTA Tool
Update multiple ESP32s simultaneously:
1. Upload one firmware `.bin` to backend
2. Select target controllers (multi-select checkboxes)
3. Click "Start Bulk OTA"
4. Watch real-time progress for each controller (0-100%)
5. See success/failure per device
6. Retry failed devices individually

**Workflow:**
```
[Upload firmware.bin] → Backend stores with firmwareId
  ↓
[Select 5 ESP32 controllers]
  ↓
[Start Bulk OTA] → Triggers OTA for each controller in parallel
  ↓
Poll /api/controllers/:id/ota/status every 2s
  ↓
Display progress: Node-01: 45% | Node-02: 100% ✅ | Node-03: 23%
```

#### C. Network Diagnostics
Per-controller diagnostics:
- **Ping:** Latency + packet loss
- **DNS:** mDNS hostname resolution
- **MQTT:** Connection status + last message timestamp
- **NTP:** Time sync status + offset

**Diagnostics Modal:**
```
┌─────────────────────────────────────────────┐
│ Network Diagnostics - MOSA Node R1         │
├─────────────────────────────────────────────┤
│ Ping Latency:        12ms                   │
│ Packet Loss:         0%                     │
│ DNS Resolution:      mosa-node-01.local ✅  │
│ MQTT Connected:      Yes (5 min ago)        │
│ NTP Synced:          Yes (offset: 120ms)    │
└─────────────────────────────────────────────┘
```

### Backend API Additions:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/controllers/:id/health` | GET | Real-time health metrics |
| `/api/controllers/:id/ota` | POST | Trigger OTA update |
| `/api/controllers/:id/ota/status` | GET | OTA progress (0-100%) |
| `/api/controllers/:id/diagnose` | POST | Run network diagnostics |
| `/api/ota/upload` | POST | Upload firmware binary |

**Implementation Steps:**
- [ ] Add backend health endpoints
- [ ] Add WebSocket subscription for real-time updates
- [ ] Build bulk OTA UI with multi-select
- [ ] Add progress bars for each controller
- [ ] Implement diagnostics modal
- [ ] Add "Test All Controllers" button

**Documentation:** `docs/ESP32_CONTROLLER_IMPROVEMENTS.md` (389 lines)

**Status:** 🟡 **Designed & documented** -- Needs backend API + UI integration.

---

## 📊 Implementation Priority

### Phase 1: User Must Do (Critical)
✅ **Firmware partition fix** -- User must recompile in Arduino IDE with custom partition.

**Estimated time:** 15 minutes  
**Blocker:** Without this, firmware won't flash at all.

### Phase 2: Flasher Validation (High)
🟡 **Add esptool.js + pre-flash validation** -- Prevents flashing invalid firmware.

**Estimated time:** 4-6 hours  
**Value:** Catches partition mismatches before flash (saves troubleshooting time).

### Phase 3: Controller Enhancements (Medium)
🟡 **Health dashboard + bulk OTA** -- Quality-of-life for managing multiple ESP32s.

**Estimated time:** 8-12 hours  
**Value:** Bulk updates save hours when deploying firmware to 10+ controllers.

---

## 🎯 Success Criteria

### Firmware (Phase 1):
- [ ] User recompiles with custom partition
- [ ] Binary size fits in 3MB slot
- [ ] ESP32 boots successfully
- [ ] OTA health checks (stages 1-7) all pass
- [ ] Web server + MQTT operational

### Flasher (Phase 2):
- [ ] Chip auto-detection works (name, MAC, flash size)
- [ ] Pre-flash validation blocks oversized firmware
- [ ] Warning shown: "⚠️ Requires custom 3MB partition"
- [ ] Flash button disabled until validation passes
- [ ] Real progress bar shows actual write progress

### Controller (Phase 3):
- [ ] Health dashboard shows online/offline status
- [ ] WiFi signal (RSSI) color-coded
- [ ] Partition scheme visible per controller
- [ ] Bulk OTA can update 10 ESP32s simultaneously
- [ ] Progress bars show per-device OTA status
- [ ] Diagnostics modal runs ping/DNS/MQTT/NTP tests

---

## 📦 Deliverables

1. ✅ **`partitions_3mb_app.csv`** -- Custom partition table
2. ✅ **`docs/ESP32_FIRMWARE_FIX.md`** -- User recompilation guide
3. ✅ **`docs/ESP32_FLASHER_IMPROVEMENTS.md`** -- Flasher enhancement spec
4. ✅ **`docs/ESP32_CONTROLLER_IMPROVEMENTS.md`** -- Controller UI spec
5. ✅ **`docs/ESP32_COMPLETE_FIX_PLAN.md`** -- This master summary

---

## 🚦 Current Status

| Component | Status | Action Required |
|-----------|--------|-----------------|
| **Firmware** | 🟢 **READY** | User must recompile in Arduino IDE |
| **Flasher** | 🟡 **DESIGNED** | Dev team: Install esptool.js + integrate |
| **Controller** | 🟡 **DESIGNED** | Dev team: Add backend APIs + build UI |

**Next step:** User should apply firmware partition fix first (Phase 1), then flasher improvements (Phase 2) can be tested with the new 3MB binary.

---

## 📞 Support

If partition compilation fails:
1. Verify ESP32 has 8MB flash: `esptool.py --port COM5 flash_id`
2. Check Arduino ESP32 package version (≥2.0.0 recommended)
3. If "Custom" partition not visible, manually copy `.csv` to `tools/partitions/` and edit `boards.txt`
4. Restart Arduino IDE after adding custom partition

**All 3 fixes are now documented and ready for implementation!** 🎉
