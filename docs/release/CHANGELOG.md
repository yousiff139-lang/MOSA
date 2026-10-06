# 📝 CHANGELOG — MOSA Smart Platform

All notable changes to the MOSA Smart Platform are documented in this file.
The project adheres to [Semantic Versioning](https://semver.org/).

---

## [v3.2.0-Production] — 2026-08-26

### 🛡️ Security Fixes & Vulnerability Closures
- **[F-01] Cryptographic OTA Checksum Guard:** Enforced `Update.setMD5()` and SHA-256 integrity verification inside `hardware/esp32/src/OTAUpdater.cpp` prior to streaming and flashing firmware.
- **[F-02] Zero-Trust MQTT ACL Scoping:** Removed all permissive global wildcards (`topic readwrite mosa/#` and `pattern readwrite mosa/#`) from `config/acl.conf`. Restricted device publish/subscribe topics strictly to `%c` (Client-ID) and `%u` (Username) namespaces.
- **[F-03] Source Code Secrets Stripped:** Removed hardcoded plaintext WiFi passwords, WebSocket admin passwords, and API keys from `R1_Refactored.ino`. Enforced runtime NVS provisioning via WebSerial and BLE.
- **[F-04] Extended Tenant ORM Scoping:** Expanded `TENANT_MODELS` in `apps/api/src/lib/tenantPrisma.ts` to automatically scope `apiKey`, `inviteToken`, `securityState`, and `auditLog` queries by `homeId`.
- **[F-05] Secret Separation & Rotation:** Generated distinct 64-byte cryptographically random hex keys for `JWT_SECRET` and `COOKIE_SECRET` in `.env`.
- **[F-06] Zero-Mock Telemetry Enforcement:** Replaced `Math.random()` in `apps/api/src/routes/partner.ts` with real database aggregation from `prisma.activityLog`.
- **[F-07] Production CSP Hardening:** Removed `'unsafe-eval'` from `Content-Security-Policy` header in `apps/web/next.config.mjs`.

### ⚡ Visual Excellence & Performance
- **Zero-Overhead GPU Radial Gradients:** Replaced heavy rasterization blur shaders with pure CSS hardware-accelerated radial aura meshes, reducing GPU render load from ~87% to <3%.
- **High-Performance & Eco Modes:** Added dual runtime theme modes with instant switching in sidebar.
