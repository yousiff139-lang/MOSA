const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.activityLog.deleteMany({});
  await prisma.motionLog.deleteMany({});
  await prisma.energyLog.deleteMany({});
  await prisma.floorPlanDevice.deleteMany({});
  await prisma.floorPlan.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.automation.deleteMany({});
  await prisma.routine.deleteMany({});
  await prisma.scene.deleteMany({});
  await prisma.roomAccess.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.tenantBranding.deleteMany({});
  await prisma.homeMember.deleteMany({});
  await prisma.home.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('Wiped');
}

main().catch(console.error).finally(() => prisma.$disconnect());
