# 🗺️ 01 — CURRENT SYSTEM MAP & TOPOLOGY (v3.1)
**Project:** MOSA Smart Platform  
**Creator & Owner:** **MOSA AL-KADHEM**  
**Audit Baseline:** `mosa-v3.1.0`  
**Date:** August 24, 2026  

---

## 1. Component Map

| Component | Responsibility | Entry Point | Exposed Ports | Dependencies | Trust Boundary | Auth Mechanism | Authz / Tenant Scope | Critical Data Handled | Failure Impact |
|---|---|---|---|---|---|---|---|---|---|
| **Next.js Web Frontend** (`apps/web`) | Responsive UI, PWA Dashboard, Real-time Charts, Scene & Relay Controls | `apps/web/src/app/page.tsx` | 3000 (Internal) | React 18, Zustand, Tailwind, Lucide, Next 14 | Untrusted Client Browser | JWT in HttpOnly Cookie / Header | Zustand store + active `homeId` context | UI session state, device views | Client UI outage |
| **Fastify API Backend** (`apps/api`) | Core Business Logic, Multi-Tenant Dispatcher, REST Endpoints, Socket.IO, Automation Engine | `apps/api/src/server.ts` | 8080 (Internal) | Fastify, @fastify/jwt, Prisma, Socket.IO, MQTT.js | Trusted Application Layer | JWT verification + Redis Blacklist | `tenantPrisma.ts` ORM hooks + RBAC (`verifyTenant`) | DB credentials, JWT secrets, user records | API unavailable |
| **PostgreSQL & TimescaleDB** (`mosa-postgres`) | Relational Data Storage, User Sessions, Device Configuration, Time-Series Telemetry | `packages/db/prisma/schema.prisma` | 5432:5432 | PostgreSQL 16, TimescaleDB Hypertables | Trusted Data Layer | DB connection string credentials | Foreign Key cascade + `where: { homeId }` | User hashes, sensor logs, encryption keys | Data persistence loss |
| **Mosquitto MQTT Broker** (`mosa-mosquitto`) | Real-time IoT Device Messaging, Command Dispatch, Telemetry Aggregation, Node Status | `config/mosquitto.conf` | 1883, 8883, 9001 | Eclipse Mosquitto, OpenSSL Certs | Semi-Trusted IoT Transport | Password on TCP 1883, mTLS on Port 8883 | Scoped topic patterns: `mosa/+/device/%c/#` | IoT telemetry, relay actuation commands | IoT control severed |
| **ESP32 Firmware** (`R1_Refactored.ino`) | Physical Relay Actuation, Hardware Switches, Energy & Climate Sensing, Mesh Redundancy | `setup()` and `loop()` | Local LAN | FreeRTOS, PubSubClient, ArduinoJson, NVS | Edge Hardware Layer | API Key, WebSocket PIN, mTLS Client Cert | Hardcoded `homeId` in NVS | Hardware state, WiFi credentials | Relay / sensor failure |
| **Nginx Edge Gateway** (`mosa-nginx`) | HTTPS Termination, Reverse Proxying, WebSocket Upgrades, Security Header Injection | `nginx.conf` | 80:80, 443:443, 8883:8883 | Nginx Alpine, OpenSSL Certs | External Public Perimeter | SSL/TLS Handshake + HSTS + CORS filter | Domain & Header routing to internal containers | External web traffic, TLS streams | Gateway outage |
| **MOSA Personal AI Engine** (`apps/api/src/routes/ai.ts`) | Natural Arabic & Iraqi NLP, Smart Home Commands, Dynamic Telemetry Querying, Scene Execution | `/api/ai/chat` | 8080 (Internal) | OpenAI SDK (Hybrid Fallback), Custom Deterministic NLP | Trusted Application Layer | `verifyTenant` + JWT Authentication | Scoped strictly to authenticated `homeId` | User voice/chat commands | AI chat degraded |
