# 🔒 MOSA Platform - Security Fix Implementation Plan

**Created:** 2026-10-06  
**Total Issues:** 22 (6 Critical, 7 High, 9 Medium)  
**Estimated Total Time:** 12-16 hours

---

## 🚨 PHASE 1: CRITICAL SECURITY FIXES (IMMEDIATE - 2-3 hours)

### Issue #1: Real Secrets in `.env` (30 minutes)
**Status:** 🔴 CRITICAL  
**Risk:** Full system compromise if repo is accessed

**Actions:**
1. ✅ Add `.env` to `.gitignore` (1 min)
2. ✅ Create `.env.example` with placeholder values (5 min)
3. 🔄 Generate new secrets for rotation (10 min)
   - New `JWT_SECRET` (64-byte hex)
   - New `JWT_REFRESH_SECRET` (64-byte hex)
   - New `COOKIE_SECRET` (64-byte hex)
   - New `VAPID_PRIVATE_KEY`
   - New `SUPERVISOR_SECRET`
   - New `GF_SECURITY_ADMIN_PASSWORD`
4. ⚠️ **USER ACTION REQUIRED:** Update production `.env` with new secrets
5. ✅ Document secret rotation procedure (10 min)

**Files Changed:**
- `.gitignore`
- `.env.example` (create)
- `docs/SECRETS_ROTATION.md` (create)

---

### Issue #2: Admin Backdoor Bypass (20 minutes)
**Status:** 🔴 CRITICAL  
**Risk:** Anyone can login as admin with any PIN

**Actions:**
1. ✅ Remove `|| !user` condition from fallback logic (Line 179)
2. ✅ Add `ADMIN_BOOTSTRAP_PIN` environment variable requirement
3. ✅ Force `mustChangePin = true` on fallback account
4. ✅ Add security logging for fallback admin logins
5. ✅ Add alert/notification on fallback admin usage

**Files Changed:**
- `apps/api/src/routes/auth.ts` (Lines 179-196, 230-232)
- `apps/api/src/config/env.ts` (add ADMIN_BOOTSTRAP_PIN)
- `.env.example` (add ADMIN_BOOTSTRAP_PIN)

**Code Changes:**
```typescript
// BEFORE (Line 179-196)
if ((userCount === 0 || !user) && username === 'admin') {
  isFallbackAdmin = true;
  user = { id: 'admin-singleton-id', role: 'SUPER_OWNER', pinCode: '', ... };
}

// AFTER
if (userCount === 0 && username === 'admin') {
  const bootstrapPin = process.env.ADMIN_BOOTSTRAP_PIN;
  if (!bootstrapPin) {
    throw new Error('ADMIN_BOOTSTRAP_PIN must be set for first-boot admin');
  }
  
  isFallbackAdmin = true;
  user = {
    id: 'admin-singleton-id',
    role: 'SUPER_OWNER',
    pinCode: await bcrypt.hash(bootstrapPin, 10),
    mustChangePin: true,
    ...
  };
  
  // Log security event
  console.warn('[SECURITY] Fallback admin login used - first boot detected');
}
```

---

### Issue #3: Duplicate Error Handler Leaking Stack Traces (10 minutes)
**Status:** 🔴 CRITICAL  
**Risk:** Internal implementation details exposed to attackers

**Actions:**
1. ✅ Delete second error handler (Lines 431-437)
2. ✅ Verify first handler remains active
3. ✅ Test error responses return sanitized messages

**Files Changed:**
- `apps/api/src/server.ts` (Lines 431-437)

**Code Changes:**
```typescript
// DELETE these lines (431-437):
server.setErrorHandler((error, request, reply) => {
  if (error.statusCode) return reply.status(error.statusCode).send(error);
  reply.status(500).send({ error: 'Internal Server Error' });
});
```

---

### Issue #4: Hardcoded Backup Encryption Password (15 minutes)
**Status:** 🔴 CRITICAL  
**Risk:** All backups can be decrypted by attackers

**Actions:**
1. ✅ Remove hardcoded fallback password
2. ✅ Make `BACKUP_ENCRYPTION_KEY` required environment variable
3. ✅ Add validation to ensure key is provided
4. ✅ Update backup documentation

**Files Changed:**
- `apps/api/src/services/backup.service.ts` (Line 26)
- `apps/api/src/config/env.ts` (add BACKUP_ENCRYPTION_KEY)
- `.env.example` (add BACKUP_ENCRYPTION_KEY)

**Code Changes:**
```typescript
// BEFORE (Line 26)
const password = encryptionPassword || 'MOSA_MASTER_BACKUP_SECRET_2026';

// AFTER
const password = encryptionPassword || process.env.BACKUP_ENCRYPTION_KEY;
if (!password) {
  throw new Error('Backup encryption key is required (BACKUP_ENCRYPTION_KEY env var)');
}
```

---

### Issue #5: Hardcoded Cloud Relay Token + Mock OAuth (30 minutes)
**Status:** 🔴 CRITICAL  
**Risk:** Complete cloud relay hijacking and voice assistant bypass

**Actions:**
1. ✅ Replace hardcoded token with JWT verification
2. ✅ Implement proper OAuth token generation (not mocks)
3. ✅ Add database table for relay authentication
4. ✅ Generate secure tunnel tokens per home backend
5. ✅ Add token rotation mechanism

**Files Changed:**
- `apps/relay/server.ts` (Lines 28, 113-133)
- `prisma/schema.prisma` (add RelayToken model)
- `apps/relay/auth.ts` (create new file)

**Database Schema Addition:**
```prisma
model RelayToken {
  id        String   @id @default(cuid())
  homeId    String
  token     String   @unique
  createdAt DateTime @default(now())
  expiresAt DateTime
  lastUsed  DateTime?
  
  @@index([homeId])
  @@index([token])
}
```

**Code Changes:**
```typescript
// BEFORE (Line 28)
if (token !== 'secret_tunnel_token') {
  ws.close(4001, 'Unauthorized');
}

// AFTER
const decoded = await verifyRelayToken(token);
if (!decoded || !decoded.homeId) {
  ws.close(4001, 'Invalid or expired tunnel token');
  return;
}
socket.data.homeId = decoded.homeId;
```

---

### Issue #6: TLS Verification Completely Disabled (15 minutes)
**Status:** 🔴 CRITICAL  
**Risk:** MITM attacks on all MQTT device communication

**Actions:**
1. ✅ Remove `rejectUnauthorized: false` (Lines 52, 65)
2. ✅ Remove `checkServerIdentity: () => undefined` (Lines 53, 66)
3. ✅ Add proper CA certificate validation
4. ✅ Make TLS optional only in development mode
5. ✅ Add warning log when TLS is disabled

**Files Changed:**
- `apps/api/src/services/mqtt.service.ts` (Lines 52-66)

**Code Changes:**
```typescript
// BEFORE (Lines 52-66)
tls: {
  ca: fs.readFileSync(tlsConfig.caPath),
  cert: fs.readFileSync(tlsConfig.certPath),
  key: fs.readFileSync(tlsConfig.keyPath),
  rejectUnauthorized: false,  // ❌ REMOVE
  checkServerIdentity: () => undefined,  // ❌ REMOVE
}

// AFTER
tls: {
  ca: fs.readFileSync(tlsConfig.caPath),
  cert: fs.readFileSync(tlsConfig.certPath),
  key: fs.readFileSync(tlsConfig.keyPath),
  rejectUnauthorized: process.env.NODE_ENV !== 'development',
  // Remove checkServerIdentity override -- use default validation
}

// Add warning
if (process.env.NODE_ENV === 'development') {
  console.warn('[MQTT] TLS verification disabled in development mode');
}
```

---

## 🟠 PHASE 2: HIGH PRIORITY FIXES (THIS WEEK - 4-6 hours)

### Issue #7: Package Manager Conflict (30 minutes)
**Actions:**
1. Choose pnpm as the standard (monorepo optimized)
2. Delete `package-lock.json`
3. Fix `pnpm-workspace.yaml` boolean syntax
4. Add `preinstall` script to enforce pnpm
5. Update CI/CD to use pnpm

**Files Changed:**
- `package-lock.json` (delete)
- `pnpm-workspace.yaml` (fix)
- `package.json` (add engines + preinstall)
- `.github/workflows/*.yml` (update to pnpm)

---

### Issue #8: Hardcoded Fallback Secrets in `env.ts` (20 minutes)
**Actions:**
1. Remove all `.default()` values that reference `process.env`
2. Make JWT/Cookie secrets required (no fallbacks)
3. Server will refuse to start without proper secrets

**Files Changed:**
- `apps/api/src/config/env.ts` (Lines 5-8)

---

### Issue #9: `token` Cookie Not HttpOnly (10 minutes)
**Actions:**
1. Either remove duplicate `token` cookie entirely
2. OR set `httpOnly: true`
3. Update frontend to use `access_token` cookie

**Files Changed:**
- `apps/api/src/routes/auth.ts` (Lines 365-371)

---

### Issue #10: Inconsistent Token Lifetimes (15 minutes)
**Actions:**
1. Standardize access tokens to `15m` for both login and refresh
2. Keep refresh tokens at `30d`
3. Update documentation on session architecture

**Files Changed:**
- `apps/api/src/routes/auth.ts` (Lines 274-282, 611-618)

---

### Issue #11: Anonymous Socket.IO Connections (15 minutes)
**Actions:**
1. Reject anonymous connections with error
2. Remove `isAnonymous` logic
3. Require authentication for all WebSocket connections

**Files Changed:**
- `apps/api/src/services/socket.service.ts` (Lines 27-31)

---

### Issue #12: Cron Dumps User Passwords to JSON (20 minutes)
**Actions:**
1. Exclude sensitive fields from backup (use `select`)
2. Encrypt backup files with `BackupService`
3. Implement backup rotation (delete old backups)

**Files Changed:**
- `apps/api/src/services/cron.ts` (Lines 59-68)

---

### Issue #13: Redis `noeviction` Policy (10 minutes)
**Actions:**
1. Change to `allkeys-lru` eviction policy
2. Monitor Redis memory usage
3. Add alerts for high memory usage

**Files Changed:**
- `docker-compose.yml` (Line 131)

---

## 🟡 PHASE 3: MEDIUM PRIORITY FIXES (NEXT SPRINT - 4-6 hours)

### Issue #14: Helmet Registered Twice (10 minutes)
**Actions:**
1. Remove root-level helmet registration (Lines 199-201)
2. Keep only the fully-configured plugin-level registration

**Files Changed:**
- `apps/api/src/server.ts`

---

### Issue #15: Provisioning Routes Registered 3 Times (10 minutes)
**Actions:**
1. Choose one canonical prefix: `/api/provisioning`
2. Add redirects from old prefixes
3. Update frontend to use new prefix

**Files Changed:**
- `apps/api/src/server.ts` (Lines 539-541)

---

### Issue #16: Fake Devices Returned from Empty DB (15 minutes)
**Actions:**
1. Return empty array with `meta.isEmpty: true`
2. Update frontend to show onboarding UI
3. Remove hardcoded mock devices

**Files Changed:**
- `apps/api/src/routes/devices.ts` (Lines 229-260)

---

### Issue #17: Tenant Isolation Broken by Pooling (45 minutes)
**Actions:**
1. Choose ONE approach:
   - Option A: RLS + `$transaction()` wrapper for all queries
   - Option B: Rely on `tenantPrisma.ts` extension only
2. Remove `set_config` if going with Option B
3. Test multi-tenant isolation thoroughly

**Files Changed:**
- `apps/api/src/middleware/tenant.ts`
- `apps/api/src/lib/tenantPrisma.ts`
- `apps/api/src/lib/prisma.ts`

---

### Issue #18: Chaos Route Exposed (10 minutes)
**Actions:**
1. Add `requireRole(Role.SUPER_OWNER)` check
2. Disable route in production via env var
3. Add warning documentation

**Files Changed:**
- `apps/api/src/routes/chaos.ts`

---

### Issue #19: No CRL Rotation for MQTT (30 minutes)
**Actions:**
1. Add CRL generation to `CertMonitor.ts`
2. Implement automated CRL refresh
3. Add Mosquitto `SIGHUP` reload mechanism
4. Consider OCSP stapling

**Files Changed:**
- `apps/api/src/services/CertMonitor.ts`
- `apps/api/src/services/mqtt.service.ts`

---

### Issue #20: Global XSS Sanitization Corrupts Data (20 minutes)
**Actions:**
1. Remove global XSS sanitization from `preValidation`
2. Apply XSS sanitization only on specific routes (notifications, user content)
3. Use output encoding at template level instead

**Files Changed:**
- `apps/api/src/server.ts` (Lines 411-425)

---

### Issue #21: Conflicting `connection_limit` Values (15 minutes)
**Actions:**
1. Remove `connection_limit` from `.env` URL
2. Configure pooling in Prisma client options
3. Use reasonable defaults (10-20 connections per instance)

**Files Changed:**
- `.env` (Line 16)
- `apps/api/src/lib/prisma.ts` (Line 24)

---

### Issue #22: Backend Container Memory Too Low (10 minutes)
**Actions:**
1. Increase memory limit from `512M` to `1536M`
2. Add memory usage monitoring
3. Add alerts for approaching limits

**Files Changed:**
- `docker-compose.yml` (Line 188)

---

## 📊 Summary Table

| Phase | Issues | Estimated Time | Priority |
|-------|--------|----------------|----------|
| **Phase 1** | #1-6 | 2-3 hours | 🔴 CRITICAL |
| **Phase 2** | #7-13 | 4-6 hours | 🟠 HIGH |
| **Phase 3** | #14-22 | 4-6 hours | 🟡 MEDIUM |
| **TOTAL** | 22 issues | 12-16 hours | - |

---

## 🎯 Implementation Strategy

### Today (Phase 1)
1. ✅ Create this fix plan (DONE)
2. 🔄 Fix all 6 critical issues (IN PROGRESS)
3. ✅ Test each fix individually
4. ✅ Create security patch branch
5. ✅ Document all changes

### This Week (Phase 2)
1. Fix high priority issues (#7-13)
2. Run comprehensive security testing
3. Update all documentation
4. Deploy to staging for validation

### Next Sprint (Phase 3)
1. Fix medium priority issues (#14-22)
2. Perform full penetration testing
3. Update security hardening guide
4. Train team on secure practices

---

## ✅ Testing Checklist (After Fixes)

### Phase 1 Testing (Critical Fixes)
- [ ] Verify `.env` not in git history (use BFG Repo Cleaner if needed)
- [ ] Test admin login requires correct bootstrap PIN
- [ ] Verify error responses don't leak stack traces
- [ ] Test backup encryption requires key
- [ ] Verify cloud relay rejects invalid tokens
- [ ] Test MQTT connections validate TLS certificates

### Phase 2 Testing (High Priority)
- [ ] Verify only pnpm can install dependencies
- [ ] Test server refuses to start without secrets
- [ ] Verify JWT cookies are httpOnly
- [ ] Test token refresh returns consistent lifetimes
- [ ] Verify Socket.IO rejects anonymous connections
- [ ] Test backups exclude sensitive fields
- [ ] Verify Redis evicts old entries under memory pressure

### Phase 3 Testing (Medium Priority)
- [ ] Test CSP headers applied correctly
- [ ] Verify only one provisioning route active
- [ ] Test empty device list returns empty array
- [ ] Verify tenant isolation with concurrent requests
- [ ] Test chaos route requires admin role
- [ ] Verify CRL rotation mechanism works
- [ ] Test binary data not corrupted by XSS sanitizer
- [ ] Verify Prisma connection pooling stable
- [ ] Test backend container doesn't OOM under load

---

## 🚨 Rollback Plan

If any fix causes production issues:

1. **Immediate:** Revert the specific commit
2. **Short-term:** Deploy previous stable version
3. **Investigation:** Isolate the problematic fix
4. **Resolution:** Fix in development, test thoroughly, redeploy

---

## 📚 Additional Documentation to Create

1. ✅ `SECURITY_FIX_PLAN.md` (this file)
2. 🔄 `docs/SECRETS_ROTATION.md` (how to rotate all secrets)
3. 🔄 `docs/SECURITY_HARDENING.md` (comprehensive security guide)
4. 🔄 `docs/SECURE_DEPLOYMENT.md` (production deployment checklist)
5. 🔄 `SECURITY_TESTING.md` (security testing procedures)

---

## 🎉 Success Criteria

**After Phase 1 (Critical):**
- ✅ No secrets in repository
- ✅ No authentication bypasses
- ✅ No information leakage
- ✅ Proper encryption everywhere
- ✅ TLS validation working

**After Phase 2 (High):**
- ✅ Consistent build environment
- ✅ No hardcoded credentials
- ✅ Secure session management
- ✅ Authenticated WebSocket only
- ✅ Secure backup handling

**After Phase 3 (Medium):**
- ✅ Clean architecture (no duplication)
- ✅ Proper tenant isolation
- ✅ Secure defaults everywhere
- ✅ Production-ready configuration

---

**Status:** 📋 Plan Complete → 🔄 Starting Phase 1 Implementation

**Next Step:** Implement all 6 critical security fixes immediately.
