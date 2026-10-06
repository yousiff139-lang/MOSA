# 🟠 Phase 2: HIGH Priority Security Fixes - COMPLETE

**Date:** 2026-10-06  
**Phase:** 2 of 3 (HIGH priority issues)  
**Issues Addressed:** #7 through #13  
**Total Time:** ~45 minutes

---

## 📊 Summary

**7 HIGH Priority Issues Addressed:**

| Fix | Status | Issue | Result |
|-----|--------|-------|--------|
| #7 | ✅ FIXED | Package manager conflict (npm + pnpm) | Enforced pnpm exclusively, updated all scripts |
| #8 | ✅ ALREADY SECURE | Hardcoded env fallbacks | JWT/Cookie secrets already required |
| #9 | ✅ FIXED | `token` cookie XSS risk | Removed insecure httpOnly:false cookie |
| #10 | ✅ FIXED | Inconsistent token lifetimes | Standardized to 15m access + 30d refresh |
| #11 | ✅ FIXED | Anonymous Socket.IO connections | Now requires authentication |
| #12 | ✅ FIXED | Cron dumps user passwords | Encrypted backups + excluded PINs |
| #13 | ✅ FIXED | Redis noeviction OOM | Changed to allkeys-lru policy |

---

## 📁 Files Changed

### Code Changes (5 files)

1. **`package.json`** - Package manager enforcement
   - Added `packageManager: "pnpm@9.15.1"`
   - Added `engines` constraints
   - Added `preinstall` hook to block npm
   - Converted all scripts to pnpm commands

2. **`apps/api/src/routes/auth.ts`** - Token & cookie security
   - Removed insecure `token` cookie (httpOnly: false)
   - Changed login access token: 30d → 15m
   - Updated cookie maxAge to match (15 minutes)

3. **`apps/api/src/services/socket.service.ts`** - WebSocket security
   - Reject anonymous connections
   - Require valid JWT for all Socket.IO connections

4. **`apps/api/src/services/cron.ts`** - Backup security
   - Exclude sensitive user fields (pinCode, mfaSecret, mfaBackupCodes)
   - Use encrypted AES-256 backups via BackupService
   - Added 30-day backup rotation

5. **`docker-compose.yml`** - Redis eviction policy
   - Changed: `noeviction` → `allkeys-lru`
   - Prevents write failures under memory pressure

---

### Documentation Created (1 file, 205 lines)

**`docs/PACKAGE_MANAGER_FIX.md`** - Complete pnpm migration guide
- Installation steps
- CI/CD updates required
- Docker changes needed
- Troubleshooting phantom dependencies

---

## 🔧 What Changed

### Fix #7: Package Manager Conflict ✅

**Before:**
- Both `pnpm-lock.yaml` AND npm lockfiles coexisted
- Non-deterministic installs
- CI/CD failures from wrong package manager

**After:**
- `package.json` enforces pnpm with `preinstall` hook
- All scripts converted to pnpm workspace commands
- Attempting `npm install` now fails with clear error message
- Legacy npm lockfiles documented for removal

**Actions Required:**
1. Run `pnpm install` to verify migration
2. Remove legacy npm lockfiles from `frontend/`, `legacy/`, `packages/db/`
3. Update CI/CD pipelines (see `PACKAGE_MANAGER_FIX.md`)

---

### Fix #9: `token` Cookie XSS Risk ✅

**Before:**
```typescript
reply.setCookie('token', accessToken, {
  httpOnly: false,  // ⚠️ Readable by JavaScript → XSS risk
  ...
});
```

**After:**
```typescript
// Cookie removed entirely
// Frontend uses httpOnly 'access_token' cookie instead
```

**Impact:**
- XSS attacks can no longer steal session tokens via `document.cookie`
- **Frontend change required:** If the frontend reads `document.cookie.token`, update it to send credentials via `withCredentials: true` on fetch/axios requests

---

### Fix #10: Inconsistent Token Lifetimes ✅

**Before:**
- **Login:** 30-day access token
- **Refresh:** 15-minute access token
- User experience: First session lasts a month, then suddenly requires re-auth every 15 minutes

**After:**
- **Login & Refresh:** 15-minute access token + 30-day refresh token
- Consistent short-lived sessions with automatic refresh
- Redis blacklist now practical (only needs to store 15-minute tokens)

---

### Fix #11: Anonymous Socket.IO ✅

**Before:**
```typescript
if (!decoded) {
  socket.data = { isAnonymous: true };
  return next();  // ALLOWED
}
```

**After:**
```typescript
if (!decoded) {
  return next(new Error('Authentication required'));
}
```

**Impact:**
- All WebSocket connections now require valid JWT
- Unauthenticated clients are immediately rejected
- No more guest/anonymous socket access

---

### Fix #12: Cron Dumps User Passwords ✅

**Before:**
```typescript
users: await prisma.user.findMany(),  // Includes pinCode, mfaSecret, mfaBackupCodes
fs.writeFileSync('backup.json', JSON.stringify(backupData));  // Plain JSON
```

**After:**
```typescript
users: await prisma.user.findMany({
  select: {
    id: true,
    username: true,
    name: true,
    role: true,
    email: true
    // Excluded: pinCode, mfaSecret, mfaBackupCodes
  }
}),
await BackupService.createBackup(data, {
  encryptionPassword: process.env.BACKUP_ENCRYPTION_KEY
});  // AES-256-GCM encrypted
```

**Added Features:**
- Automatic 30-day backup rotation
- Encrypted `.mosa` backup files instead of plain JSON
- Sensitive user fields never written to disk

**Action Required:**
- Ensure `BACKUP_ENCRYPTION_KEY` is set in `.env` (see `SECRETS_ROTATION.md`)

---

### Fix #13: Redis `noeviction` → `allkeys-lru` ✅

**Before:**
```yaml
--maxmemory 512mb --maxmemory-policy noeviction
```
- **Problem:** When Redis hits 512MB, ALL writes fail
- **Impact:** Token blacklisting stops working, sessions break, telemetry caching fails

**After:**
```yaml
--maxmemory 512mb --maxmemory-policy allkeys-lru
```
- **Solution:** Old keys are automatically evicted when memory is full
- **Impact:** System stays operational under memory pressure

---

## ✅ Verification Checklist

Run these tests after deploying Phase 2 fixes:

### Package Manager
```bash
# Should succeed
pnpm install

# Should fail with error message
npm install
```

### Authentication
```bash
# Login should work
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","pinCode":"YOUR_PIN"}'

# Cookie 'token' should NOT exist
# Only 'access_token' and 'refresh_token' should be set
```

### Socket.IO
```javascript
// Anonymous connection should be rejected
const socket = io('http://localhost:8080');
socket.on('connect_error', (err) => {
  console.log('Expected error:', err.message);  // "Authentication required"
});
```

### Cron Backup
```bash
# Check that backup files are encrypted
ls -la uploads/backups/
# Should see: mosa_cron_backup_2026-10-06.mosa (not .json)

# Verify sensitive fields are excluded
# (Can only decrypt with BACKUP_ENCRYPTION_KEY)
```

### Redis Eviction
```bash
# Connect to Redis
docker exec -it mosa-redis redis-cli

# Check policy
CONFIG GET maxmemory-policy
# Should return: "allkeys-lru"
```

---

## 🚨 Breaking Changes

### 1. Frontend Cookie Change
If your frontend reads `document.cookie` to get the JWT, update it:

**Before:**
```javascript
const token = document.cookie.match(/token=([^;]+)/)?.[1];
```

**After:**
```javascript
// Don't read cookies directly - use httpOnly cookies with credentials
fetch('/api/endpoint', {
  credentials: 'include'  // Sends httpOnly cookies automatically
});
```

### 2. Package Manager
**All developers must switch to pnpm:**
```bash
npm install -g pnpm@latest
pnpm install
```

**CI/CD pipelines must use pnpm:**
```yaml
- uses: pnpm/action-setup@v2
  with:
    version: 9
- run: pnpm install --frozen-lockfile
```

---

## 🔴 Still Remaining

**Phase 3: MEDIUM Issues (#14-#22)** - Scheduled for next sprint:
- Helmet double registration
- Provisioning routes duplicated 3 times
- Fake devices returned from empty DB
- Tenant isolation with connection pooling
- Chaos route exposed without admin check
- No CRL rotation for MQTT
- Global XSS sanitizer corrupts binary data
- Conflicting `connection_limit` values
- 512MB backend memory limit too low

**See:** `SECURITY_FIX_PLAN.md` for Phase 3 details

---

## 📈 Security Posture Impact

**Before Phase 2:**
- ⚠️ XSS could steal session tokens
- ⚠️ Anonymous users could connect to WebSocket
- ⚠️ User passwords leaked in plain backups
- ⚠️ Redis crashes killed session management
- ⚠️ 30-day access tokens impossible to revoke

**After Phase 2:**
- ✅ httpOnly cookies prevent XSS token theft
- ✅ All WebSocket connections authenticated
- ✅ Encrypted backups exclude sensitive data
- ✅ Redis gracefully handles memory pressure
- ✅ Short-lived tokens + practical revocation

---

✅ **Phase 2 complete!** Ready for Phase 3 (MEDIUM issues).
