# 🔐 MOSA Platform - Secrets Rotation Guide

**Created:** 2026-10-06  
**Purpose:** Secure generation and rotation of all system secrets

---

## ⚠️ CRITICAL: Previous Secrets Were Compromised

**The original `.env` file contained real production secrets that were exposed in the codebase.**

**ALL secrets from the old `.env` MUST be rotated immediately:**
- JWT_SECRET
- JWT_REFRESH_SECRET
- COOKIE_SECRET
- POSTGRES_PASSWORD
- MQTT_PASSWORD
- VAPID keys
- SUPERVISOR_SECRET
- GF_SECURITY_ADMIN_PASSWORD
- All other authentication credentials

---

## 🔧 Generating New Secrets

### 1. JWT & Cookie Secrets (64-byte hex)

**Required for:**
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `COOKIE_SECRET`
- `SUPERVISOR_SECRET`

**Generate with Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Or with OpenSSL:**
```bash
openssl rand -hex 64
```

**Example output:**
```
f4260e5a2eb55710064e30fd25ad361d48b3bc5ad670c2b39b6cfab860bfcac27be97a72addd2463c021f846496881de3d0132dcf6da9cc038c34cb9d82fcb02
```

---

### 2. Backup Encryption Key (32-byte hex)

**Required for:** `BACKUP_ENCRYPTION_KEY`

**Generate:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:**
```
8f3e9a2b7c4d1e6f5a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f
```

---

### 3. VAPID Keys (Web Push Notifications)

**Required for:**
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

**Generate:**
```bash
npx web-push generate-vapid-keys
```

**Example output:**
```
Public Key:
BA7bBvOcEdRmhg_rP2zAJyyMYSVkSlEMX6LjPRWmNRpblh3X-reN4xxuB0KAdMHcUCOLha29pbBSad5b6oYB-6Q

Private Key:
A6MEtBtiYk8E7d-8X40xvY8_4_8fKojTEc3UtFOOlas
```

---

### 4. Database Password

**Required for:** `POSTGRES_PASSWORD`

**Generate strong password:**
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
```

**Or use a password manager to generate 32+ character passwords with:**
- Uppercase + lowercase letters
- Numbers
- Special characters
- NO dictionary words

**Example:**
```
Kx9#mP2$wL5@nQ8^rT3%vY6&zA4!bC7*
```

---

### 5. MQTT Password

**Required for:** `MQTT_PASSWORD`

**Generate:**
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
```

---

### 6. Admin Bootstrap PIN

**Required for:** `ADMIN_BOOTSTRAP_PIN`

**Rules:**
- 6+ digit numeric PIN
- Used ONLY for first-boot admin login
- System forces change on first login

**Generate:**
```bash
node -e "console.log(Math.floor(100000 + Math.random() * 900000))"
```

**Example:** `742891`

---

### 7. Grafana Admin Password

**Required for:** `GF_SECURITY_ADMIN_PASSWORD`

**Generate:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 8. Watchtower Token

**Required for:** `WATCHTOWER_HTTP_API_TOKEN`

**Generate:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📋 Complete Rotation Checklist

### Step 1: Generate All New Secrets (10 minutes)

```bash
# Navigate to project root
cd C:\Users\global-pc\Downloads\MOSA

# Copy template
cp .env.example .env

# Generate secrets (run each command and copy output to .env)
echo "JWT_SECRET:"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

echo "JWT_REFRESH_SECRET:"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

echo "COOKIE_SECRET:"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

echo "BACKUP_ENCRYPTION_KEY:"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

echo "SUPERVISOR_SECRET:"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

echo "GF_SECURITY_ADMIN_PASSWORD:"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

echo "WATCHTOWER_HTTP_API_TOKEN:"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

echo "ADMIN_BOOTSTRAP_PIN:"
node -e "console.log(Math.floor(100000 + Math.random() * 900000))"

echo "POSTGRES_PASSWORD:"
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"

echo "MQTT_PASSWORD:"
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"

echo "VAPID_KEYS:"
npx web-push generate-vapid-keys
```

---

### Step 2: Update `.env` File (5 minutes)

Replace ALL `CHANGE_ME_*` placeholders in `.env` with the generated values.

**Double-check:**
- [ ] All secrets are unique (no duplicates)
- [ ] No placeholder text remains
- [ ] DATABASE_URL includes correct password
- [ ] File permissions are restrictive (600 on Linux)

---

### Step 3: Verify `.env` NOT in Git (CRITICAL)

```bash
# Check if .env is tracked
git ls-files .env

# If it returns a path, remove it immediately:
git rm --cached .env
git commit -m "Remove .env from version control [SECURITY]"

# Verify .gitignore includes .env
cat .gitignore | grep "^\.env$"
```

---

### Step 4: Rotate Secrets in Production (15 minutes)

**For each production instance:**

1. **Stop all services:**
   ```bash
   docker-compose down
   ```

2. **Update `.env` with new secrets**

3. **Recreate database with new password:**
   ```bash
   docker volume rm mosa_system_postgres_data
   docker-compose up -d mosa-postgres
   ```

4. **Run Prisma migrations:**
   ```bash
   cd apps/api
   npx prisma migrate deploy
   ```

5. **Restart all services:**
   ```bash
   docker-compose up -d
   ```

6. **Verify services are healthy:**
   ```bash
   docker-compose ps
   docker-compose logs --tail=50 mosa-backend
   ```

---

### Step 5: Update Dependent Systems (10 minutes)

**Systems that need updated credentials:**

1. **Mobile Apps:**
   - Force logout all users (JWT secrets changed)
   - Users will re-authenticate with new tokens

2. **ESP32 Devices:**
   - Update firmware with new MQTT password
   - Reflash all devices

3. **Telegram Bot:**
   - Update bot token if rotated
   - Test notification delivery

4. **Monitoring (Grafana):**
   - Login with new admin password
   - Update any API tokens

5. **External Integrations:**
   - Update any systems with MOSA API tokens
   - Regenerate affected API keys

---

## 🔄 Periodic Rotation Schedule

**Recommended rotation intervals:**

| Secret Type | Interval | Reason |
|-------------|----------|--------|
| JWT secrets | 90 days | Session security |
| Database passwords | 180 days | Access control |
| MQTT credentials | 180 days | Device authentication |
| API tokens | 90 days | External access |
| Backup encryption | Never* | Would make old backups unreadable |
| VAPID keys | 365 days | Push notifications |

*Backup encryption key should only be rotated if compromised. Store old keys securely to decrypt historical backups.

---

## 🚨 Emergency Rotation (Credential Compromise)

**If any secret is compromised:**

1. **Immediate Actions (< 5 minutes):**
   - Generate new secret immediately
   - Update production `.env`
   - Restart affected services
   - Revoke all active sessions (JWT rotation)

2. **Investigation (< 1 hour):**
   - Review access logs for unauthorized access
   - Identify scope of compromise
   - Check for data exfiltration

3. **Communication:**
   - Notify security team
   - Document incident timeline
   - Update affected users if needed

4. **Post-Incident:**
   - Review how credential was exposed
   - Implement additional controls
   - Update rotation schedule if needed

---

## 🔒 Secret Storage Best Practices

### ❌ DON'T:
- Store secrets in source code
- Commit `.env` to version control
- Share secrets via email/chat
- Use weak or default passwords
- Reuse secrets across environments
- Store secrets in plain text notes

### ✅ DO:
- Use environment variables (`.env`)
- Keep `.env` in `.gitignore`
- Use password managers for secure sharing
- Generate cryptographically random secrets
- Use different secrets for dev/staging/prod
- Encrypt secrets at rest (use `SOPS`, Vault, or cloud secret managers)
- Restrict file permissions (`chmod 600 .env`)

---

## 🛠️ Secret Management Tools (Optional)

For production deployments, consider:

### Docker Secrets
```yaml
# docker-compose.yml
services:
  backend:
    secrets:
      - db_password
      - jwt_secret

secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

### HashiCorp Vault
- Centralized secret management
- Automatic rotation
- Audit logs

### Cloud Providers
- AWS Secrets Manager
- Azure Key Vault
- GCP Secret Manager

---

## 📝 Audit Log

Keep a record of secret rotations:

| Date | Secret Type | Reason | Rotated By |
|------|-------------|--------|------------|
| 2026-10-06 | ALL | Initial compromise (exposed in code) | Security Team |
| | | | |
| | | | |

---

## ✅ Verification Checklist

After rotation, verify:

- [ ] All services start successfully
- [ ] Users can authenticate
- [ ] ESP32 devices can connect to MQTT
- [ ] Backups are encrypted correctly
- [ ] Push notifications work
- [ ] Telegram bot responds
- [ ] Grafana dashboard accessible
- [ ] No secrets exposed in logs
- [ ] `.env` not in git history
- [ ] Old secrets documented and stored securely (for backup decryption)

---

**Need help?** See `SECURITY_FIX_PLAN.md` for full security remediation roadmap.
