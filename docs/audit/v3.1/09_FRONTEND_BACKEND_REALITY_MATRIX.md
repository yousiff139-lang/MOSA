# 🌐 09 — FRONTEND ↔ BACKEND REALITY MATRIX (v3.1)
**Project:** MOSA Smart Platform  
**Creator & Owner:** **MOSA AL-KADHEM**  
**Audit Baseline:** `mosa-v3.1.0`  
**Date:** August 24, 2026  

---

## 1. Complete Feature Reality Matrix

| Feature | Frontend UI Route | Backend API Route | Database Model | Realtime Transport | Execution Status |
|---|---|---|---|---|:---:|
| **Device Toggle** | `useSmartHomeStore.ts` | `POST /api/devices/:id/toggle` | `Device.state` | Socket.IO + MQTT | **REAL** |
| **Device Reordering** | `/dashboard` (Drag & Drop) | `POST /api/devices/reorder` | `Device.state.orderIndex` | Socket.IO | **REAL** |
| **Room Management** | `/rooms` | `GET/POST /api/rooms` | `Room` model | REST + Socket.IO | **REAL** |
| **Scene Execution** | `/scenes` | `POST /api/scenes/:id/execute` | `Scene` model | REST + MQTT | **REAL** |
| **Automation Rules** | `/automations` | `GET/POST /api/automations` | `Automation` model | Engine Hook | **REAL** |
| **Personal AI** | `/ai` | `POST /api/ai/chat` | Dynamic DB queries | Socket.IO Stream | **REAL** |
| **Live Telemetry** | `/energy`, `/climate` | `GET /api/telemetry/history` | `EnergyLog`, `ClimateLog` | Socket.IO | **REAL** |
| **Security & PIN** | `/security` | `POST /api/security/*` | `SecurityAlert`, `User` | Socket.IO | **REAL** |
| **Backup / Restore**| `/settings` | `GET/POST /api/config/backup & restore`| `prisma.$transaction` | Atomic Transaction | **REAL** |
| **WebSerial Flasher**| `/flasher` | `GET /api/ota/*` | `FirmwareRelease` | WebSerial API | **REAL** |
| **Cryptographic API Keys**| `/developer` | `POST /api/settings/api-keys` | `ApiKey` model | REST | **REAL** |
| **Node Crash Diagnostic**| Firmware hook | `POST /api/telemetry/crash-report` | `ActivityLog` | REST | **REAL** |
| **System Update** | `/settings` | `GET /api/system/version` | `SystemRelease` | Software Update | **REAL** |
