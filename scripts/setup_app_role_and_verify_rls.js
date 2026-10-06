const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🛡️ MOSA PLATFORM — APPLICATION ROLE SETUP & RLS ENFORCEMENT');
  console.log('================================================================\n');

  try {
    console.log('1️⃣ Creating Least-Privilege Application Role "mosa_app"...');
    
    // Create non-superuser application role if it doesn't exist
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mosa_app') THEN
          CREATE ROLE mosa_app WITH LOGIN PASSWORD 'mosa_app_secure_password_2026';
        END IF;
      END
      $$;
    `);

    // Grant permissions on schema and tables
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO mosa_app;`);
    await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mosa_app;`);
    await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mosa_app;`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO mosa_app;`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO mosa_app;`);
    
    // Explicitly revoke BYPASSRLS and SUPERUSER
    await prisma.$executeRawUnsafe(`ALTER ROLE mosa_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;`);

    console.log('   ✅ Successfully configured "mosa_app" as non-superuser (NOBYPASSRLS).\n');

    // Fetch actual homeIds in DB
    const realHomes = await prisma.$queryRaw`SELECT id, name FROM "Home";`;
    const realDevicesHomeIds = await prisma.$queryRaw`SELECT DISTINCT "homeId" FROM "Device";`;
    console.log('🏠 REGISTERED HOMES IN DATABASE:');
    console.table(realHomes);
    console.log('📱 DISTINCT DEVICE HOME IDs:');
    console.table(realDevicesHomeIds);

    const validHomeId = realHomes.length > 0 ? realHomes[0].id : 'home-1';
    console.log(`\nUsing valid target homeId: "${validHomeId}" for isolation testing.`);

    // 2. Test RLS isolation using SET ROLE mosa_app
    console.log('\n2️⃣ Running RLS Isolation Test under "mosa_app" Role...');

    // TEST A: Valid home
    const resHome1 = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET ROLE mosa_app;`);
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_home_id', '${validHomeId}', true);`);
      const devices = await tx.$queryRawUnsafe(`SELECT id, name, "homeId" FROM "Device";`);
      const nodes = await tx.$queryRawUnsafe(`SELECT id, name, "homeId" FROM "Node";`);
      return { devices, nodes };
    });
    console.log(`   🔹 Valid Tenant "${validHomeId}" saw: ${resHome1.devices.length} device(s) and ${resHome1.nodes.length} node(s).`);

    // TEST B: home-2 (Foreign tenant)
    const resHome2 = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET ROLE mosa_app;`);
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_home_id', 'home-2', true);`);
      const devices = await tx.$queryRawUnsafe(`SELECT id, name, "homeId" FROM "Device";`);
      return devices;
    });
    console.log(`   🔹 Tenant "home-2" (Cross-tenant attempt) saw: ${resHome2.length} device(s).`);

    // TEST C: No Context (Fail-Closed)
    const resNoContext = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET ROLE mosa_app;`);
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_home_id', '', true);`);
      const devices = await tx.$queryRawUnsafe(`SELECT id, name, "homeId" FROM "Device";`);
      return devices;
    });
    console.log(`   🔹 Contextless/Unauthenticated attempt saw: ${resNoContext.length} device(s).`);

    console.log('\n================================================================');
    if (resHome2.length === 0 && resNoContext.length === 0 && resHome1.devices.length > 0) {
      console.log('🎉 100% POSTGRESQL RLS MULTI-TENANT ISOLATION FULLY VERIFIED & ACTIVE!');
    } else {
      console.log('⚠️ RLS VERIFICATION COMPLETED WITH WARNINGS');
    }
    console.log('================================================================');

  } catch (error) {
    console.error('Setup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
