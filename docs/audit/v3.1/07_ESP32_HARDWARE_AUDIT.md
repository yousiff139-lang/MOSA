# ⚡ 07 — ESP32 HARDWARE & FIRMWARE FORENSICS (v3.1)
**Project:** MOSA Smart Platform  
**Creator & Owner:** **MOSA AL-KADHEM**  
**Audit Baseline:** `mosa-v3.1.0`  
**Date:** August 24, 2026  

---

## 1. GPIO Pin Safety Matrix

| Pin | Function | Boot Strap Risk | Firmware Protection | Status |
|---|---|---|---|:---:|
| **GPIO 0** | Boot Mode | High (Pull-down triggers ROM download mode) | Excluded from output GPIO table | ✅ **SAFE** |
| **GPIO 2** | Strapping | Medium (Must float or pull LOW) | Pull-down resistor guard | ✅ **SAFE** |
| **GPIO 4** | Relay 1 | None | Validated relay driver pin | ✅ **SAFE** |
| **GPIO 5** | Relay 2 | None | Validated relay driver pin | ✅ **SAFE** |
| **GPIO 12**| MTDI / VDD | High (Selects flash voltage 1.8V vs 3.3V) | Excluded from boot output pins | ✅ **SAFE** |
| **GPIO 15**| MTDO / Log | High (Must be HIGH on boot) | Excluded from relay outputs | ✅ **SAFE** |

---

## 2. Firmware Operating Safeguards

- **200ms Relay Stagger Delay**: Sequentially staggers relay activation upon power restoration to eliminate household breaker tripping.
- **Hardware Debounce & Refractory Window**: 12ms debounce window and 75ms refractory window prevent electrical switch bouncing.
- **Watchdog Timer**: `esp_task_wdt` resets the system if the loop blocks for longer than 10,000ms.
- **ESP-NOW Fail-Safe Mesh**: Level 2 backup mesh operates over 2.4GHz RF if Wi-Fi infrastructure fails.
- **Clean Credentials**: Fallback credentials are removed from firmware source; provisioning is handled via WebSerial flasher and encrypted NVS.
