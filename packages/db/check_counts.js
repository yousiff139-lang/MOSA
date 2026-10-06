const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
Promise.all([prisma.home.count(), prisma.user.count()])
  .then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
