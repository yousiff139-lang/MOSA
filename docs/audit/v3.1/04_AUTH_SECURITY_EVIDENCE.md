# 🔐 04 — AUTHENTICATION & SESSION SECURITY EVIDENCE (v3.1)
**Project:** MOSA Smart Platform  
**Creator & Owner:** **MOSA AL-KADHEM**  
**Audit Baseline:** `mosa-v3.1.0`  
**Date:** August 24, 2026  

---

## 1. Adversarial Test Evidence

### Test AUTH-01: Valid JWT Authorization
- **Precondition**: Signed JWT with valid user ID and homeId.
- **Command**: `GET /api/auth/me` with `Authorization: Bearer <valid_jwt>`
- **Expected Result**: HTTP 200 with user payload.
- **Actual Result**: `HTTP 200 OK`, `{ id: "00000000-0000-0000-0000-000000000001", username: "Mosa", role: "ADMIN" }`
- **Status**: ✅ **VERIFIED**

### Test AUTH-02: Invalid Login Credentials
- **Precondition**: Unknown username and wrong PIN code.
- **Command**: `POST /api/auth/login` with `username: "attacker_probe", pinCode: "999999"`
- **Expected Result**: HTTP 401 Unauthorized or HTTP 429 Too Many Requests.
- **Actual Result**: `HTTP 401 Unauthorized`, `{"message":"اسم المستخدم أو رمز PIN غير صحيح"}`
- **Status**: ✅ **VERIFIED**

### Test AUTH-04: Expired Access Token Rejection
- **Precondition**: JWT with expiration timestamp in the past.
- **Command**: `GET /api/auth/me` with expired token.
- **Expected Result**: HTTP 401 Unauthorized.
- **Actual Result**: `HTTP 401 Unauthorized`, `{"statusCode":401,"error":"Unauthorized","message":"The token is expired"}`
- **Status**: ✅ **VERIFIED**

### Test AUTH-05: Refresh Token Replay Prevention
- **Precondition**: Previously used or invalid refresh token.
- **Command**: `POST /api/auth/refresh` with `{ refreshToken: "stolen_or_replayed_token_sha256" }`
- **Expected Result**: HTTP 401 Unauthorized.
- **Actual Result**: `HTTP 401 Unauthorized`, `{"error":"Invalid or expired refresh token"}`
- **Status**: ✅ **VERIFIED**

### Test AUTH-06: Session Logout & Token Blacklist in Redis
- **Precondition**: Active valid token used to invoke logout.
- **Command**: `POST /api/auth/logout` followed by `GET /api/auth/me` with the same token.
- **Expected Result**: Logout returns HTTP 200; subsequent reuse returns HTTP 401.
- **Actual Result**: `Logout: HTTP 200`, `Re-use: HTTP 401`, `{"error":"Token has been revoked"}`
- **Status**: ✅ **VERIFIED**
