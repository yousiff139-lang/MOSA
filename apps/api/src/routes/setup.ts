import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

export const setupRoutes = async (server: FastifyInstance) => {
  
  // Check if system is already initialized
  server.get('/status', async (req, reply) => {
    try {
      const { withTimeout } = await import('../lib/prisma');
      const userCount = await withTimeout(prisma.user.count(), 200).catch(() => 1);
      return reply.send({ isInitialized: userCount > 0 });
    } catch (error) {
      return reply.send({ isInitialized: true });
    }
  });

  // Initialize the first Admin and Home
  server.post('/init', async (req, reply) => {
    try {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        const { name, username, pinCode } = req.body as any;
        if (username && pinCode) {
          const hashedPinCode = await bcrypt.hash(pinCode, 10);
          const existingUser = await prisma.user.findFirst({
            where: { OR: [{ username }, { role: 'SUPER_OWNER' }] }
          });
          if (existingUser) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { username, pinCode: hashedPinCode, name: name || existingUser.name }
            });
            return reply.send({ success: true, message: 'Admin credentials updated successfully' });
          }
        }
        return reply.send({ success: true, alreadyInitialized: true });
      }

      const { name, username, pinCode, homeName } = req.body as any;

      if (!name || !username || !pinCode || !homeName) {
        return reply.status(400).send({ error: 'All fields are required.' });
      }

      const hashedPinCode = await bcrypt.hash(pinCode, 10);

      // Create User
      const user = await prisma.user.create({
        data: {
          username,
          pinCode: hashedPinCode,
          name,
          role: 'admin',
        }
      });

      // Create Home
      const home = await prisma.home.create({
        data: {
          name: homeName,
          ownerId: user.id
        }
      });

      // Link User to Home as SUPER_OWNER
      await prisma.homeMember.create({
        data: {
          userId: user.id,
          homeId: home.id,
          role: 'SUPER_OWNER'
        }
      });

      // Initialize TenantBranding
      await prisma.tenantBranding.upsert({
        where: { tenantId: home.id },
        update: { platformName: homeName },
        create: {
          tenantId: home.id,
          platformName: homeName
        }
      });

      return reply.send({ success: true, message: 'MOSA OS Initialized Successfully.' });

    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to initialize system' });
    }
  });

  // Setup Wizard for configuring rooms and first device after initial login
  server.post('/wizard', async (req, reply) => {
    try {
      const { homeName, rooms, firstDevice } = req.body as any;

      if (!homeName || !rooms || !Array.isArray(rooms)) {
        return reply.status(400).send({ error: 'بيانات غير مكتملة لتأسيس المنزل.' });
      }

      // Find the first home in the system
      const home = await prisma.home.findFirst({
        orderBy: { createdAt: 'asc' }
      });

      if (!home) {
        return reply.status(404).send({ error: 'لم يتم العثور على منزل للتأسيس. يرجى تهيئة النظام أولاً.' });
      }

      // Update home name
      await prisma.home.update({
        where: { id: home.id },
        data: { name: homeName }
      });

      // Clear existing rooms & nodes for fresh setup
      await prisma.room.deleteMany({ where: { homeId: home.id } });
      await prisma.node.deleteMany({ where: { homeId: home.id } });

      // Create new rooms
      const createdRooms = [];
      for (const roomName of rooms) {
        const r = await prisma.room.create({
          data: {
            name: roomName,
            homeId: home.id
          }
        });
        createdRooms.push(r);
      }

      // Create first device if provided
      if (firstDevice && firstDevice.name && firstDevice.type) {
        // Create dummy controller Node
        const node = await prisma.node.create({
          data: {
            mac: '00:11:22:33:44:55',
            name: 'لوحة التحكم الرئيسية',
            ip: '192.168.1.10',
            status: 'online',
            homeId: home.id
          }
        });

        // Find roomId for the device
        const targetRoom = createdRooms.find(r => r.name === firstDevice.room) || createdRooms[0];

        // Create Device
        await prisma.device.create({
          data: {
            nodeId: node.id,
            homeId: home.id,
            roomId: targetRoom ? targetRoom.id : null,
            name: firstDevice.name,
            type: firstDevice.type.toLowerCase(),
            state: { isOn: false },
            pin: 4
          }
        });
      }

      return reply.send({ success: true, message: 'تم تأسيس إعدادات المنزل والغرف بنجاح.' });

    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'فشل تأسيس إعدادات المنزل.' });
    }
  });

  // POST /api/setup/demo
  server.post('/demo', async (req, reply) => {
    try {
      let home = await prisma.home.findFirst();
      if (!home) {
        let user = await prisma.user.findFirst();
        if (!user) {
          const hashedDemoPin = await bcrypt.hash('123456', 10);
          user = await prisma.user.create({
            data: {
              username: 'demo_user',
              name: 'مستخدم تجريبي',
              pinCode: hashedDemoPin,
            }
          });
        }
        home = await prisma.home.create({
          data: { name: 'منزل العرض التجريبي (Demo House)', ownerId: user.id }
        });
      }

      let livingRoom = await prisma.room.findFirst({ where: { name: 'الصالة' } });
      if (!livingRoom) {
        livingRoom = await prisma.room.create({ data: { name: 'الصالة', homeId: home.id } });
      }
      let kitchen = await prisma.room.findFirst({ where: { name: 'المطبخ' } });
      if (!kitchen) {
        kitchen = await prisma.room.create({ data: { name: 'المطبخ', homeId: home.id } });
      }

      const node = await prisma.node.create({
        data: {
          mac: 'AA:BB:CC:DD:EE:FF',
          name: 'لوحة MOSA تجريبية',
          ip: '192.168.1.150',
          status: 'online',
          homeId: home.id
        }
      });

      const dev1 = await prisma.device.create({
        data: {
          nodeId: node.id,
          homeId: home.id,
          roomId: livingRoom.id,
          name: 'التكييف الذكي (AC)',
          type: 'climate',
          state: { isOn: true, temp: 22 },
          pin: 5
        }
      });

      const dev2 = await prisma.device.create({
        data: {
          nodeId: node.id,
          homeId: home.id,
          roomId: kitchen.id,
          name: 'المضخة',
          type: 'switch',
          state: { isOn: true },
          pin: 12
        }
      });

      await prisma.energyLog.createMany({
        data: [
          { deviceId: dev1.id, powerW: 2400 },
          { deviceId: dev1.id, powerW: 2200 },
          { deviceId: dev2.id, powerW: 800 }
        ]
      });

      return reply.send({ success: true, message: 'تم إعداد حساب المعاينة والتجربة الميدانية المسبقة بنجاح.' });
    } catch (e) {
      server.log.error(e);
      return reply.status(500).send({ error: 'فشل تهيئة بيئة التجربة الميدانية.' });
    }
  });
};
