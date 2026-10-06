# 🎯 03 — ATTACK SURFACE & THREAT MODEL (v3.1)
**Project:** MOSA Smart Platform  
**Creator & Owner:** **MOSA AL-KADHEM**  
**Audit Baseline:** `mosa-v3.1.0`  
**Date:** August 24, 2026  

---

## 1. Attack Vectors & Defensive Controls

```
                                  [ INTERNET ]
                                       │
                                       ▼ (Port 80 / 443 / 8883)
                    ┌─────────────────────────────────────┐
                    │     NGINX EDGE GATEWAY (mosa-nginx)  │
                    │  - HSTS, X-Frame DENY, XSS Headers  │
                    │  - HTTPS Termination (TLS 1.2/1.3)  │
                    └──────────────────┬──────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────┐                         ┌───────────────────────────┐
│ NEXT.JS APP (mosa-frontend)│                         │ FASTIFY API (mosa-backend)│
│ - Zero SSR Token Leakage  │                         │ - Strict Zod Validation   │
│ - Strict CSP Directives   │                         │ - Rate Limit: 20 req/min  │
│ - Scoped Zustand State    │                         │ - Redis Token Blacklist   │
└───────────────────────────┘                         │ - tenantPrisma ORM Hooks  │
                                                      └─────────────┬─────────────┘
                                                                    │
                                    ┌───────────────────────────────┼───────────────────────────────┐
                                    ▼                               ▼                               ▼
                      ┌───────────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────┐
                      │ TIMESCALEDB (mosa-postgres│   │ REDIS CACHE (mosa-redis)  │   │ MOSQUITTO (mosa-mosquitto)│
                      │ - Foreign Key Cascades    │   │ - In-Memory Blacklist     │   │ - Dynamic %c / %u ACLs    │
                      │ - where: { homeId } Filter│   │ - Socket.IO Adapter       │   │ - Port 1883 ACL Enforced  │
                      └───────────────────────────┘   └───────────────────────────┘   └─────────────┬─────────────┘
                                                                                                    │
                                                                                                    ▼ (MQTTS / TCP)
                                                                                      ┌───────────────────────────┐
                                                                                      │ ESP32 SMART NODES (Nodes) │
                                                                                      │ - Safe GPIO Pin Table     │
                                                                                      │ - NVS Encrypted Storage   │
                                                                                      │ - 200ms Relay Stagger     │
                                                                                      └───────────────────────────┘
```

---

## 2. Threat Vector Surface Table

| Attack Vector | Threat Scenario | Mitigation Implemented & Verified |
|---|---|---|
| **Brute Force Login** | Attacker floods `/api/auth/login` with guessed PINs | Global rate limit on login endpoint throttles requests to 20 req/min with HTTP 429. |
| **Token Hijacking & Replay** | Attacker intercepts an old refresh token | Single-use rotation revokes session immediately on reuse; token hashes stored in PostgreSQL. |
| **IDOR / Cross-Tenant Injection** | Attacker modifies `?homeId=...` in API query | `tenantPrisma.ts` ORM extension automatically enforces `where: { homeId: req.tenant.homeId }`. |
| **Cross-Tenant MQTT Sniffing** | Rogue ESP32 node subscribes to `mosa/#` | Mosquitto `acl.conf` restricts devices to dynamic patterns `mosa/+/device/%c/#`. |
| **AI Prompt Injection** | Attacker sends malicious natural language prompts | Model output parsed into strictly typed `MosaActionContract`; dangerous actions require explicit confirmation. |
