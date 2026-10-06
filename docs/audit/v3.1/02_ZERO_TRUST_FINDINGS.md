# 🚨 02 — ZERO-TRUST FINDINGS REGISTER (v3.1)
**Project:** MOSA Smart Platform  
**Creator & Owner:** **MOSA AL-KADHEM**  
**Audit Baseline:** `mosa-v3.1.0`  
**Date:** August 24, 2026  

---

## 1. Summary of All Findings by Severity

| ID | Severity | Category | Target Component | Root Cause & Description | Status |
|---|:---:|---|---|---|:---:|
| **SEC-01** | **P0** | Data Integrity | `server.ts:534` | Background synthetic telemetry generator previously wrote fake 23.8°C readings into production DB. | **REMEDIATED** |
| **SEC-02** | **P1** | Authentication | `auth.ts:468` | Duplicate Fastify route declarations for `/refresh` caused container startup crash. | **REMEDIATED** |
| **SEC-03** | **P1** | MQTT Broker | `config/acl.conf:19` | Generic device users (`MOSA-ESP-001`) previously had wildcard `mosa/#` readwrite permissions. | **REMEDIATED** |
| **SEC-04** | **P1** | Cryptography | `settings.ts:214` | API keys generated with `Math.random` and fallback user ID `'mock-user-id'`. | **REMEDIATED** |
| **SEC-05** | **P2** | Multi-Tenancy | `telemetry.ts:80` | ESP32 crash reports logged to `prisma.home.findFirst()` rather than node's owner home. | **REMEDIATED** |
| **SEC-06** | **P2** | Multi-Tenancy | `developer.ts:36` | Developer simulation broadcasts sent to `prisma.home.findFirst()` without admin role enforcement. | **REMEDIATED** |
| **SEC-07** | **P2** | API Routing | `server.ts:474` | `telemetryRoutes` were not registered in Fastify plugin tree under `/api/telemetry`. | **REMEDIATED** |
| **SEC-08** | **P2** | Firmware | `R1_Refactored.ino:146`| Fallback default WiFi credentials hardcoded in source code instead of clean NVS. | **REMEDIATED** |
| **SEC-09** | **P3** | Infrastructure | `docker-compose.yml:247`| Watchtower container socket mount fails on Windows host environments without WSL2 forwarding. | **DOCUMENTED** |
| **SEC-10** | **P3** | Update Rollback| `UpdateManager.ts:265` | Container rollback is software-simulated due to isolated Docker socket. | **DOCUMENTED** |
