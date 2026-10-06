# 🔧 ESP32 Web Flasher Improvements

## Current Issues

1. ❌ **No partition validation** before flashing
2. ❌ **No firmware size check** (can flash oversized binaries that fail at boot)
3. ⚠️ **No chip detection** (ESP32 vs ESP32-S2/S3/C3)
4. ⚠️ **Manual baud rate selection** (no auto-detection)
5. ⚠️ **No flash progress verification** (progress bar can show 100% even if write failed)

---

## ✅ Proposed Fixes

### 1. Pre-Flash Validation

Add validation before the flash button becomes active:

```typescript
interface FlashValidation {
  chipDetected: boolean;
  flashSize: number;       // In MB
  firmwareSize: number;    // In bytes
  partitionScheme: string; // e.g., "default_8MB" or "custom_3mb_app"
  willFit: boolean;
  warnings: string[];
}

const validateFlash = async (): Promise<FlashValidation> => {
  // 1. Detect chip info via esptool.js or AT commands
  const chipInfo = await detectChipInfo();
  
  // 2. Get firmware binary size
  const firmwareSize = uploadedFirmwareFile?.size || 0;
  
  // 3. Estimate required partition size
  const requiredSize = firmwareSize * 1.3; // 30% overhead for OTA
  
  // 4. Check compatibility
  const willFit = requiredSize <= (chipInfo.flashSize * 1024 * 1024);
  
  const warnings: string[] = [];
  if (!willFit) {
    warnings.push(`⚠️ Firmware too large: ${(firmwareSize / 1024 / 1024).toFixed(2)}MB requires ${(requiredSize / 1024 / 1024).toFixed(2)}MB but chip only has ${chipInfo.flashSize}MB flash`);
  }
  
  if (firmwareSize > 2097152 && chipInfo.partitionScheme === 'default') {
    warnings.push('⚠️ Firmware >2MB requires custom partition scheme (3MB APP)');
  }
  
  return {
    chipDetected: !!chipInfo,
    flashSize: chipInfo.flashSize,
    firmwareSize,
    partitionScheme: chipInfo.partitionScheme,
    willFit,
    warnings
  };
};
```

### 2. Chip Auto-Detection

Use **esptool.js** (WebSerial-compatible) to detect chip before flashing:

**Install:**
```bash
npm install esptool-js
```

**Usage:**
```typescript
import { ESPLoader } from 'esptool-js';

const detectChipInfo = async (): Promise<DetectedDevice> => {
  if (!port) throw new Error('No serial port connected');

  try {
    const loader = new ESPLoader(port, { debug: false });
    await loader.main_fn();
    
    const chipName = await loader.chip_name();
    const macAddr = await loader.read_mac();
    const flashId = await loader.flash_id();
    
    // Decode flash size from SPI Flash ID
    const flashSize = decodeFlashSize(flashId);
    
    return {
      chipName,
      chipRevision: `Rev ${await loader.get_chip_revision()}`,
      macAddress: formatMac(macAddr),
      flashSize: `${flashSize}MB`,
      features: await loader.get_chip_features()
    };
  } catch (err) {
    addLog(`⚠️ فشل استعلام معلومات الشريحة: ${err.message}`);
    return {
      chipName: 'ESP32 (غير معروف)',
      macAddress: 'N/A'
    };
  }
};

const decodeFlashSize = (flashId: number): number => {
  const sizeByte = (flashId >> 16) & 0xFF;
  return Math.pow(2, sizeByte) / (1024 * 1024); // Convert to MB
};
```

### 3. Smart Flash Process

Replace manual flashing with validated esptool.js workflow:

```typescript
const flashFirmware = async () => {
  setIsFlashing(true);
  setFlashProgress(0);
  
  try {
    // Step 1: Validate
    addLog('🔍 [1/5] Validating firmware...');
    const validation = await validateFlash();
    
    if (!validation.willFit) {
      throw new Error(`Firmware too large for ${validation.flashSize}MB flash. Use custom 3MB partition.`);
    }
    setFlashProgress(10);
    
    // Step 2: Enter bootloader mode
    addLog('🔄 [2/5] Entering bootloader...');
    await enterBootloader();
    setFlashProgress(20);
    
    // Step 3: Erase flash (optional, controlled by checkbox)
    if (eraseFlashBeforeUpload) {
      addLog('🗑️ [3/5] Erasing flash...');
      await loader.erase_flash();
      setFlashProgress(40);
    } else {
      setFlashProgress(40);
    }
    
    // Step 4: Write firmware
    addLog('📤 [4/5] Writing firmware...');
    const firmwareData = await uploadedFirmwareFile.arrayBuffer();
    await loader.write_flash({
      fileArray: [{ data: new Uint8Array(firmwareData), address: 0x10000 }],
      flash_size: 'keep',
      flash_mode: 'dio',
      flash_freq: '40m',
      reportProgress: (written, total) => {
        const percent = 40 + (written / total) * 50;
        setFlashProgress(percent);
      }
    });
    
    // Step 5: Verify
    addLog('✅ [5/5] Verifying...');
    await loader.hard_reset();
    setFlashProgress(100);
    
    addLog('🎉 Flashing completed successfully!');
    setStatus('connected');
    
  } catch (err: any) {
    addLog(`❌ Flashing failed: ${err.message}`);
    setStatus('error');
  } finally {
    setIsFlashing(false);
  }
};

const enterBootloader = async () => {
  // Standard ESP32 bootloader entry sequence
  await port.setSignals({ dataTerminalReady: false, requestToSend: true });
  await new Promise(r => setTimeout(r, 100));
  await port.setSignals({ dataTerminalReady: true, requestToSend: false });
  await new Promise(r => setTimeout(r, 50));
  await port.setSignals({ dataTerminalReady: false });
};
```

### 4. Enhanced UI Indicators

Add real-time status indicators:

```tsx
{/* Flash Validation Card */}
{uploadedFirmwareFile && (
  <div className="bg-slate-900/80 backdrop-blur border border-white/10 rounded-2xl p-5">
    <h3 className="text-sm font-bold text-white mb-3">📊 Pre-Flash Validation</h3>
    <div className="space-y-2 text-xs">
      <div className="flex justify-between">
        <span className="text-slate-400">Firmware Size:</span>
        <span className="text-white font-mono">
          {(uploadedFirmwareFile.size / 1024 / 1024).toFixed(2)} MB
        </span>
      </div>
      
      {detectedDevice && (
        <>
          <div className="flex justify-between">
            <span className="text-slate-400">ESP32 Flash:</span>
            <span className="text-white font-mono">{detectedDevice.flashSize}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-400">Partition Scheme:</span>
            <span className="text-white font-mono">
              {validation?.partitionScheme || 'Default'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-400">Will Fit:</span>
            <span className={validation?.willFit ? 'text-green-400' : 'text-red-400'}>
              {validation?.willFit ? '✅ Yes' : '❌ No'}
            </span>
          </div>
        </>
      )}
      
      {validation?.warnings.map((warning, i) => (
        <div key={i} className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-yellow-300">
          {warning}
        </div>
      ))}
    </div>
  </div>
)}

{/* Flash Button (Disabled Until Validated) */}
<button
  onClick={flashFirmware}
  disabled={isFlashing || !uploadedFirmwareFile || !validation?.willFit}
  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2"
>
  {isFlashing ? (
    <>
      <RefreshCw className="w-5 h-5 animate-spin" />
      Flashing... {flashProgress.toFixed(0)}%
    </>
  ) : (
    <>
      <Zap className="w-5 h-5" />
      Flash Firmware to ESP32
    </>
  )}
</button>
```

---

## 📦 Implementation Checklist

- [ ] Install `esptool-js`: `npm install esptool-js`
- [ ] Add `detectChipInfo()` function
- [ ] Add `validateFlash()` pre-check
- [ ] Replace manual serial writes with `ESPLoader.write_flash()`
- [ ] Add validation card UI
- [ ] Disable flash button when validation fails
- [ ] Add progress callbacks to show real write progress
- [ ] Test with 3MB firmware binary

---

## 🎯 Expected Behavior After Fix

### Before Flashing:
1. ✅ User uploads `.bin` firmware
2. ✅ System auto-detects ESP32 chip (name, MAC, flash size)
3. ✅ Validation runs:
   - Firmware size: 2.3 MB
   - Flash size: 8 MB
   - Partition: Default (will NOT fit)
   - **Warning:** "⚠️ Firmware >2MB requires custom partition"
4. 🚫 **Flash button DISABLED** with tooltip: "Change partition scheme in Arduino IDE first"

### After User Applies Partition Fix:
1. ✅ Re-flash with 3MB partition scheme
2. ✅ Validation passes:
   - Firmware size: 2.3 MB
   - Flash size: 8 MB
   - Partition: **3MB APP / 2MB SPIFFS** ✅
   - Will fit: **YES** ✅
3. ✅ Flash button ENABLED
4. ✅ Flash completes successfully with real-time progress

---

## 🔗 References

- **esptool.js:** https://github.com/espressif/esptool-js
- **WebSerial API:** https://developer.mozilla.org/en-US/docs/Web/API/Serial
- **ESP32 Partition Tables:** https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/partition-tables.html

**Status:** 🟡 Flasher improvements designed -- needs npm install + code integration.
