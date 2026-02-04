import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create BAYC NFTs (Bored Ape Yacht Club collection with 20+ NFTs)
  const baycNfts = [];
  for (let i = 1; i <= 25; i++) {
    const nft = await prisma.nft.create({
      data: {
        collection: 'BAYC',
        tokenId: i.toString(),
        name: `Bored Ape #${i}`,
        imageUrl: `https://ipfs.io/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/${i}`,
        metadata: {
          attributes: [
            { trait_type: 'Background', value: i % 2 === 0 ? 'Blue' : 'Orange' },
            { trait_type: 'Eyes', value: i % 3 === 0 ? 'Laser' : 'Normal' },
            { trait_type: 'Fur', value: i % 4 === 0 ? 'Golden' : 'Brown' },
            { trait_type: 'Hat', value: i % 5 === 0 ? 'Crown' : 'None' },
          ],
          rarity_score: Math.floor(Math.random() * 100) + 1,
        },
      },
    });
    baycNfts.push(nft);
    console.log(`Created NFT: ${nft.name}`);
  }

  // Create a sample room for BAYC collection
  const baycRoom = await prisma.room.create({
    data: {
      name: 'BAYC Trading Floor',
      collection: 'BAYC',
      status: 'active',
    },
  });
  console.log(`Created room: ${baycRoom.name}`);

  // Create additional collections for variety
  const coolCatsNfts = [];
  for (let i = 1; i <= 10; i++) {
    const nft = await prisma.nft.create({
      data: {
        collection: 'COOLCATS',
        tokenId: i.toString(),
        name: `Cool Cat #${i}`,
        imageUrl: `https://ipfs.io/ipfs/QmTyoiSf2U7Rv4j7FqLGAhJ4YnCdNgWpQZMVbB1Q8D8Xvf/${i}`,
        metadata: {
          attributes: [
            { trait_type: 'Face', value: i % 2 === 0 ? 'Happy' : 'Cool' },
            { trait_type: 'Body', value: i % 3 === 0 ? 'Striped' : 'Solid' },
          ],
          rarity_score: Math.floor(Math.random() * 100) + 1,
        },
      },
    });
    coolCatsNfts.push(nft);
    console.log(`Created NFT: ${nft.name}`);
  }

  // Create a room for Cool Cats
  const coolCatsRoom = await prisma.room.create({
    data: {
      name: 'Cool Cats Lounge',
      collection: 'COOLCATS',
      status: 'active',
    },
  });
  console.log(`Created room: ${coolCatsRoom.name}`);

  console.log('Seed completed successfully!');
  console.log(`Total NFTs created: ${baycNfts.length + coolCatsNfts.length}`);
  console.log(`Total rooms created: 2`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
