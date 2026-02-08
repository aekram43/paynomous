import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function setup() {
  console.log('Setting up E2E test database...');

  // Clean up any existing test data
  await prisma.message.deleteMany({});
  await prisma.deal.deleteMany({});
  await prisma.agentPerformance.deleteMany({});
  await prisma.agent.deleteMany({});
  await prisma.swarm.deleteMany({});
  await prisma.nft.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.user.deleteMany({});

  // Create seed data for testing
  const testUser = await prisma.user.create({
    data: {
      walletAddress: '0x1234567890123456789012345678901234567890',
    },
  });

  const testRoom = await prisma.room.create({
    data: {
      name: 'Test Room',
      collection: 'BAYC',
      status: 'active',
    },
  });

  const testNft = await prisma.nft.create({
    data: {
      tokenId: '1',
      collection: 'BAYC',
      name: 'Test NFT #1',
      imageUrl: 'https://example.com/image.png',
      currentOwner: '0x1234567890123456789012345678901234567890',
    },
  });

  console.log('E2E test database setup complete');
  global.__E2E_TEST_DATA__ = {
    testUserId: testUser.id,
    testUserWallet: testUser.walletAddress,
    testRoomId: testRoom.id,
    testNftId: testNft.id,
  };
}

export async function teardown() {
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
