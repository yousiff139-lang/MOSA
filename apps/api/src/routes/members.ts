import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { verifyTenant, requireRole, Role } from '../lib/permissions';

const updateRoomsSchema = z.object({
  roomIds: z.array(z.string())
});

export async function memberRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  // GET /api/homes/:homeId/members
  server.get('/:homeId/members', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    const { homeId } = req.params as { homeId: string };
    
    // Resolve real home ID!
    let targetHome = (homeId && homeId !== 'undefined' && homeId !== 'null' && homeId !== 'home-1' && homeId !== 'current' && homeId !== 'active') 
      ? homeId 
      : req.tenant.homeId;

    if (!targetHome || targetHome === 'home-1') {
      const firstHome = await prisma.home.findFirst();
      if (firstHome) targetHome = firstHome.id;
    }

    const members = await prisma.homeMember.findMany({
      where: targetHome ? { homeId: targetHome } : {},
      include: {
        user: { select: { id: true, name: true, username: true, role: true } },
        roomPermissions: { include: { room: true } },
        devicePermissions: { include: { device: true } }
      }
    });

    // Also fetch user roomAccess to ensure complete room permissions mapping
    const enrichedMembers = await Promise.all(members.map(async (m) => {
      const userRoomAccess = await prisma.roomAccess.findMany({
        where: { userId: m.userId },
        include: { room: true }
      }).catch(() => []);

      const existingRoomIds = new Set(m.roomPermissions.map(rp => rp.roomId));
      const extraPermissions = userRoomAccess
        .filter(ra => ra.room && !existingRoomIds.has(ra.roomId))
        .map(ra => ({
          id: `ra-${ra.roomId}`,
          homeMemberId: m.id,
          roomId: ra.roomId,
          room: ra.room
        }));

      return {
        ...m,
        roomPermissions: [...m.roomPermissions, ...extraPermissions]
      };
    }));

    if (enrichedMembers.length === 0) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, username: true, role: true }
      });
      return reply.send(allUsers.map(u => ({
        id: u.id,
        role: u.role || 'RESTRICTED',
        user: u,
        roomPermissions: [],
        devicePermissions: []
      })));
    }

    return reply.send(enrichedMembers);
  });

  // PUT /api/homes/:homeId/members/:memberId/rooms
  server.put('/:homeId/members/:memberId/rooms', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { homeId, memberId } = req.params as { homeId: string, memberId: string };
      const { roomIds, deviceIds, nodeIds, sectionPermissions, role } = req.body as { 
        roomIds?: string[], 
        deviceIds?: string[], 
        nodeIds?: string[], 
        sectionPermissions?: any, 
        role?: string 
      };

      // Find by homeMember id or userId
      let member = await prisma.homeMember.findFirst({
        where: { OR: [{ id: memberId }, { userId: memberId }] }
      });

      if (!member) {
        // Find user by memberId
        const targetUser = await prisma.user.findUnique({ where: { id: memberId } });
        if (targetUser) {
          let targetHome = (homeId && homeId !== 'undefined' && homeId !== 'null' && homeId !== 'home-1') ? homeId : req.tenant.homeId;
          if (!targetHome || targetHome === 'home-1') {
            const firstHome = await prisma.home.findFirst();
            if (firstHome) targetHome = firstHome.id;
          }
          member = await prisma.homeMember.create({
            data: {
              homeId: targetHome || 'home-1',
              userId: targetUser.id,
              role: role === 'ADMIN' ? 'ADMIN' : 'RESTRICTED'
            }
          });
        }
      }

      if (!member) {
        return reply.status(404).send({ message: 'العضو غير موجود' });
      }

      const realMemberId = member.id;

      // Update in transaction: update role, delete old permissions and create new ones
      await prisma.$transaction(async (tx) => {
        const rawDeviceIds = deviceIds || [];
        const rawNodeIds = nodeIds || [];
        const combinedIds = Array.from(new Set([...rawDeviceIds, ...rawNodeIds]));

        // Find all real device IDs matching these device or node IDs
        const existingDevices = await tx.device.findMany({
          where: {
            OR: [
              { id: { in: combinedIds } },
              { nodeId: { in: combinedIds } }
            ]
          },
          select: { id: true }
        });
        const validDeviceIds = Array.from(new Set(existingDevices.map(d => d.id)));

        const currentRestrictions = (member.restrictions as any) || {};
        const updatedRestrictions = {
          ...currentRestrictions,
          ...(sectionPermissions ? { sectionPermissions } : {}),
          allowedNodeIds: combinedIds
        };

        let mappedRole: any = member.role || 'RESTRICTED';
        if (role) {
          if (role.toUpperCase().includes('ADMIN')) mappedRole = 'ADMIN';
          else if (role.toUpperCase().includes('SUPER')) mappedRole = 'SUPER_OWNER';
          else if (role.toUpperCase().includes('MEMBER')) mappedRole = 'MEMBER';
          else mappedRole = 'RESTRICTED';
        }

        await tx.homeMember.update({
          where: { id: realMemberId },
          data: { 
            role: mappedRole,
            restrictions: updatedRestrictions
          }
        });

        await tx.user.update({
          where: { id: member.userId },
          data: { role: mappedRole }
        }).catch(() => {});

        if (roomIds && Array.isArray(roomIds)) {
          await tx.roomPermission.deleteMany({
            where: { homeMemberId: realMemberId }
          });
          const validRooms = await tx.room.findMany({
            where: { id: { in: roomIds } },
            select: { id: true }
          });
          if (validRooms.length > 0) {
            await tx.roomPermission.createMany({
              data: validRooms.map(r => ({ homeMemberId: realMemberId, roomId: r.id }))
            });
          }

          // Keep prisma.roomAccess in perfect sync!
          await tx.roomAccess.deleteMany({
            where: { userId: member.userId }
          });
          if (validRooms.length > 0) {
            await tx.roomAccess.createMany({
              data: validRooms.map(r => ({ userId: member.userId, roomId: r.id }))
            });
          }
        }

        if (deviceIds && Array.isArray(deviceIds)) {
          await tx.devicePermission.deleteMany({
            where: { homeMemberId: realMemberId }
          });
          if (validDeviceIds.length > 0) {
            await tx.devicePermission.createMany({
              data: validDeviceIds.map(deviceId => ({ homeMemberId: realMemberId, deviceId }))
            });
          }
        }
      });

      return reply.send({ message: 'تم تحديث الصلاحيات بنجاح' });
    } catch (error: any) {
      return reply.status(400).send({ message: error.message || 'خطأ في التحديث' });
    }
  });
}
