# 🔧 14 — REMEDIATION REGISTER (v3.1)
**Project:** MOSA Smart Platform  
**Creator & Owner:** **MOSA AL-KADHEM**  
**Audit Baseline:** `mosa-v3.1.0`  
**Date:** August 24, 2026  

---

## 1. Resolved Remediation Register

1. **`FIX-01` (Security - API Key Entropy)**: Replaced `Math.random` with `crypto.randomBytes(32).toString('hex')` in `apps/api/src/routes/settings.ts`.
2. **`FIX-02` (Multi-Tenancy - Crash Report Scoping)**: Fixed `apps/api/src/routes/telemetry.ts` to look up node owner `homeId` rather than defaulting to `prisma.home.findFirst()`.
3. **`FIX-03` (Routing - Missing Telemetry Prefix)**: Registered `app.register(telemetryRoutes, { prefix: '/api/telemetry' })` in `apps/api/src/server.ts`.
4. **`FIX-04` (Multi-Tenancy - Developer Simulator Scoping)**: Restricted simulation events to `req.tenant.homeId` and enforced `Role.ADMIN` in `apps/api/src/routes/developer.ts`.
5. **`FIX-05` (MQTT Broker - Device Wildcard Removal)**: Removed `topic readwrite mosa/#` for device accounts in `config/acl.conf` and enforced `acl_file` on port 1883 in `config/mosquitto.conf`.
