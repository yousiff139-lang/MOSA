# 📦 Package Manager Migration - npm → pnpm

**Date:** 2026-10-06  
**Issue:** #7 from security audit - npm/pnpm lockfile conflict  
**Fix Status:** ✅ Complete

---

## What Changed

The project now **enforces pnpm** as the single package manager to eliminate lockfile conflicts and ensure deterministic installs.

### Before
- Mixed `npm` and `pnpm` lockfiles
- Non-deterministic dependency resolution
- CI/CD failures from wrong package manager

### After
- **pnpm only** with `preinstall` hook enforcement
- `package.json` updated to use pnpm workspace commands
- Legacy npm lockfiles documented for removal

---

## Migration Steps

### 1. Install pnpm Globally (if not installed)

```bash
npm install -g pnpm@latest
```

Or via Corepack (Node.js 20+):
```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### 2. Clean Existing Dependencies

```bash
# Remove node_modules
rm -rf node_modules apps/*/node_modules packages/*/node_modules

# Remove npm lockfiles (legacy artifacts)
rm -f frontend/package-lock.json
rm -f legacy/package-lock.json
rm -f legacy/project/package-lock.json
rm -f legacy/server/package-lock.json
rm -f packages/db/package-lock.json
```

### 3. Fresh Install with pnpm

```bash
pnpm install
```

This will:
- Use the existing `pnpm-lock.yaml`
- Respect `pnpm-workspace.yaml` configuration
- Apply `allowBuilds` settings for native modules

### 4. Verify Scripts Work

```bash
pnpm run db:generate  # Generate Prisma client
pnpm run build        # Build all apps
pnpm run dev          # Start dev servers
```

---

## What's Enforced Now

### `package.json` Changes

```json
{
  "packageManager": "pnpm@9.15.1",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "preinstall": "node -e \"if(process.env.npm_execpath.indexOf('pnpm') === -1) throw new Error('This project requires pnpm. Run: npm install -g pnpm')\""
  }
}
```

**If someone tries `npm install`, they'll get:**
```
Error: This project requires pnpm. Run: npm install -g pnpm
```

---

## Legacy npm Lockfiles

These files are **no longer used** and can be safely removed:

- `frontend/package-lock.json` ← legacy Next.js project
- `legacy/package-lock.json` ← old server
- `legacy/project/package-lock.json` ← archived
- `legacy/server/package-lock.json` ← archived
- `packages/db/package-lock.json` ← Prisma workspace

**Why they're still there:** Historical reference. Delete them once you verify the pnpm setup works correctly.

---

## CI/CD Updates Required

### GitHub Actions / GitLab CI

**Before:**
```yaml
- run: npm ci
- run: npm run build
```

**After:**
```yaml
- uses: pnpm/action-setup@v2
  with:
    version: 9
- run: pnpm install --frozen-lockfile
- run: pnpm run build
```

### Docker

**Before:**
```dockerfile
RUN npm ci --production
```

**After:**
```dockerfile
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --prod --frozen-lockfile
```

---

## pnpm Advantages Over npm for Monorepos

1. **Faster installs** - Shared global store with hard links
2. **Strict dependencies** - No phantom dependencies (can't import packages not in `dependencies`)
3. **Efficient storage** - ~30% less disk space (deduplicated across projects)
4. **Better workspace support** - Native monorepo filtering (`--filter`)
5. **Deterministic** - Lockfile always resolves to same tree

---

## Troubleshooting

### "Cannot find module X"

This means the module was a **phantom dependency** (imported but not declared in `package.json`). Add it explicitly:

```bash
pnpm add <module-name> --filter <workspace>
```

### "Peer dependency conflict"

pnpm is **stricter** about peer dependencies. Fix by installing the required peer version:

```bash
pnpm add <peer-dep>@<version> --filter <workspace>
```

### "Native module build failed"

Check `pnpm-workspace.yaml` - the module might need to be added to `allowBuilds`:

```yaml
allowBuilds:
  your-native-module: true
```

---

## Verification

Run this to confirm everything works:

```bash
# Clean slate
rm -rf node_modules
pnpm install

# Test core commands
pnpm run db:generate
pnpm run build
pnpm run test

# Start development
pnpm run dev
```

---

✅ **Migration complete!** The project now uses pnpm exclusively with strict enforcement.
