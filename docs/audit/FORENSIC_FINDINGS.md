# 🕵️ MOSA SMART PLATFORM — FORENSIC FINDINGS LOG
**Version:** v3.1.0-Audit  
**Project Owner & Creator:** **MOSA AL-KADHEM**  
**Audit Stage:** Phase 1 — Zero-Trust Codebase Audit  
**Date:** August 24, 2026  

---

## 1. Executive Summary of Forensic Findings

| ID | Severity | Component | File & Line | Summary Description | Status |
|---|:---:|---|---|---|:---:|
| **SEC-01** | **P0** | Telemetry Ingestion | `server.ts:534` | Background simulation loop previously generated fake sensor writes into production DB. | **REMEDIATED** |
| **SEC-02** | **P1** | Auth Route Registry | `auth.ts:468` | Duplicate `/refresh` endpoint caused Fastify startup conflict and token rotation failure. | **REMEDIATED** |
| **SEC-03** | **P1** | MQTT Broker ACL | `config/acl.conf:19` | Wildcard `topic readwrite mosa/#` granted to generic device users (`MOSA-ESP-001`). | **REMEDIATED** |
| **SEC-04** | **P1** | Security API Keys | `settings.ts:214` | API Key generation used `Math.random()` and fallback to hardcoded `mock-user-id`. | **OPEN (FIX PLANNED)** |
| **SEC-05** | **P2** | Telemetry Crash Reports | `telemetry.ts:81` | Node crash reports logged to `prisma.home.findFirst()` rather than the node's owner home. | **OPEN (FIX PLANNED)** |
| **SEC-06** | **P2** | Developer Simulator | `developer.ts:36` | Simulation toggle queried `prisma.home.findFirst()` without tenant scope checks. | **OPEN (FIX PLANNED)** |
| **SEC-07** | **P2** | ESP32 Firmware Creds | `R1_Refactored.ino:146` | Fallback default WiFi passwords existed in source code instead of pure NVS provisioning. | **REMEDIATED** |
| **SEC-08** | **P3** | Watchtower Rollback | `UpdateManager.ts:265` | Container rollback simulated without host-level Docker socket orchestration. | **DOCUMENTED** |

---

## 2. Detailed Forensic Analysis & Vulnerability Evidence

### Finding SEC-04 (Severity: P1 — High)
- **ID:** `SEC-04`
- **Component:** API Key Management (`apps/api/src/routes/settings.ts`)
- **File:** `apps/api/src/routes/settings.ts:214-217`
- **Description:** In the `/api/settings/api-keys` endpoint, the `userId` defaulted to `'mock-user-id'`, and the key entropy was generated using `Math.random().toString(36)` instead of cryptographic random bytes.
- **Exploitability:** Predictable API keys could allow an attacker to guess valid integration tokens.
- **Evidence:**
  ```typescript
  const userId = (req as any).user?.id || 'mock-user-id';
  const randomBytes = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
  const generatedKey = `sk_live_${randomBytes}`;
  ```
- **Recommended Fix:** Enforce `verifyTenant` + `requireRole(Role.ADMIN)`, use `req.tenant.userId`, and generate entropy via `crypto.randomBytes(32).toString('hex')`.

---

### Finding SEC-05 (Severity: P2 — Medium)
- **ID:** `SEC-05`
- **Component:** Node Diagnostics & Crash Reporting (`apps/api/src/routes/telemetry.ts`)
- **File:** `apps/api/src/routes/telemetry.ts:81-85`
- **Description:** Crash reports submitted by ESP32 nodes via `POST /api/telemetry/crash-report` were saved under `prisma.home.findFirst()`, causing multi-tenant activity log contamination.
- **Exploitability:** An attacker or misconfigured node in Home B could leak diagnostic metadata into Home A's activity stream.
- **Evidence:**
  ```typescript
  const defaultHome = await prisma.home.findFirst();
  if (defaultHome) {
    await prisma.activityLog.create({ data: { homeId: defaultHome.id, ... } });
  }
  ```
- **Recommended Fix:** Look up the node's owner home via `prisma.node.findFirst({ where: { boardId } })` and scope the log accordingly.

---

### Finding SEC-06 (Severity: P2 — Medium)
- **ID:** `SEC-06`
- **Component:** Developer Simulator Route (`apps/api/src/routes/developer.ts`)
- **File:** `apps/api/src/routes/developer.ts:36`
- **Description:** In the developer simulation engine, simulated sensor broadcasts emitted events to `prisma.home.findFirst()` without enforcing admin authorization or scoping to the developer's assigned home.
- **Exploitability:** Running the developer simulator in a multi-home environment would broadcast fake events to the first registered tenant.
- **Recommended Fix:** Bind simulation state to `req.tenant.homeId` and enforce `requireRole(Role.ADMIN)`.
