const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Cleanup existing data in correct dependency order
  console.log('Cleaning up existing data...');
  await prisma.floorPlanDevice.deleteMany({});
  await prisma.floorPlan.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.node.deleteMany({});
  await prisma.roomAccess.deleteMany({});
  await prisma.roomPermission.deleteMany({});
  await prisma.devicePermission.deleteMany({});
  await prisma.scenePermission.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.homeMember.deleteMany({});
  await prisma.home.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create Admin User
  const passwordHash = await bcrypt.hash('1234', 10);
  const admin = await prisma.user.create({
    data: {
      id: 'admin-1',
      username: 'admin',
      pinCode: passwordHash,
      name: 'Sarah J.',
      role: 'SUPER_OWNER',
    },
  });
  console.log('Admin user created:', admin.username);

  // 2. Create a Home
  const home = await prisma.home.create({
    data: {
      id: 'home-1',
      name: 'My Primary Home',
      location: 'Baghdad',
      ownerId: 'admin-1',
    },
  });
  console.log('Home created:', home.name);

  // 3. Create HomeMember for Admin
  await prisma.homeMember.create({
    data: {
      id: 'hm-1',
      homeId: 'home-1',
      userId: 'admin-1',
      role: Role.SUPER_OWNER,
    }
  });
  console.log('Home member role set to SUPER_OWNER');

  // 4. Create a Floor Plan
  const floorPlan = await prisma.floorPlan.create({
    data: {
      id: 'fp-1',
      name: 'الطابق الأرضي',
      homeId: 'home-1',
    }
  });
  console.log('Floor plan created:', floorPlan.name);

  // 5. Create some Rooms
  const livingRoom = await prisma.room.create({
    data: {
      id: 'room-living',
      name: 'Living Room',
      homeId: 'home-1',
    }
  });
  
  const bedroom = await prisma.room.create({
    data: {
      id: 'room-bedroom',
      name: 'Bedroom',
      homeId: 'home-1',
    }
  });

  const kitchen = await prisma.room.create({
    data: {
      id: 'room-kitchen',
      name: 'Kitchen',
      homeId: 'home-1',
    }
  });
  console.log('Rooms created');

  // 6. Create Node
  const node = await prisma.node.create({
    data: {
      id: 'node-1',
      mac: 'AA:BB:CC:DD:EE:FF',
      ip: '192.168.1.100',
      name: 'Smart Controller 1',
      status: 'online',
      protocol: 'WIFI',
      homeId: 'home-1',
    }
  });
  console.log('Node created:', node.name);

  // 7. Create Devices with FloorPlan coordinates
  const devices = [
    { name: 'مصباح المعيشة 1', type: 'LIGHT', roomId: livingRoom.id, x: 150, y: 120 },
    { name: 'مصباح المعيشة 2', type: 'LIGHT', roomId: livingRoom.id, x: 280, y: 120 },
    { name: 'مصباح غرفة النوم', type: 'LIGHT', roomId: bedroom.id, x: 450, y: 180 },
    { name: 'مصباح المطبخ', type: 'LIGHT', roomId: kitchen.id, x: 600, y: 250 },
    { name: 'حساس الحرارة', type: 'SENSOR_TEMP', roomId: livingRoom.id, x: 200, y: 300 },
    { name: 'حساس الحركة', type: 'SENSOR_MOTION', roomId: livingRoom.id, x: 520, y: 380 },
  ];

  for (const [index, d] of devices.entries()) {
    const device = await prisma.device.create({
      data: {
        id: `dev-${index}`,
        name: d.name,
        type: d.type.toLowerCase(),
        pin: index,
        nodeId: node.id,
        roomId: d.roomId,
        homeId: 'home-1',
        state: { isOn: false },
      }
    });

    await prisma.floorPlanDevice.create({
      data: {
        id: `fpd-${index}`,
        floorPlanId: floorPlan.id,
        deviceId: device.id,
        x: d.x,
        y: d.y,
      }
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
