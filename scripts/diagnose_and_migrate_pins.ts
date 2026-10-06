import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🔍 MOSA PLATFORM — USER PINCODE HASHING DIAGNOSTIC AUDIT');
  console.log('================================================================\n');

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        pinCode: true,
        mustChangePin: true,
        createdAt: true
      }
    });

    console.log(`Total User Records in Database: ${users.length}\n`);

    let bcryptCount = 0;
    let md5LegacyCount = 0;
    let plainTextCount = 0;

    const nonBcryptUsers: any[] = [];

    for (const u of users) {
      const pin = u.pinCode || '';
      const isBcrypt = pin.startsWith('$2a$') || pin.startsWith('$2b$');

      if (isBcrypt) {
        bcryptCount++;
      } else {
        const isMd5 = /^[a-f0-9]{32}$/i.test(pin);
        if (isMd5) {
          md5LegacyCount++;
        } else {
          plainTextCount++;
        }
        nonBcryptUsers.push({
          id: u.id,
          username: u.username,
          type: isMd5 ? 'LEGACY_MD5' : 'PLAINTEXT',
          mustChangePin: u.mustChangePin
        });
      }
    }

    console.log('📊 DIAGNOSTIC RESULTS:');
    console.log(`  ✅ Secure bcrypt hashes ($2a$/$2b$): ${bcryptCount}`);
    console.log(`  ⚠️ Legacy MD5 hashes:               ${md5LegacyCount}`);
    console.log(`  🔴 Plaintext / Unhashed PINs:       ${plainTextCount}\n`);

    if (nonBcryptUsers.length > 0) {
      console.log('⚠️ NON-BCRYPT USERS REQUIRING ATTENTION:');
      console.table(nonBcryptUsers);
      console.log('\n🔒 Remediation Rule:');
      console.log('  To maintain backward safety, run with --flag-for-reset to mark these accounts for an obligatory PIN reset on next login.');
    } else {
      console.log('✅ 100% of user PINs are properly hashed with bcrypt. Safe to remove plaintext fallbacks.');
    }

    // Check if --flag-for-reset argument is passed
    if (process.argv.includes('--flag-for-reset') && nonBcryptUsers.length > 0) {
      console.log('\n🔄 Flagging non-bcrypt accounts with mustChangePin = true...');
      for (const target of nonBcryptUsers) {
        await prisma.user.update({
          where: { id: target.id },
          data: { mustChangePin: true }
        });
      }
      console.log('✅ Successfully flagged accounts for forced PIN reset.');
    }

  } catch (error) {
    console.error('Diagnostic error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
