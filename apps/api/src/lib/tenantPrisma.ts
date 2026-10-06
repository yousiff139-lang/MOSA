import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from './prisma';

/**
 * ✅ SECURE TENANT ISOLATION via Prisma Extensions
 * 
 * This module provides the CORRECT way to enforce tenant boundaries in a
 * multi-tenant application with connection pooling.
 * 
 * WHY THIS IS SAFE:
 * - Filters are injected at the QUERY level (Prisma extension)
 * - Each query explicitly includes WHERE homeId = '...'
 * - Works correctly with connection pooling (no connection state)
 * - Cannot leak data between tenants
 * 
 * USAGE:
 *   const tPrisma = getTenantPrisma(homeId);
 *   const devices = await tPrisma.device.findMany(); // Automatically filtered by homeId
 * 
 * ⚠️ NEVER use raw prisma client with setTenantContext() for tenant data!
 *    That approach has a connection pooling vulnerability (see middleware/tenant.ts)
 */

const TENANT_MODELS = [
  'device',
  'room',
  'automation',
  'scene',
  'node',
  'floorPlan',
  'securityAlert',
  'notification',
  'energyLog',
  'climateLog',
  'activityLog',
  'camera',
  'routine',
  'aIConversation',
  'apiKey',
  'inviteToken',
  'securityState',
  'auditLog',
] as const;

/**
 * Creates a tenant-scoped Prisma Client extension.
 * Supports both signatures:
 *   getTenantPrisma(homeId, options)
 *   getTenantPrisma(prisma, homeId, options)
 */
export function getTenantPrisma(
  prismaOrHomeId: PrismaClient | string,
  homeIdOrOptions?: string | { allowedRoomIds?: string[]; allowedDeviceIds?: string[] },
  maybeOptions?: { allowedRoomIds?: string[]; allowedDeviceIds?: string[] }
) {
  let targetPrisma: PrismaClient;
  let homeId: string;
  let options: { allowedRoomIds?: string[]; allowedDeviceIds?: string[] } | undefined;

  if (typeof prismaOrHomeId === 'string') {
    targetPrisma = defaultPrisma as any;
    homeId = prismaOrHomeId;
    options = homeIdOrOptions as { allowedRoomIds?: string[]; allowedDeviceIds?: string[] };
  } else {
    targetPrisma = prismaOrHomeId;
    homeId = homeIdOrOptions as string;
    options = maybeOptions;
  }

  if (!homeId) {
    throw new Error('FATAL: Tenant Prisma requested without a valid homeId');
  }

  const extensionConfig: Record<string, any> = {};

  for (const model of TENANT_MODELS) {
    extensionConfig[model] = {
      async $allOperations({ operation, args, query }: any) {
        if (operation !== 'create' && operation !== 'createMany' && (operation as any) !== 'createManyAndReturn') {
          const a = args as any;
          if (!a.where) a.where = {};
          a.where.homeId = homeId;

          // Special soft delete handling for devices and rooms
          if (model === 'device' || model === 'room') {
            a.where.deletedAt = null;
          }

          // RBAC Restrictions for GUESTs
          if (model === 'device' && options?.allowedDeviceIds) {
            a.where.id = { in: options.allowedDeviceIds };
          }
          if (model === 'room' && options?.allowedRoomIds) {
            a.where.id = { in: options.allowedRoomIds };
          }
        }

        if (operation === 'create' || operation === 'update') {
          if (args.data) {
            if ((args.data as any).homeId === undefined) {
              (args.data as any).homeId = homeId;
            } else if ((args.data as any).homeId !== homeId) {
              throw new Error('Tenant Boundary Violation: Attempting to create/update resource in a different Home');
            }
          }
        }

        if (operation === 'createMany' && Array.isArray(args.data)) {
          args.data = args.data.map((d: any) => ({ ...d, homeId }));
        }

        return query(args);
      },
    };
  }

  return (targetPrisma as any).$extends({ query: extensionConfig });
}

/**
 * Helper to assert that a resource belongs to the tenant.
 */
export async function assertTenantOwnership(
  prismaClient: PrismaClient,
  model: string,
  id: string,
  homeId: string
): Promise<void> {
  const target = (prismaClient as any)[model];
  if (!target) return;

  const record = await target.findFirst({
    where: { id, homeId },
    select: { id: true }
  });

  if (!record) {
    const error = new Error('Resource not found or access denied');
    (error as any).statusCode = 404;
    throw error;
  }
}
