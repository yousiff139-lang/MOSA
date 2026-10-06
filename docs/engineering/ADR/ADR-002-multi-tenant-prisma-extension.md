# ADR-002: Multi-Tenant Database Isolation via Prisma Client Extension

* **Status:** `ACCEPTED & ENFORCED`
* **Date:** 2026-08-26
* **Deciders:** MOSA AL-KADHEM

---

## Context
In multi-tenant SaaS platforms, relying on developers to manually attach `where: { homeId }` on every database query inevitably leads to catastrophic data leakage (IDOR vulnerabilities) when an endpoint forgets the clause.

## Decision
1. Implement `getTenantPrisma(homeId)` in `apps/api/src/lib/tenantPrisma.ts` using Prisma's `$extends` Client Extension.
2. Automatically intercept `$allOperations` across all 18 tenant models (`Device`, `Room`, `Automation`, `Scene`, `Node`, `FloorPlan`, `SecurityAlert`, `Notification`, `EnergyLog`, `ClimateLog`, `ActivityLog`, `Camera`, `Routine`, `AIConversation`, `ApiKey`, `InviteToken`, `SecurityState`, `AuditLog`).
3. Inject `homeId` into all `findFirst`, `findMany`, `update`, `delete`, `count`, and `aggregate` queries.
4. Throw a fatal error (`FATAL: Tenant Prisma requested without a valid homeId`) if initialized without a tenant ID.

## Consequences
* **Positive:** Guaranteed compile-time and runtime tenant isolation. Zero chance of cross-home leaks in ORM queries.
* **Negative:** Bypassing the extension requires explicit `defaultPrisma` import, which is restricted to superadmin routes.
