const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ take: 5 });
  console.log(users.map(u => ({ username: u.username, pinCode: u.pinCode })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
