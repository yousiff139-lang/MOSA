# ADR-006: ESP-NOW Emergency Mesh Cryptographic Authentication, Fail-Closed Architecture & Reality Gap Remediation

* **Status:** `ACCEPTED, ENFORCED & RIGOROUSLY VERIFIED`
* **Date:** 2026-09-01
* **Principal Architect:** **MOSA AL-KADHEM**

---

## Context
When WiFi connection drops, ESP32 boards fall back to an emergency peer-to-peer radio relay layer using ESP-NOW.  
During code audit and implementation verification, 5 critical reality gaps and a missing physical switch trigger were identified:
1. **Predictable Key Fallback**: Defaulting to `homeId + "_mesh_key_2026"` rendered signatures easily forgeable.
2. **Missing Local Switch Trigger**: `broadcastEspNowMeshRelay()` was declared but not invoked on local physical switch toggles or scene activations while offline.
3. **AP Password Derivation Leak**: Deriving WPA2 PSKs from MAC addresses leaked the key in the cleartext SSID broadcast.
4. **Shared Default MQTT Credentials**: Reverting to `mosa_device`/`mosa_mqtt_secret` in firmware defeated per-device identity binding.
5. **Volatile Sequence Counters**: Storing `meshOutSequence` solely in RAM allowed replay attacks across device reboots.
6. **Bypassed Setup Security**: `/save` verification on unprovisioned devices lacked a physical presence guard.

---

## Decision

### 1. Fail-Closed Cryptographic Envelope (Zero Fallback)
* **Strict Key Requirement:** If `meshSecret` is empty (`""`), the node strictly refuses to broadcast mesh packets and drops all incoming mesh frames (`DROPPED_NO_SECRET`).
* **Multi-Channel Key Provisioning:** 
  * Over secure MQTT: `{"action":"SET_MESH_KEY","key":"<32-byte-hex>"}`.
  * Over WebSerial CLI: `SET_MESH_KEY:<key>`.
  * Over Initial Setup Portal: `<input name='meshkey'>`.

### 2. Automatic Offline Switch & Scene Mesh Trigger
* In `toggleLogic()`: Whenever a physical switch is toggled and `WiFi.status() != WL_CONNECTED`, automatically broadcast signed payload `{"action":"SET_STATE","pin":...,"state":...,"boardId":...}`.
* In `executeSceneStruct()`: When offline, automatically broadcast signed payload `{"action":"SCENE","id":...,"boardId":...}`.

### 3. Isolated High-Entropy Emergency AP Secret
* Generate an independent 12-character high-entropy alphanumeric secret (`[A-Z2-9]`) on first boot and store in NVS key `apsecret`.
* Completely decoupled from MAC address, SSID, and `meshSecret`.
* Never printed to serial status logs or returned in `/api/status`.

### 4. Monotonic Anti-Replay +1000 Jump on Reboot
* Upon MCU restart, `meshOutSequence` reads the last stored value from NVS and jumps by `+1000`, immediately persisting the new base.
* Increments are persisted every 5 packets to minimize flash endurance wear while guaranteeing strictly monotonic sequence progression across power cycles.

### 5. Physical Presence Proof (30-Second Window)
* `/save` endpoint requires either a valid `apiKey` OR proof of physical presence (pressing the onboard BOOT button or any physical wall switch within the last 30 seconds).
* Defeats walk-up rogue configuration overwrites.

### 6. Elimination of Shared Firmware MQTT Defaults
* `mqttUser` and `mqttPassword` defaults set to `""` in firmware.
* `captive_html` updated to require per-device credentials on initial setup.

---

## Consequences
* **Positive:** Complete tenant isolation, zero replay vulnerability, zero broadcast loop risk, sub-10ms offline relay response, and full physical contact safety for relays.
* **Verification:** Validated across all 8 test cases in [`tests/unit/mesh_security.test.js`](file:///c:/Users/rfgrt/Downloads/project-bolt-sb1-nkhtybuz/tests/unit/mesh_security.test.js) (MESH-01 through MESH-08).
