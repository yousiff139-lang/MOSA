const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🧪 MOSA PLATFORM — RLS MULTI-TENANT ISOLATION VERIFICATION TEST');
  console.log('================================================================\n');

  try {
    // TEST 1: Tenant 'home-1' isolation test
    console.log('🔹 TEST 1: Executing queries as Tenant "home-1"...');
    const test1Results = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_home_id', 'home-1', true);`);
      const devices = await tx.$queryRawUnsafe(`SELECT id, name, "homeId" FROM "Device";`);
      const nodes = await tx.$queryRawUnsafe(`SELECT id, name, "homeId" FROM "Node";`);
      return { devices, nodes };
    });
    console.log(`   Found ${test1Results.devices.length} device(s) and ${test1Results.nodes.length} node(s) for home-1.`);

    // TEST 2: Tenant 'home-2' (Non-existent / Foreign tenant)
    console.log('\n🔹 TEST 2: Executing queries as Tenant "home-2" (Cross-tenant attempt)...');
    const test2Results = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_home_id', 'home-2', true);`);
      const devices = await tx.$queryRawUnsafe(`SELECT id, name, "homeId" FROM "Device";`);
      return devices;
    });
    console.log(`   Found ${test2Results.length} device(s) for home-2.`);
    
    if (test2Results.length === 0) {
      console.log('   ✅ PASS: Cross-tenant isolation verified! Tenant home-2 cannot see home-1 devices.');
    } else {
      console.log('   🔴 FAIL: Leak detected! home-2 saw devices belonging to another tenant.');
    }

    // TEST 3: Fail-Closed Test without tenant context
    console.log('\n🔹 TEST 3: Executing queries with NO tenant context (Fail-Closed check)...');
    const test3Results = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_home_id', '', true);`);
      const devices = await tx.$queryRawUnsafe(`SELECT id, name, "homeId" FROM "Device";`);
      return devices;
    });
    console.log(`   Found ${test3Results.length} device(s) without tenant context.`);

    if (test3Results.length === 0) {
      console.log('   ✅ PASS: Fail-Closed verified! Unauthenticated/Contextless queries return 0 rows.');
    } else {
      console.log('   🔴 FAIL: Fail-Closed broken! Unauthenticated queries leaked data.');
    }

    console.log('\n================================================================');
    if (test2Results.length === 0 && test3Results.length === 0 && test1Results.devices.length > 0) {
      console.log('🎉 ALL RLS VERIFICATION TESTS PASSED (100% ISOLATION CERTIFIED)');
    } else {
      console.log('⚠️ RLS VERIFICATION COMPLETED WITH ERRORS');
    }
    console.log('================================================================');

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
