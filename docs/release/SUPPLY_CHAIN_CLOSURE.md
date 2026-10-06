# 📦 MOSA Smart Platform — Supply Chain & Dependency Security Closure (F-08)
**Project Name:** MOSA Smart Platform  
**Creator & Owner:** **MOSA AL-KADHEM**  
**Audit Baseline:** `npm audit` on `mosa-v3.2.0`  
**Date:** August 26, 2026  

---

## 1. Audit Summary & Blast Radius Analysis

```text
Total Advisories: 92 vulnerabilities (4 critical, 46 high, 40 moderate, 2 low)
```

### Contextual Reachability & Exploitability Analysis:

1. **`tar` (`<=7.5.20`) in `@capacitor/cli` (Critical):**
   - *Attack Vector:* Path traversal during untrusted tarball extraction.
   - *Reachability in MOSA Runtime:* **UNREACHABLE in Production**. `@capacitor/cli` is a local build tool for mobile app packaging. The production Docker backend and Nginx containers do not extract tar archives from untrusted web sources.
   - *Status:* **RISK-ACCEPTED (Dev Tooling Scope)**.

2. **`shell-quote` (`<=1.8.4`) in `concurrently` (Critical):**
   - *Attack Vector:* Unescaped newlines in shell argument parsing.
   - *Reachability in MOSA Runtime:* **UNREACHABLE in Production**. `concurrently` is used solely in `npm run dev` to orchestrate parallel local development servers. Production uses individual Docker containers with direct `node dist/server.js` execution.
   - *Status:* **RISK-ACCEPTED (Dev Script Scope)**.

3. **`serialize-javascript` (`<=7.0.2`) in `next-pwa` (High):**
   - *Attack Vector:* RCE via RegExp.flags during static webpack asset serialization.
   - *Reachability in MOSA Runtime:* **MITIGATED**. Next.js production build runs in isolated CI/Docker build steps with static inputs only. PWA service worker is currently disabled in `next.config.mjs` (`disable: true`).
   - *Status:* **RISK-ACCEPTED (Build-time Mitigation)**.

4. **`ws` (`8.0.0 - 8.20.1`) & `socket.io-parser` (High):**
   - *Attack Vector:* Memory exhaustion via small fragmented frames.
   - *Reachability in MOSA Runtime:* **MITIGATED**. Fastify and Nginx apply `client_max_body_size 50M`, `proxy_buffering off`, and rate limiting on socket connections. Socket.IO authentication middleware terminates unauthenticated frames before processing.
   - *Status:* **COMPENSATING CONTROL ACTIVE**.

5. **`undici` (`7.0.0 - 7.28.0`) (High):**
   - *Attack Vector:* Response desynchronization via retry interceptor.
   - *Reachability in MOSA Runtime:* Node.js 20 runtime global fetch in Fastify uses standard HTTP/HTTPS agent pools with strict schema validation.

---

## 2. Supply Chain Risk Acceptance Register

| Package | Severity | Upstream Advisory | Compensating Control & Isolation | Owner | Review Schedule |
|---|:---:|---|---|---|:---:|
| `@capacitor/cli` ➔ `tar` | Critical | GHSA-34x7-hfp2-rc4v | Build-time CLI dependency only; absent from production Docker runner | MOSA AL-KADHEM | Q4 2026 |
| `concurrently` ➔ `shell-quote` | Critical | GHSA-w7jw-789q-3m8p | Development orchestration only; absent from production images | MOSA AL-KADHEM | Q4 2026 |
| `next-pwa` ➔ `serialize-javascript` | High | GHSA-5c6j-r48x-rmvq | PWA disabled in production config; build runs in isolated container | MOSA AL-KADHEM | Q4 2026 |
| `socket.io` ➔ `ws` | High | GHSA-96hv-2xvq-fx4p | Nginx frame buffer limits + Fastify rate-limiting + Redis auth gate | MOSA AL-KADHEM | Q4 2026 |
