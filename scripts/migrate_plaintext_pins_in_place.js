const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🔒 MOSA PLATFORM — IN-PLACE PLAINTEXT TO BCRYPT PIN MIGRATION');
  console.log('================================================================\n');

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        pinCode: true
      }
    });

    const targetUsers = users.filter(u => {
      const pin = u.pinCode || '';
      return !pin.startsWith('$2a$') && !pin.startsWith('$2b$');
    });

    if (targetUsers.length === 0) {
      console.log('✅ All users are already safely bcrypt hashed! No migration needed.');
      return;
    }

    console.log(`Found ${targetUsers.length} plaintext account(s) to migrate:\n`);

    for (const u of targetUsers) {
      const currentPlainPin = u.pinCode;
      console.log(`  🔄 Hashing PIN for username: "${u.username}" (ID: ${u.id})...`);
      
      const hashedPin = await bcrypt.hash(currentPlainPin, 10);
      
      await prisma.user.update({
        where: { id: u.id },
        data: {
          pinCode: hashedPin,
          mustChangePin: false
        }
      });
      console.log(`     ✅ Successfully encrypted and updated with bcrypt.\n`);
    }

    console.log('================================================================');
    console.log('🎉 MIGRATION COMPLETE: All plaintext PINs are now cryptographically secure.');
    console.log('================================================================');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
