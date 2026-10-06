import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';

beforeAll(async () => {
  // Connect to the DB before running tests
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect after tests
  await prisma.$disconnect();
});
