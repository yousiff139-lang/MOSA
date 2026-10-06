# 🛠️ MOSA SMART PLATFORM — REMEDIATION PLAN (v3.1)
**Project Owner & Creator:** **MOSA AL-KADHEM**  
**Audit Stage:** Phase 3 — Prioritized Remediation Plan  
**Date:** August 24, 2026  

---

## 1. Prioritized Task List

| Priority | Task ID | Description | Target File | Risk Level | Rollback Plan |
|---|---|---|---|---|---|
| **P1** | `FIX-01` | Upgrade API Key generation to `crypto.randomBytes(32)` and enforce `req.tenant.userId`. | `apps/api/src/routes/settings.ts` | Low | Revert to previous handler if validation fails. |
| **P2** | `FIX-02` | Scope ESP32 crash reports to node's registered `homeId` via database lookup. | `apps/api/src/routes/telemetry.ts` | Low | Revert to general activity logging. |
| **P3** | `FIX-03` | Scope developer simulation broadcast to `req.tenant.homeId` and require `Role.ADMIN`. | `apps/api/src/routes/developer.ts` | Low | Revert to static broadcast. |

---

## 2. Implementation & Test Verification Details

### Task FIX-01 (API Key Hardening in `settings.ts`)
- **Action**: Replace `Math.random` with `crypto.randomBytes(32).toString('hex')`. Require `verifyTenant` and `requireRole(Role.ADMIN)`. Use `req.tenant.userId`.
- **Test**: Execute `POST /api/settings/api-keys` and verify key matches `sk_live_[64 hex chars]` and `userId` matches authenticated user.

### Task FIX-02 (Telemetry Node Crash Scoping in `telemetry.ts`)
- **Action**: Look up node by `boardId` in database: `const node = await prisma.node.findFirst({ where: { boardId: String(boardId) } });` and save `activityLog` with `node.homeId`.
- **Test**: Send test crash payload with `boardId: 'MosaNode_3030F96A1F5C'` and confirm activity log is recorded with the correct `homeId`.

### Task FIX-03 (Developer Simulation Scoping in `developer.ts`)
- **Action**: Bind simulation loop to the developer's `homeId`. Require `requireRole(Role.ADMIN)`.
- **Test**: Call `POST /api/developer/simulate/toggle` with admin token and verify WebSocket broadcasts only to `home:${homeId}` room.
