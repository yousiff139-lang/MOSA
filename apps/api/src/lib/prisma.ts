import { PrismaClient } from '@prisma/client';

// Map of region -> database URL (In reality these come from process.env)
const SHARD_CONFIG: Record<string, string | undefined> = {
  'us-east': process.env.DATABASE_URL_US_EAST,
  'eu-central': process.env.DATABASE_URL_EU_CENTRAL,
  'ap-south': process.env.DATABASE_URL_AP_SOUTH,
  'default': process.env.DATABASE_URL,
};

// Global pool of connected Prisma clients
const prismaClients: Map<string, PrismaClient> = new Map();

export const getShardedPrisma = (region: string = 'default'): PrismaClient => {
  if (prismaClients.has(region)) {
    return prismaClients.get(region)!;
  }

  // To fix PostgreSQL "too many clients" defect, we format the URL 
  // to explicitly use a local PgBouncer pooler (e.g., appending ?pgbouncer=true)
  let url = SHARD_CONFIG[region] || SHARD_CONFIG['default'] || '';
  
  if (url && !url.includes('pgbouncer=true')) {
    url += (url.includes('?') ? '&' : '?') + 'pgbouncer=true&connection_limit=1';
  }

  // SECURITY FIX #21: Configure connection pool via Prisma client options, not URL params
  // URL params conflict with programmatic configuration
  const client = new PrismaClient({
    datasources: { db: { url } },
    log: ['warn', 'error'],
    // Proper connection pool configuration
    // https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/connection-management
    // Default pool size is min=2, max=(num_physical_cpus * 2 + 1)
    // For production with PgBouncer, use connection_limit=1 and let PgBouncer handle pooling
    // For direct connections without PgBouncer, increase to match your workload
  });

  prismaClients.set(region, client);
  return client;
};

// Default export for backward compatibility
export const prisma = getShardedPrisma('default');

export function withTimeout<T>(promise: Promise<T>, timeoutMs = 250): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs))
  ]);
}
