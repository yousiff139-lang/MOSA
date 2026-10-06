# 🔍 MOSA SMART PLATFORM — FRONTEND ↔ BACKEND GAP MATRIX
**Version:** v3.1.0-Audit  
**Project Owner & Creator:** **MOSA AL-KADHEM**  
**Audit Stage:** Phase 2 — Contract & Realtime Gap Analysis  
**Date:** August 24, 2026  

---

## 1. Feature-by-Feature Contract & Persistence Matrix

| Feature / Domain | Frontend UI (`apps/web`) | Backend API (`apps/api`) | DB Schema & Persistence | Realtime Socket.IO / MQTT | ESP32 Hardware Execution | Gap Analysis & Severity | Action / Status |
|---|---|---|---|---|---|---|---|
| **Device Control (Relay Toggles)** | ✅ Real (`useSmartHomeStore.ts`) | ✅ Real (`/api/devices/:id/toggle`) | ✅ Real (`Device.state.isOn`) | ✅ Real (`device_state_changed`) | ✅ Real (GPIO Pin Write) | None (Operational) | **VERIFIED** |
| **Room Management & CRUD** | ✅ Real (`/rooms`) | ✅ Real (`/api/rooms`) | ✅ Real (`Room` model) | ✅ Real (`room_created/updated`) | N/A (Logical entity) | None (Operational) | **VERIFIED** |
| **Device Reordering Persistence** | ✅ Real (Drag & Drop) | ✅ Real (`/api/devices/reorder`) | ✅ Real (`Device.state.orderIndex`)| ✅ Real (`devices_reordered`) | N/A | None (Operational) | **VERIFIED** |
| **Scene Execution** | ✅ Real (`/scenes`) | ✅ Real (`/api/scenes/:id/execute`)| ✅ Real (`Scene` model) | ✅ Real (`scene_executed`) | ✅ Real (Batch Pin Commands) | None (Operational) | **VERIFIED** |
| **Automation Flow Builder** | ✅ Real (`/automations`) | ✅ Real (`/api/automations`) | ✅ Real (`Automation.flowData`) | ✅ Real (`automation_triggered`) | ✅ Real (Engine Dispatches Pin) | None (Operational) | **VERIFIED** |
| **MOSA Personal AI Chat** | ✅ Real (`/ai`) | ✅ Real (`/api/ai/chat`) | ✅ Real (Dynamic DB Queries) | ✅ Real (`ai_action_lifecycle`) | ✅ Real (Structured Action Relay)| None (Dialect & NLP operational) | **VERIFIED** |
| **Live Telemetry & Energy** | ✅ Real (`/energy`) | ✅ Real (`/api/telemetry/history`)| ✅ Real (`EnergyLog`, `ClimateLog`)| ✅ Real (`telemetry_stream`) | ✅ Real (ACS712 / DHT22 Readings)| None (Zero-mock verified) | **VERIFIED** |
| **Security & PIN Lock** | ✅ Real (`/security`) | ✅ Real (`/api/security/*`) | ✅ Real (`SecurityState`, `Alerts`)| ✅ Real (`security_alert`) | ✅ Real (PIR Motion Pin Interrupt)| None (Operational) | **VERIFIED** |
| **System Backup & Restore** | ✅ Real (`/settings`) | ✅ Real (`/api/config/backup & restore`)| ✅ Real (Atomic Transaction) | ✅ Real (`reload.system`) | N/A | None (Operational) | **VERIFIED** |
| **ESP32 Web Flasher** | ✅ Real (`/flasher`) | ✅ Real (`/api/ota/*`) | ✅ Real (`FirmwareRelease`) | N/A (WebSerial WebAssembly) | ✅ Real (USB WebSerial Flash) | None (Browser WebSerial API) | **VERIFIED** |
| **API Keys Management** | ✅ Real (`/developer`) | ⚠️ Partial (`/api/settings/api-keys`)| ✅ Real (`ApiKey` model) | N/A | N/A | Entropy generated via `Math.random` (**P1**) | **REMEDIATE IN PHASE 4** |
| **Node Crash Logging** | N/A (Firmware hook) | ⚠️ Partial (`/api/telemetry/crash-report`)| ✅ Real (`ActivityLog`) | N/A | ✅ Real (`HTTP POST on reset`) | Logged to `prisma.home.findFirst` (**P2**) | **REMEDIATE IN PHASE 4** |

---

## 2. Summary of Identified Gaps

1. **Gap GAP-01 (`settings.ts:214` - Severity: P1)**: API Key generation uses `Math.random` rather than cryptographic entropy, and falls back to a dummy user ID `'mock-user-id'`.
2. **Gap GAP-02 (`telemetry.ts:81` - Severity: P2)**: Crash reports submitted by ESP32 nodes fall back to `prisma.home.findFirst()` without matching the node's registered `homeId`.
3. **Gap GAP-03 (`developer.ts:36` - Severity: P2)**: Developer simulator broadcast loop queries `prisma.home.findFirst()` rather than the authenticated developer's active tenant home.
