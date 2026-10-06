import { PrismaClient } from '@prisma/client';

/**
 * DEPRECATED: set_config() tenant isolation approach.
 * 
 * WARNING: This function has a CRITICAL SECURITY FLAW with connection pooling:
 * - set_config(..., true) is transaction-scoped, NOT connection-scoped
 * - Connection pools REUSE connections across different tenant requests
 * - Result: Tenant A's homeId can leak into Tenant B's queries
 * 
 * SECURE ALTERNATIVE: Use getTenantPrisma(homeId) instead!
 * The Prisma extension in tenantPrisma.ts automatically injects homeId filters
 * at the query level, which is safe with connection pooling.
 * 
 * This function is kept only for legacy compatibility and should NOT be used
 * for actual tenant isolation. All new code must use getTenantPrisma().
 */
export async function setTenantContext(prisma: PrismaClient, homeId: string): Promise<void> {
  if (!homeId || typeof homeId !== 'string') {
    throw new Error('Tenant context requires a valid non-empty homeId string');
  }

  try {
    await prisma.$executeRaw`
      SELECT set_config(
        'app.current_home_id',
        ${homeId},
        true
      )
    `;
  } catch (error) {
    console.error('[TenantContext 🛑] Failed to establish database tenant isolation session variable:', error);
    throw new Error('Tenant context could not be established — refusing request for security isolation');
  }
}
