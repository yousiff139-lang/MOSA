# 🗺️ MOSA SMART PLATFORM — ARCHITECTURE MAP & THREAT MODEL
**Version:** v3.1.0-Audit  
**Project Owner & Creator:** **MOSA AL-KADHEM**  
**Audit Stage:** Phase 0 — Full Architectural Discovery  
**Date:** August 24, 2026  

---

## 1. System Component Architecture Map

| Component | Responsibility | Entry Point | Core Dependencies | Trust Boundary | Auth Boundary | Tenant Boundary | External Exposure | Critical Risks |
|---|---|---|---|---|---|---|---|---|
| **Next.js Web Frontend** (`apps/web`) | User Dashboard, Device Control, Real-time Visualizations, PWA, AI Interface, Web Flasher | `apps/web/src/app/page.tsx` & `layout.tsx` | React 18, Next.js 14, Zustand, Tailwind, Lucide, Recharts | Untrusted Client Browser | JWT in HttpOnly Cookie / Bearer Header | Scoped via Zustand store & active Home context | Port 80/443 via Nginx | XSS in unescaped custom labels, stale cached state |
| **Fastify API Backend** (`apps/api`) | Core Business Logic, Multi-Tenant Dispatcher, REST Endpoints, Socket.IO Server, Cron Jobs | `apps/api/src/server.ts` | Fastify, @fastify/jwt, Prisma ORM, Socket.IO, MQTT.js, Winston, Zod | Core Trusted Application Layer | JWT verification preHandler (`verifyTenant`), RBAC | `getTenantPrisma(homeId)` ORM extension + DB hooks | Internal Docker Port 8080 (Proxied by Nginx) | Unhandled exceptions crashing Fastify, rate-limit starvation |
| **Prisma ORM & PostgreSQL / TimescaleDB** (`packages/db`) | Relational Data Storage, User Sessions, Device Configuration, Time-Series Telemetry | `packages/db/prisma/schema.prisma` | PostgreSQL 16, TimescaleDB Extension | Trusted Internal Data Layer | Database connection string with restricted user | Foreign Key cascade + `where: { homeId }` | Internal Port 5432 (Isolated in Docker network) | Slow unindexed queries, connection pool exhaustion |
| **Mosquitto MQTT Broker** (`config/mosquitto.conf`) | Real-time IoT Device Messaging, Command Dispatch, Telemetry Aggregation, Node Status | `config/mosquitto.conf` & `config/acl.conf` | Eclipse Mosquitto, OpenSSL Certs | Semi-Trusted IoT Transport | Username/Password on TCP 1883, mTLS on Port 8883 | Scoped topic patterns: `mosa/+/device/%c/#` | Ports 1883 (LAN), 8883 (MQTTS), 9001 (WSS) | Overly permissive ACL patterns, cross-node sniffing |
| **ESP32 Firmware** (`R1_Refactored.ino`) | Physical Relay Actuation, Hardware Switches, Energy & Climate Sensing, Mesh Redundancy | `setup()` and `loop()` | ESP32 Arduino Core, PubSubClient, ArduinoJson, ESP-NOW, NVS | Edge Hardware Layer | API Key, WebSocket password, mTLS Client Cert | Hardcoded `homeId` stored in NVS | Local LAN Wi-Fi, ESP-NOW RF Mesh | GPIO strap pin reset, heap fragmentation, blocking loops |
| **Nginx Edge Gateway** (`nginx.conf`) | HTTPS Termination, Reverse Proxying, WebSocket Upgrades, Security Header Injection | `nginx.conf` | Nginx Alpine, OpenSSL Certs | External Public Perimeter | SSL/TLS Handshake + HSTS + CORS filter | Domain & Header routing to internal containers | Ports 80 (HTTP redirect), 443 (HTTPS), 8883 (TLS Stream) | Misconfigured proxy headers, SSL cert expiration |
| **MOSA Personal AI Engine** (`apps/api/src/routes/ai.ts`) | Natural Arabic & Iraqi NLP, Smart Home Commands, Dynamic Telemetry Querying, Scene Execution | `/api/ai/chat` & `/api/ai/recommendations` | OpenAI SDK (Hybrid Fallback), Custom Deterministic NLP | Trusted Application Layer | `verifyTenant` + JWT Authentication | Scoped strictly to authenticated `homeId` | Internal Route `/api/ai/*` | Unvalidated prompt injection, executing actions without verification |
| **Platform Update Controller** (`UpdateManager.ts`) | Signed Binary Verification, Multi-stage State Machine, Health Gate & Auto-Rollback | `apps/api/src/services/UpdateManager.ts` | Ed25519 Signature Verifier, Cron | Trusted Update Subsystem | Super Admin / System Key Requirement | Global System Level | Internal Route `/api/updates/*` | Incomplete rollback during container recreation, broken builds |

---

## 2. Trust Boundary Map

```mermaid
graph TD
    subgraph Untrusted External Zone
        InternetUsers[Internet Client Browsers & PWAs]
        RemoteMobile[Remote Mobile App Users]
    end

    subgraph Perimeter Security Gateway
        NginxGateway[Nginx HTTPS / MQTTS Gateway (443 / 8883)]
        CloudflaredTunnel[Cloudflare Zero-Trust Tunnel]
    end

    subgraph Trusted Application Tier
        FastifyBackend[Fastify Backend API (mosa-backend:8080)]
        NextFrontend[Next.js App Server (mosa-frontend:3000)]
        SocketServer[Socket.IO Realtime Engine]
        AIEngine[MOSA Personal AI Engine]
    end

    subgraph Internal Data Tier
        PostgresDB[(PostgreSQL 16 & TimescaleDB)]
        RedisCache[(Redis In-Memory Cache)]
    end

    subgraph IoT & Edge Hardware Tier
        MosquittoBroker[Mosquitto MQTT Broker (1883 / 8883)]
        ESP32Nodes[ESP32 Smart Nodes & Relays]
        EspNowMesh[ESP-NOW Offline Relay Mesh]
        ZigbeeGateway[Zigbee2MQTT CC2652P Coordinator]
    end

    InternetUsers -->|HTTPS / WSS| NginxGateway
    RemoteMobile -->|Cloudflare Tunnel| CloudflaredTunnel
    CloudflaredTunnel --> NginxGateway
    NginxGateway -->|Reverse Proxy| NextFrontend
    NginxGateway -->|Reverse Proxy| FastifyBackend
    FastifyBackend --> SocketServer
    FastifyBackend --> AIEngine
    FastifyBackend -->|Prisma ORM with Tenant Extension| PostgresDB
    FastifyBackend -->|Token Blacklist / Rate Limit| RedisCache
    FastifyBackend -->|MQTTS Client| MosquittoBroker
    ESP32Nodes -->|MQTT TCP / TLS| MosquittoBroker
    ESP32Nodes -.->|Peer-to-Peer Backup| EspNowMesh
    ZigbeeGateway -->|MQTT| MosquittoBroker
```

---

## 3. Attack Surface Map

1. **Authentication & Session Attack Surface:**
   - Brute force against `/api/auth/login` and PIN codes.
   - Refresh Token replay attacks and session fixation.
   - JWT forgery if secret keys are weak or hardcoded.
2. **API & Multi-Tenant IDOR Attack Surface:**
   - Parameter pollution and query param tampering (`?homeId=...`).
   - Accessing another home's devices, rooms, scenes, or cameras by guessing UUIDs.
   - Malformed payloads injected into Zod schema parsers.
3. **MQTT & IoT Attack Surface:**
   - Subscribing to wildcards (`mosa/#`) from compromised hardware nodes.
   - Spoofing telemetry packets (`mosa/{homeId}/sensor/{nodeId}/telemetry`).
   - Unauthorized relay toggle commands injected over unauthenticated TCP 1883.
4. **Firmware & Hardware Attack Surface:**
   - Boot strap pin glitching causing boot loops or unexpected relay triggers.
   - Flash extraction of WiFi passwords or MQTT secrets if NVS encryption is omitted.
   - Memory buffer exhaustion from oversized MQTT command payloads.
5. **AI Prompt Injection & Command Execution:**
   - Unfiltered user input attempting to bypass RBAC via AI chat prompts.
   - LLM hallucinations executing unconfirmed high-impact actions (e.g., factory reset).

---

## 4. Critical Dependency Graph

- `mosa-frontend` depends on `mosa-backend` (REST & WebSockets).
- `mosa-backend` depends on `mosa-postgres` (Prisma schema), `mosa-mosquitto` (MQTT control), and `mosa-redis` (caching).
- `mosa-nginx` depends on `mosa-frontend`, `mosa-backend`, and `mosa-mosquitto`.
- `mosa-mosquitto` is the single source of truth for IoT hardware status and command distribution.
- `R1_Refactored.ino` depends on Wi-Fi, Mosquitto MQTT, and NVS flash preferences.

---

## 5. Confirmed Strengths vs. Suspicious Areas

### Confirmed Strengths
- ✅ **Prisma Tenant Query Extension (`tenantPrisma.ts`)**: Automatic ORM filtering on `homeId`.
- ✅ **Single-Use Refresh Token Rotation**: Expired / replayed tokens immediately revoked.
- ✅ **Rate Limiting**: Brute-force throttling on auth endpoints (20 req/min).
- ✅ **Zero-Mock AI Telemetry**: Live temperature and energy lookups from PostgreSQL with staleness indicators.
- ✅ **Deterministic Iraqi Dialect NLP**: Fast-path intent matching with structured `MosaActionContract`.
- ✅ **ESP32 Hardware Guards**: Relay debouncing, 200ms stagger delay, and safe GPIO pin table.

### Suspicious Areas Requiring Deeper Phase 1-6 Investigation
- ⚠️ **`config/acl.conf` Generic User Wildcards**: Lines 19-25 grant `topic readwrite mosa/#` to `MOSA-ESP-001` and `mosa_device`. Needs strict client ID binding.
- ⚠️ **`config/mosquitto.conf` Listener 1883**: `allow_anonymous true` without an explicit `acl_file` setting under that listener.
- ⚠️ **`R1_Refactored.ino` Default Credentials**: Fallback credentials in source code must remain empty strings.
- ⚠️ **Watchtower / Update Auto-Rollback**: Container-level rollback is marked SIMULATED due to Docker socket isolation.
