# 🏛️ MOSA SMART PLATFORM — ENGINEERING ARCHITECTURE (GROUND TRUTH v1.0)

**Principal Architect:** **MOSA AL-KADHEM**  
**Version:** `1.0 Production Certified`  
**Date:** August 31, 2026  

---

## 1. 🏗️ High-Level System Architecture Diagram

```mermaid
graph TD
    subgraph "Clients & Hardware Tier"
        ESP[ESP32 Smart Boards & Sensors]
        PWA[Web App / Mobile PWA (Simple & Full Mode)]
        ZIG[Zigbee Devices via Zigbee2MQTT]
    end

    subgraph "Edge Gateway & Ingress"
        NGINX[Nginx L7 Reverse Proxy & CSP Guard]
        MOSQ[Mosquitto MQTT Broker (10k Concurrency)]
    end

    subgraph "Core Backend Services"
        API[Fastify API & Automation Engine (Port 8080)]
        WS[Socket.IO Realtime Fan-Out Service]
        TELEMETRY[Telemetry & State Ingestion Processor]
    end

    subgraph "Persistence Tier"
        PG[(PostgreSQL + TimescaleDB Hypertables)]
        REDIS[(Redis Cache & Event Bus)]
    end

    ESP -->|MQTT TCP 1883 / TLS 8883 (Dynamic %u Auth)| MOSQ
    ZIG -->|MQTT Topics| MOSQ
    PWA -->|HTTPS Port 443 / WSS| NGINX
    NGINX -->|Reverse Proxy /api & Socket| API
    MOSQ <-->|State & Command Streams| TELEMETRY
    TELEMETRY -->|ORM Writes (Tenant Scoped)| PG
    TELEMETRY -->|Emit to Home Rooms| WS
    API <-->|Cached State & Rate Limiting| REDIS
    API <-->|Tenant Prisma Client| PG
```

---

## 2. 🔐 Multi-Tenant Identity & Topic Partitioning Model

Every connected device, user, and home belongs to a strictly isolated partition.

### MQTT Topic Grammar:
```text
mosa/<homeId>/device/<deviceId>/state     # Device -> Backend (Telemetry & State)
mosa/<homeId>/device/<deviceId>/command   # Backend -> Device (Actuation)
mosa/<homeId>/controller/<boardId>/heartbeat # ESP32 -> Backend (Keepalive)
mosa/<homeId>/sensor/<sensorId>/telemetry  # Sensor -> TimescaleDB (Time-Series)
mosa/<homeId>/ota/<boardId>/result        # Firmware Update Result
```

### Mosquitto Broker Rule Expansion (`%u`):
```text
pattern readwrite mosa/%u/device/#
pattern readwrite mosa/%u/controller/#
pattern readwrite mosa/%u/sensor/#
pattern readwrite mosa/%u/ota/#
```
* **Authentication:** Device connects with `username = homeId`.
* **Broker Enforcement:** Mosquitto dynamically binds all read/write operations to that exact home partition segment. Any publish to a foreign home is immediately rejected with `rc135 (Not Authorized)` at the network socket layer.

---

## 3. 🛡️ Multi-Tenant Database Isolation (`tenantPrisma.ts`)

Database queries executed by user sessions or device handlers are automatically scoped using Prisma's `$extends` Client Extension.

* **Target Models (18 Protected Entities):** `Device`, `Room`, `Automation`, `Scene`, `Node`, `FloorPlan`, `SecurityAlert`, `Notification`, `EnergyLog`, `ClimateLog`, `ActivityLog`, `Camera`, `Routine`, `AIConversation`, `ApiKey`, `InviteToken`, `SecurityState`, `AuditLog`.
* **Behavior:** Every query automatically injects `where: { homeId }`. If an operation is attempted without a valid tenant context, a fatal exception is raised before SQL execution.

---

## 4. ⚡ Realtime Socket.IO Fan-Out Architecture

1. **Dashboard Subscription:**
   * When a user opens the web or mobile app, the client joins its specific home room: `socket.emit('join:home', user.activeHomeId)`.
2. **State Broadcast:**
   * When an ESP32 changes state, `telemetry.processor.ts` writes to PostgreSQL and immediately dispatches `server.io.to(targetHomeId).emit('devices:update', payload)`.
   * **Isolation Guarantee:** Zero global broadcasts for device states. Only clients joined to `targetHomeId` receive updates.

---

## 5. 🔌 Firmware Architecture (`R1_Refactored.ino` & `hardware/esp32`)

* **Core Runtime:** FreeRTOS dual-core tasks on ESP32 (Core 0: Networking & MQTT / Core 1: GPIO Actuation & Sensors).
* **Storage:** Non-Volatile Storage (NVS) for persistent runtime provisioning (WiFi, homeId, cryptographic credentials).
* **Local Scenes:** `LocalScene` with `uint32_t relayMask` supporting offline actuation for up to 32 independent channels.
* **OTA Security:** Hardware-level MD5 checksum verification (`Update.setMD5`) and signature verification before flashing.
