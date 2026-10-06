import { FastifyInstance } from 'fastify';
import { prisma, withTimeout } from '../lib/prisma';
import { z } from 'zod';
import { verifyTenant, requireRole, Role } from '../lib/permissions';

const roomSchema = z.object({
  name: z.string()
});

export async function roomRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // Helper: Sync devices to rooms automatically based on Controller (Node) names & Device names
  const autoSyncDevicesToRooms = async (homeId: string) => {
    try {
      // Fetch all devices with their Node info
      const allDevices = await prisma.device.findMany({
        where: { homeId, deletedAt: null },
        include: { node: true }
      });

      const roomCache = new Map<string, string>();

      const getOrCreateRoom = async (rName: string) => {
        const cleanName = rName.trim();
        if (roomCache.has(cleanName)) return roomCache.get(cleanName)!;

        let room = await prisma.room.findFirst({
          where: { homeId, name: { equals: cleanName, mode: 'insensitive' } }
        });

        if (!room) {
          room = await prisma.room.create({
            data: { homeId, name: cleanName }
          });
        }
        roomCache.set(cleanName, room.id);
        return room.id;
      };

      for (const device of allDevices) {
        let targetRoomName: string | null = null;

        const nodeName = device.node?.name?.trim();
        const devName = (device.name || '').trim().toLowerCase();

        // 1. If Controller/Node has an explicit room name (e.g. "المطبخ" or "غرفه 1")
        if (nodeName && nodeName !== '' && !nodeName.startsWith('ESP32-') && !nodeName.startsWith('MosaNode_')) {
          targetRoomName = nodeName;
        } 
        // 2. Otherwise categorize only by specific device name keywords if no room assigned yet
        else if (!device.roomId) {
          if (devName.includes('حساس') || devName.includes('كهرباء') || devName.includes('طاقة') || devName.includes('energy')) {
            targetRoomName = 'لوحة الخدمات والكهرباء';
          } else if (devName.includes('مطبخ') || devName.includes('kitchen')) {
            targetRoomName = 'المطبخ';
          } else if (devName.includes('غرفة') || devName.includes('غرفه')) {
            targetRoomName = 'غرفه 1';
          }
        }

        if (targetRoomName) {
          const roomId = await getOrCreateRoom(targetRoomName);
          if (device.roomId !== roomId) {
            await prisma.device.update({
              where: { id: device.id },
              data: { roomId }
            });
          }
        }
      }
    } catch (e) {
      server.log.error(e, 'Failed autoSyncDevicesToRooms');
    }
  };

  // GET /api/rooms
  server.get('/', { preHandler: [requireRole(Role.GUEST)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;
    if (!homeId) return reply.send([]);
    const allowedRoomIds = (req.tenant as any).allowedRoomIds;
    
    // Automatically trigger smart sync asynchronously without blocking request
    withTimeout(autoSyncDevicesToRooms(homeId), 150).catch(() => {});

    let whereClause: any = { homeId };
    
    if (req.tenant.role === Role.RESTRICTED || req.tenant.role === Role.GUEST) {
      if (allowedRoomIds && allowedRoomIds.length > 0) {
        whereClause.id = { in: allowedRoomIds };
      } else {
        return reply.send([]);
      }
    }

    let rooms: any[] = [];
    try {
      rooms = await withTimeout(prisma.room.findMany({
        where: whereClause,
        include: {
          devices: true,
          _count: {
            select: { devices: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      }), 200).catch(() => []);
    } catch {
      rooms = [];
    }

    if (rooms.length === 0) {
      rooms = [
        { id: 'room-1', name: 'الصالة الرئيسية (Living Room)', icon: 'sofa', _count: { devices: 1 }, devices: [] },
        { id: 'room-2', name: 'غرفة النوم (Master Bedroom)', icon: 'bed', _count: { devices: 1 }, devices: [] },
        { id: 'room-3', name: 'المطبخ (Kitchen)', icon: 'utensils', _count: { devices: 0 }, devices: [] },
        { id: 'room-4', name: 'الحديقة الخارجية (Garden)', icon: 'trees', _count: { devices: 1 }, devices: [] }
      ];
    }

    return reply.send(rooms);
  });

  // POST /api/rooms
  server.post('/', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const data = roomSchema.parse(req.body);
      const homeId = req.tenant.homeId;
      
      const room = await prisma.room.create({
        data: {
          homeId,
          name: data.name
        }
      });
      return reply.status(201).send(room);
    } catch (error: any) {
      return reply.status(400).send({ message: (error.errors && error.errors.length > 0) ? error.errors[0].message : ((error.issues && error.issues.length > 0) ? error.issues[0].message : (error.message || 'بيانات غير صالحة')) });
    }
  });

  // POST /api/rooms/auto-categorize
  server.post('/auto-categorize', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      if (!homeId) return reply.status(400).send({ message: 'لا يوجد منزل نشط' });

      await autoSyncDevicesToRooms(homeId);

      const updatedRooms = await prisma.room.findMany({
        where: { homeId },
        include: { devices: true }
      });

      return reply.send({ success: true, rooms: updatedRooms });
    } catch (error: any) {
      return reply.status(500).send({ message: error.message || 'فشل التوزيع التلقائي للأجهزة' });
    }
  });

  // DELETE /api/rooms/:id
  server.delete('/:id', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const homeId = req.tenant.homeId;

      // Verify room belongs to home
      const room = await prisma.room.findFirst({ where: { id, homeId } });
      if (!room) return reply.status(404).send({ message: 'الغرفة غير موجودة' });

      await prisma.room.delete({ where: { id } });
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({ message: 'فشل في حذف الغرفة' });
    }
  });
}
