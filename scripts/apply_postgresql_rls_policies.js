const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🛡️ MOSA PLATFORM — APPLYING POSTGRESQL ROW LEVEL SECURITY (RLS)');
  console.log('================================================================\n');

  try {
    // 1. Enable RLS on core multi-tenant tables
    const targetTables = [
      'Node',
      'AuditLog',
      'ActivityLog',
      'ai_conversations',
      'Device',
      'Room',
      'Scene',
      'Automation',
      'Camera',
      'FloorPlan',
      'Notification',
      'SecurityAlert',
      'SecurityState'
    ];

    console.log('1️⃣ Enabling and FORCING Row-Level Security on Multi-Tenant Tables...');
    for (const table of targetTables) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      console.log(`   ✅ Enabled & FORCED RLS on: "${table}"`);
    }

    // 2. Drop existing policies if any to ensure clean idempotent creation
    console.log('\n2️⃣ Creating / Refreshing Idempotent Isolation Policies...');

    // A. Direct homeId Isolation Policy Helper
    for (const table of targetTables) {
      const policyName = `tenant_isolation_${table.toLowerCase()}`;
      
      await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "${policyName}" ON "${table}";`);

      if (table === 'Node') {
        // Special condition for Node: allow un-adopted/newly-discovered nodes (homeId IS NULL)
        await prisma.$executeRawUnsafe(`
          CREATE POLICY "${policyName}" ON "Node"
            FOR ALL
            USING (
              "homeId" = NULLIF(current_setting('app.current_home_id', true), '')
              OR "homeId" IS NULL
            );
        `);
      } else {
        await prisma.$executeRawUnsafe(`
          CREATE POLICY "${policyName}" ON "${table}"
            FOR ALL
            USING (
              "homeId" = NULLIF(current_setting('app.current_home_id', true), '')
            );
        `);
      }
      console.log(`   🔒 Created Tenant Isolation Policy on: "${table}"`);
    }

    console.log('\n================================================================');
    console.log('🎉 RLS MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('================================================================');

  } catch (error) {
    console.error('RLS Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
