# 🛠️ ESP32 Firmware Partition Overflow Fix

## Problem Summary

The **R1_Refactored.ino** firmware (3,899 lines) exceeds the default 1.2MB app partition and fails to compile with:

```
Sketch too big; see https://docs.espressif.com/projects/esp-idf/en/latest/get-started/get-started-wrover-kit.html
```

The firmware includes heavy libraries:
- ✅ **ArduinoJson** (dynamic allocations)
- ✅ **WebServer** + **WebSocketsServer** (HTTP/WS stack)
- ✅ **PubSubClient** (MQTT)
- ✅ **mbedtls** (mTLS crypto)
- ✅ **Audio.h** (I2S audio engine, disabled by default but still compiled)
- ✅ **Adafruit_SSD1306** (OLED display)
- ✅ **ESP-NOW** mesh protocol
- ✅ **OTA** with 7-stage health checks

---

## ✅ Solution: Custom 3MB App Partition

Create a custom partition table that allocates **3MB for the app** while preserving NVS, OTA, and SPIFFS.

### Step 1: Create Custom Partition Table

**File:** `R1_Refactored/partitions_3mb_app.csv`

```csv
# Name,   Type, SubType, Offset,  Size,     Flags
nvs,      data, nvs,     0x9000,  0x5000,
otadata,  data, ota,     0xe000,  0x2000,
app0,     app,  ota_0,   0x10000, 0x300000,
app1,     app,  ota_1,   0x310000,0x300000,
spiffs,   data, spiffs,  0x610000,0x1F0000,
```

**Breakdown:**
- **NVS:** 20KB @ 0x9000 (WiFi credentials, device config)
- **OTA Data:** 8KB @ 0xe000 (OTA boot partition selector)
- **app0:** **3MB** @ 0x10000 (Primary OTA slot)
- **app1:** **3MB** @ 0x310000 (Secondary OTA slot for rollback)
- **SPIFFS:** ~2MB @ 0x610000 (Web UI assets, certificates)

**Total:** 8MB (ESP32 with 8MB flash required)

---

### Step 2: Arduino IDE Configuration

1. **Open Arduino IDE**
2. **Load firmware:** `File → Open → R1_Refactored.ino`
3. **Select board:**
   - `Tools → Board → ESP32 Arduino → ESP32 Dev Module`
4. **Configure partition:**
   - `Tools → Partition Scheme → Custom (3MB APP/2MB SPIFFS)`
   - If "Custom" is not available, proceed to Step 3
5. **Flash settings:**
   - `Tools → Flash Size → 8MB`
   - `Tools → Upload Speed → 921600`
6. **Compile:** `Sketch → Verify/Compile`

---

### Step 3: Manual Partition Integration (If Custom Not Available)

If Arduino IDE doesn't show the custom partition:

1. **Find Arduino ESP32 package path:**
   - Windows: `C:\Users\<USER>\AppData\Local\Arduino15\packages\esp32\hardware\esp32\<VERSION>\tools\partitions\`
   - macOS: `~/Library/Arduino15/packages/esp32/hardware/esp32/<VERSION>/tools/partitions/`
   - Linux: `~/.arduino15/packages/esp32/hardware/esp32/<VERSION>/tools/partitions/`

2. **Copy custom partition:**
   ```bash
   cp R1_Refactored/partitions_3mb_app.csv <ARDUINO_ESP32_PATH>/tools/partitions/
   ```

3. **Edit `boards.txt`:**
   - File: `<ARDUINO_ESP32_PATH>/boards.txt`
   - Add under `esp32.menu.PartitionScheme`:

   ```ini
   esp32.menu.PartitionScheme.custom_3mb=Custom 3MB APP / 2MB SPIFFS
   esp32.menu.PartitionScheme.custom_3mb.build.partitions=partitions_3mb_app
   esp32.menu.PartitionScheme.custom_3mb.upload.maximum_size=3145728
   ```

4. **Restart Arduino IDE**
5. **Select:** `Tools → Partition Scheme → Custom 3MB APP / 2MB SPIFFS`

---

### Step 4: Verify & Flash

1. **Compile firmware:**
   ```
   Sketch → Verify/Compile
   ```
   ✅ Should succeed with ~2.1MB binary (fits in 3MB)

2. **Flash to ESP32:**
   ```
   Sketch → Upload
   ```
   Or use **MOSA Web Flasher** (after fixing it in Part 2).

3. **Monitor serial output:**
   ```
   Tools → Serial Monitor → 115200 baud
   ```
   ✅ Verify boot logs show successful partition detection.

---

## 🔍 Verification Checklist

After flashing, verify in Serial Monitor (115200 baud):

- [ ] **Partition info logged:** "Partition scheme: 3MB APP / 2MB SPIFFS"
- [ ] **No boot loops** (OTA health check stages 1-7 pass)
- [ ] **WiFi connects** (Stage 3)
- [ ] **MQTT authenticates** (Stage 4)
- [ ] **Web server starts** on port 80
- [ ] **WebSocket server** on port 82
- [ ] **ESP-NOW mesh** initializes (if enabled)

---

## 🚨 Troubleshooting

### Issue: "Flash size mismatch"
**Fix:** Verify actual ESP32 flash chip:
```bash
esptool.py --port COM5 flash_id
```
Ensure output shows **8MB (64Mbit)** flash.

### Issue: "Partition table invalid"
**Fix:** Re-flash partition table manually:
```bash
esptool.py --chip esp32 --port COM5 --baud 460800 write_flash 0x8000 partitions_3mb_app.bin
```
(Generate `.bin` from `.csv` using `gen_esp32part.py` in ESP-IDF).

### Issue: OTA rollback loop after update
**Fix:** The firmware has **7-stage OTA health checks**. If any stage fails, it rolls back to `app1`. Check serial logs for which stage failed:
- **Stage 1:** Boot succeeded
- **Stage 2:** GPIO/I2C peripherals OK
- **Stage 3:** WiFi stable ≥5s
- **Stage 4:** MQTT authenticated
- **Stage 5:** NVS valid
- **Stage 6:** Main loop ticking
- **Stage 7:** Heartbeat ACK from backend

Fix the failing stage and re-deploy.

---

## 📦 Alternative: Modular Firmware (Future)

If 3MB is still insufficient after adding more features:

1. **Disable I2S audio** (already done: `#define ENABLE_I2S_AUDIO false`)
2. **Move to 16MB flash** ESP32 modules
3. **Lazy-load features** via SPIFFS scripts
4. **Split into separate firmwares:**
   - **Core:** GPIO + sensors + automation
   - **Audio:** I2S audio + streaming
   - **Display:** OLED + CAD rendering

---

## ✅ Next Steps

1. ✅ **Apply partition fix** (this document)
2. ⏭️ **Fix Web Flasher** (Part 2: validate ESP32 connection, show partition info)
3. ⏭️ **Fix Controller UI** (Part 3: add bulk firmware updates, health monitoring)

**Status:** 🟢 Partition fix ready -- requires Arduino IDE recompilation by user.
