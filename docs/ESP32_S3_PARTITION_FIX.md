# ESP32-S3 Partition Table Fix for Large Firmware

## Problem
The current firmware binary is **1,318,256 bytes (1.26 MB)** but the partition table only allocates **1,310,720 bytes (1.25 MB)** for the app partition. This causes the flash to fail with:

```
E (242) esp_image: Image length 1318256 doesn't fit in partition length 1310720
```

## Root Cause
The default partition scheme used is **"Default 4MB with spiffs"** which has:
- `app0`: 1.28 MB (0x140000 = 1,310,720 bytes)
- This is too small for the R1_Refactored.ino firmware

## Solution
Use the **"Huge APP (3MB No OTA/1MB SPIFFS)"** partition scheme for ESP32-S3 8MB flash:

### Partition Layout (8MB Flash)
```csv
# Name,   Type, SubType, Offset,  Size, Flags
nvs,      data, nvs,     0x9000,  0x5000,
otadata,  data, ota,     0xe000,  0x2000,
app0,     app,  ota_0,   0x10000, 0x300000,  # 3 MB for app
spiffs,   data, spiffs,  0x310000,0x0F0000,  # 1 MB for filesystem
```

### Flash Addresses
- **Bootloader**: `0x1000` (4 KB)
- **Partition Table**: `0x8000` (32 KB)
- **Boot App**: `0xe000` (8 KB)
- **App Binary**: `0x10000` (starts at 64 KB, 3 MB allocated)
- **SPIFFS**: `0x310000` (1 MB for filesystem)

## How to Generate partitions.bin

### Method 1: Arduino IDE (Recommended)
1. Open `R1_Refactored.ino` in Arduino IDE 2.x
2. Tools → Board → ESP32 Arduino → **ESP32S3 Dev Module**
3. Tools → Flash Size → **8MB (64Mb)**
4. Tools → Partition Scheme → **Huge APP (3MB No OTA/1MB SPIFFS)**
5. Sketch → Export Compiled Binary
6. The files will be in: `R1_Refactored/build/esp32.esp32.esp32s3/`
   - `R1_Refactored.ino.bootloader.bin`
   - `R1_Refactored.ino.partitions.bin` ← **This is what you need**
   - `boot_app0.bin`
   - `R1_Refactored.ino.bin` (main app)

### Method 2: PlatformIO
```ini
[env:esp32-s3-devkitc-1]
platform = espressif32
board = esp32-s3-devkitc-1
framework = arduino
board_build.flash_size = 8MB
board_build.partitions = huge_app.csv
```

### Method 3: esptool.py
```bash
# Create partitions.csv with the layout above, then:
python $IDF_PATH/components/partition_table/gen_esp32part.py partitions.csv partitions.bin
```

## Upload the New Files

Once you have the correct binaries, place them in:
```
apps/api/uploads/firmware/
├── bootloader.bin        (from ESP32-S3 compile)
├── partitions.bin        (huge_app scheme)
├── boot_app0.bin         (from compile)
└── R1_Refactored.ino.bin (your app, now fits!)
```

## Flasher Baud Rate
Also reduce the baud rate to prevent write errors:
- **Current**: 115200 bps (too fast, causes corruption)
- **Recommended**: **460800 bps** for ESP32-S3 (stable)
- **Safe fallback**: 115200 bps (slower but works)

## Verification Checklist
✅ App binary size: **< 3,145,728 bytes** (3 MB)  
✅ Partition scheme: **Huge APP (3MB No OTA/1MB SPIFFS)**  
✅ Flash size: **8MB**  
✅ Chip: **ESP32-S3**  
✅ Baud rate: **460800** or lower  

---

**After applying this fix**, the flash will succeed and the ESP32-S3 will boot correctly.
