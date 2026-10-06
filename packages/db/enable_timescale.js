const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS timescaledb;`);
    console.log("Extension enabled.");
    await prisma.$executeRawUnsafe(`SELECT create_hypertable('"EnergyLog"', 'timestamp', if_not_exists => TRUE);`);
    console.log("EnergyLog is now a hypertable.");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
