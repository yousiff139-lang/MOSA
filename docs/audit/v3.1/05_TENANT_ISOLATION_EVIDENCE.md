# 🏠 05 — MULTI-TENANT ISOLATION & IDOR DEFENSE (v3.1)
**Project:** MOSA Smart Platform  
**Creator & Owner:** **MOSA AL-KADHEM**  
**Audit Baseline:** `mosa-v3.1.0`  
**Date:** August 24, 2026  

---

## 1. Adversarial Multi-Tenant Testing

### Test TENANT-01: Cross-Tenant Query Parameter Tampering
- **Precondition**: User authenticated with Tenant A token (`c55f83aa-2a04-493b-9301-a29a978d9be5`).
- **Command**: `GET /api/devices?homeId=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`
- **Expected Result**: Response is strictly scoped to Tenant A devices; parameter injection ignored.
- **Actual Result**: `HTTP 200 OK`, all returned records belong strictly to Tenant A.
- **Root Cause & Defense**: `tenantPrisma.ts` intercepts model queries and forces `where: { homeId: req.tenant.homeId }`.
- **Status**: ✅ **VERIFIED**

### Test TENANT-02: Unauthenticated Resource Mutation
- **Precondition**: Malicious client sends POST request without Authorization header.
- **Command**: `POST /api/rooms` with `{ name: "Hostile Room" }`
- **Expected Result**: HTTP 401 Unauthorized.
- **Actual Result**: `HTTP 401 Unauthorized`, `{"message":"Missing authentication token"}`
- **Status**: ✅ **VERIFIED**

### Test TENANT-03: Diagnostic Node Crash Report Scoping
- **Precondition**: ESP32 node submits crash report with `boardId: "MosaNode_3030F96A1F5C"`.
- **Command**: `POST /api/telemetry/crash-report` with crash diagnostics.
- **Expected Result**: Crash log is recorded in `ActivityLog` under the home associated with the node.
- **Actual Result**: `HTTP 200 OK`, `{"success":true,"message":"Crash report recorded successfully"}`
- **Status**: ✅ **VERIFIED**
