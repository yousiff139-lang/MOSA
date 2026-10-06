const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🔍 MOSA PLATFORM — DATABASE RLS & SCHEMA AUDIT');
  console.log('================================================================\n');

  try {
    // 0. Check current database user superuser / bypassrls status
    const userRole = await prisma.$queryRaw`
      SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls
      FROM pg_roles 
      WHERE rolname = current_user;
    `;
    console.log('👤 CURRENT DATABASE CONNECTION USER & PRIVILEGES:');
    console.table(userRole);

    // 1. Check all tables and their RLS status in PostgreSQL
    const tables = await prisma.$queryRaw`
      SELECT 
        tablename, 
        rowsecurity,
        hasindexes
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename ASC;
    `;

    console.log('📋 POSTGRESQL TABLES & CURRENT RLS STATUS:');
    console.table(tables);

    // 2. Check which tables have a 'homeId' column directly
    const homeIdColumns = await prisma.$queryRaw`
      SELECT 
        table_name, 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND column_name = 'homeId'
      ORDER BY table_name ASC;
    `;

    console.log('\n🏠 TABLES WITH DIRECT "homeId" TENANT ISOLATION COLUMN:');
    console.table(homeIdColumns);

    // 3. Check existing RLS policies if any
    const policies = await prisma.$queryRaw`
      SELECT 
        schemaname, 
        tablename, 
        policyname, 
        permissive, 
        roles, 
        cmd, 
        qual
      FROM pg_policies 
      WHERE schemaname = 'public';
    `;

    console.log('\n🔒 ACTIVE POSTGRESQL RLS POLICIES:');
    if (policies.length === 0) {
      console.log('  ⚠️ No active PostgreSQL RLS policies currently registered (Application-level scoping only).');
    } else {
      console.table(policies);
    }

  } catch (error) {
    console.error('Audit failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
