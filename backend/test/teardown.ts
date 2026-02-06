import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function teardown() {
  console.log('Tearing down E2E test database...');

  // Clean up test data
  await prisma.message.deleteMany({});
  await prisma.deal.deleteMany({});
  await prisma.agentPerformance.deleteMany({});
  await prisma.agent.deleteMany({});
  await prisma.swarm.deleteMany({});
  await prisma.nft.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.user.deleteMany({});

  await prisma.$disconnect();
  console.log('E2E test database teardown complete');
}
