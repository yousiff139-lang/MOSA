const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding mock data...');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Create User
  const user = await prisma.user.upsert({
    where: { email: 'admin@mosa.iq' },
    update: {},
    create: {
      email: 'admin@mosa.iq',
      name: 'MOSA Admin',
      password: hashedPassword,
      role: 'SUPER_ADMIN'
    }
  });
  console.log('User created:', user.email);

  // Create Home
  const home = await prisma.home.upsert({
    where: { id: 'home_hq_1' },
    update: {},
    create: {
      id: 'home_hq_1',
      name: 'MOSA HQ Smart Home',
      location: 'Baghdad, Iraq',
      owner: {
        connect: { id: user.id }
      },
      members: {
        create: {
          userId: user.id,
          role: 'SUPER_OWNER'
        }
      }
    }
  });
  console.log('Home created:', home.name);

  // Create Room
  const room = await prisma.room.upsert({
    where: { id: 'room_living_1' },
    update: {},
    create: {
      id: 'room_living_1',
      name: 'صالة الجلوس',
      homeId: home.id
    }
  });
  console.log('Room created:', room.name);

  // Create Node (ESP32)
  const node1 = await prisma.node.upsert({
    where: { id: 'node_esp32_1' },
    update: {},
    create: {
      id: 'node_esp32_1',
      mac: '00:11:22:33:44:55',
      name: 'Smart Controller 1',
      homeId: home.id,
      status: 'online',
      protocol: 'WIFI',
    }
  });
  console.log('Node created:', node1.name);

  // Create Device (Relay)
  const device1 = await prisma.device.upsert({
    where: { id: 'dev_relay_1' },
    update: {},
    create: {
      id: 'dev_relay_1',
      nodeId: node1.id,
      homeId: home.id,
      roomId: room.id,
      type: 'relay',
      name: 'إضاءة السقف',
      state: { isOn: false },
    }
  });
  console.log('Device 1 created:', device1.name);

  // Create Device (AC Controller)
  const device2 = await prisma.device.upsert({
    where: { id: 'dev_ac_1' },
    update: {},
    create: {
      id: 'dev_ac_1',
      nodeId: node1.id,
      homeId: home.id,
      roomId: room.id,
      type: 'ac',
      name: 'مكيف السبلت',
      state: { isOn: true, temp: 24, mode: 'cool' },
    }
  });
  console.log('Device 2 created:', device2.name);

  console.log('Seeding complete. Devices are ready!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
