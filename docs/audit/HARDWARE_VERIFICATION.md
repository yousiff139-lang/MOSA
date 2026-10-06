# 🔌 MOSA SMART PLATFORM — HARDWARE & ESP32 VERIFICATION
**Project Owner & Creator:** **MOSA AL-KADHEM**  
**Audit Stage:** Phase 6 — Firmware & Hardware Security Verification  
**Date:** August 24, 2026  

---

## 1. GPIO Pin Safety & Boot Strapping Table

| Pin Number | Usage | Boot-Strap Risk | Protection Implemented in Firmware | Status |
|---|---|---|---|:---:|
| **GPIO 0** | Boot Mode Select | High (Pulls LOW on boot -> Flash Mode) | Excluded from relay output table in `isValidOutputGPIO()` | ✅ **SAFE** |
| **GPIO 2** | Strapping Pin | Medium (Floating during reset) | Validated output with pull-down resistor guard | ✅ **SAFE** |
| **GPIO 4** | Relay Output 1 | None | Safe output pin | ✅ **SAFE** |
| **GPIO 5** | Relay Output 2 | None | Safe output pin | ✅ **SAFE** |
| **GPIO 12** | MTDI Voltage Select | High (Must not pull HIGH on boot) | Excluded from direct relay switching on boot | ✅ **SAFE** |
| **GPIO 15** | MTDO Boot Message | High (Must be HIGH during boot) | Excluded from unsafe output assignments | ✅ **SAFE** |
| **GPIO 16-33** | General Relays / Sensors | None | Validated via `isValidOutputGPIO()` | ✅ **SAFE** |

---

## 2. Firmware Operating Characteristics

- **Staggered Relay Restoration**: 200ms sequential delay between relay state restorations upon power cycle prevents inrush current surges on household circuit breakers.
- **Hardware Debounce**: 12ms switch debounce with a 75ms refractory window eliminates relay chatter.
- **Task Watchdog**: `esp_task_wdt` resets the microcontroller safely if the main loop blocks for more than 10 seconds.
- **ESP-NOW Fail-Safe Mesh**: When Wi-Fi is severed, adjacent nodes forward local scene payloads over peer-to-peer 2.4GHz RF.
- **Clean Credentials**: Fallback passwords in `R1_Refactored.ino` are set to empty strings, enforcing pure NVS and WebSerial provisioning.
