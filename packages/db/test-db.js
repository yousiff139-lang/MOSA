const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { memberships: true }
  });
  console.log("Users:", JSON.stringify(users, null, 2));

  const homes = await prisma.home.findMany();
  console.log("Homes:", JSON.stringify(homes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
