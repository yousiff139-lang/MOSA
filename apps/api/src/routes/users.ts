import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { verifyTenant, Role, requireRole } from '../lib/permissions';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import QRCode from 'qrcode';

const inviteSchema = z.object({
  username: z.string(),
  pinCode: z.string().min(4, 'الرمز يجب أن يكون 4 أرقام على الأقل'),
  role: z.enum(['ADMIN', 'RESTRICTED_USER', 'MEMBER', 'SUPER_OWNER']),
  name: z.string().optional()
});

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'RESTRICTED_USER', 'MEMBER', 'SUPER_OWNER']),
});

const assignRoomSchema = z.object({
  roomId: z.string(),
});

export async function userRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  server.get('/me', async (req, reply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.tenant.userId }
      });
      if (!user) return reply.code(404).send({ error: 'User not found' });
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        role: req.tenant.role,
        homeId: req.tenant.homeId
      };
    } catch (e) {
      server.log.error(e);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  server.get('/me/homes', async (req, reply) => {
    try {
      const userId = req.tenant.userId;
      const memberships = await prisma.homeMember.findMany({
        where: { userId },
        include: { 
          home: {
            include: {
              _count: {
                select: { devices: true, nodes: true }
              }
            }
          }
        }
      });

      const homes = memberships.map(m => ({
        id: m.home.id,
        name: m.home.name,
        role: m.role,
        devicesCount: m.home._count?.devices || 0,
        nodesCount: m.home._count?.nodes || 0,
        isActive: m.home.id === req.tenant.homeId
      }));

      return reply.send(homes);
    } catch (e) {
      console.error('[API] /me/homes error:', e);
      return reply.status(500).send({ error: 'Failed to fetch homes' });
    }
  });

  server.post('/me/homes', async (req, reply) => {
    try {
      const { name } = req.body as { name: string };
      if (!name) return reply.status(400).send({ error: 'Name is required' });
      
      const userId = req.tenant.userId;
      
      const home = await prisma.home.create({
        data: {
          name,
          ownerId: userId
        }
      });
      
      await prisma.homeMember.create({
        data: {
          homeId: home.id,
          userId,
          role: 'SUPER_OWNER'
        }
      });
      
      return reply.send({ success: true, home: { id: home.id, name: home.name } });
    } catch (e) {
      console.error('[API] POST /me/homes error:', e);
      return reply.status(500).send({ error: 'Failed to create home workspace' });
    }
  });

  server.put('/me/homes/:homeId', async (req, reply) => {
    try {
      const { homeId } = req.params as { homeId: string };
      const { name } = req.body as { name: string };
      if (!name) return reply.status(400).send({ error: 'Name is required' });

      // Verify caller is owner or SUPER_OWNER of this specific home
      const member = await prisma.homeMember.findFirst({
        where: {
          homeId,
          userId: req.tenant.userId,
          role: 'SUPER_OWNER'
        }
      });
      const home = await prisma.home.findFirst({
        where: { id: homeId, ownerId: req.tenant.userId }
      });

      if (!member && !home && !req.tenant.isSuperAdmin) {
        return reply.status(403).send({ error: 'غير مصرح لك بتعديل هذا المنزل' });
      }

      await prisma.home.update({
        where: { id: homeId },
        data: { name }
      });

      return reply.send({ success: true, message: 'Home updated successfully' });
    } catch (e) {
      console.error('[API] PUT /me/homes error:', e);
      return reply.status(500).send({ error: 'Failed to update home' });
    }
  });

  server.delete('/me/homes/:homeId', async (req, reply) => {
    try {
      const { homeId } = req.params as { homeId: string };
      
      // Verify caller is owner or SUPER_OWNER of this specific home
      const member = await prisma.homeMember.findFirst({
        where: {
          homeId,
          userId: req.tenant.userId,
          role: 'SUPER_OWNER'
        }
      });
      const home = await prisma.home.findFirst({
        where: { id: homeId, ownerId: req.tenant.userId }
      });

      if (!member && !home && !req.tenant.isSuperAdmin) {
        return reply.status(403).send({ error: 'غير مصرح لك بحذف هذا المنزل' });
      }
      
      await prisma.homeMember.deleteMany({ where: { homeId } }).catch(() => {});
      await prisma.home.delete({ where: { id: homeId } }).catch(() => {});

      return reply.send({ success: true, message: 'Home deleted successfully' });
    } catch (e) {
      console.error('[API] DELETE /me/homes error:', e);
      return reply.status(500).send({ error: 'Failed to delete home' });
    }
  });

  // 1. GET /api/users
  server.get('/', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    // Only Admin can view users within the same home
    const users = await prisma.user.findMany({
      where: {
        memberships: { some: { homeId: req.tenant.homeId } }
      },
      include: {
        memberships: {
          where: { homeId: req.tenant.homeId }
        },
        roomAccess: {
          include: { room: true }
        }
      }
    });

    const mapped = users.map(u => {
      const membership = u.memberships?.[0];
      const effectiveRole = (membership?.role || u.role || 'RESTRICTED').toUpperCase();
      return {
        id: u.id,
        name: u.name || u.username,
        username: u.username,
        role: effectiveRole,
        createdAt: u.createdAt,
        roomAccess: (u as any).roomAccess ? (u as any).roomAccess.map((ra: any) => ({
          id: ra.room?.id,
          name: ra.room?.name || 'غرفة'
        })) : []
      };
    });

    return reply.send(mapped);
  });

  // GET /api/users/active-sessions - Real-time Connected Live Sockets & Active Users
  server.get('/active-sessions', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const homeId = req.tenant.homeId;
      
      // 1. Get real-time active socket connections from server.io
      const activeSockets = Array.from((server.io?.sockets?.sockets?.values() || [])) as any[];
      const homeSockets = activeSockets.filter(s => {
        const uHome = s.data?.user?.homeId || s.data?.user?.activeHomeId;
        return !homeId || uHome === homeId || uHome === 'home-1';
      });

      const liveList: any[] = [];
      const seenUserIds = new Set<string>();

      for (const s of homeSockets) {
        const u = s.data?.user || {};
        const uId = u.id || u.sub;
        if (uId && !seenUserIds.has(uId)) {
          seenUserIds.add(uId);
          liveList.push({
            id: s.id,
            userId: uId,
            userName: u.name || u.username || 'مستخدم متصل',
            username: u.username || 'user',
            userRole: (u.role || 'MEMBER').toUpperCase(),
            device: (s.handshake?.headers?.['user-agent'] as string) || 'متصفح ويب (مباشر)',
            ip: s.handshake?.address || req.ip || '127.0.0.1',
            createdAt: new Date().toISOString(),
            isLive: true
          });
        }
      }

      // If no sockets joined yet, at least show current requesting user as 1 online session
      if (liveList.length === 0 && req.tenant?.userId) {
        const tenantAny = req.tenant as any;
        liveList.push({
          id: 'curr_session',
          userId: req.tenant.userId,
          userName: tenantAny.name || tenantAny.username || 'المسؤول الحالي',
          username: tenantAny.username || 'admin',
          userRole: req.tenant.role,
          device: (req.headers['user-agent'] as string) || 'متصفح ويب',
          ip: req.ip,
          createdAt: new Date().toISOString(),
          isLive: true
        });
      }

      return reply.send(liveList);
    } catch (e: any) {
      console.error('[API] /active-sessions error:', e);
      return reply.send([]);
    }
  });

  // POST /api/users/:id/qr-login-pass - Generate QR Login Pass for a Specific User
  server.post('/:id/qr-login-pass', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const homeId = req.tenant.homeId;
      if (!homeId) return reply.status(400).send({ message: 'لا يوجد منزل محدد' });

      const targetUser = await prisma.user.findUnique({
        where: { id },
        include: {
          memberships: { where: { homeId } }
        }
      });

      if (!targetUser) {
        return reply.status(404).send({ message: 'المستخدم غير موجود' });
      }

      const home = await prisma.home.findUnique({ where: { id: homeId } });
      const membership = targetUser.memberships?.[0];
      const effectiveRole = (membership?.role || targetUser.role || 'RESTRICTED').toUpperCase();

      const rawToken = `mosa_qr_user_${targetUser.id}_${crypto.randomBytes(12).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 365 * 24 * 3600 * 1000); // 1 Year validity

      await prisma.inviteToken.create({
        data: {
          homeId,
          role: effectiveRole === 'ADMIN' ? 'ADMIN' : (effectiveRole === 'SUPER_OWNER' ? 'SUPER_OWNER' : (effectiveRole === 'MEMBER' ? 'MEMBER' : 'RESTRICTED')),
          tokenHash: rawToken,
          expiresAt
        }
      });

      // Construct direct invite URL with auto-login token
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const protocol = (req.headers['x-forwarded-proto'] as string) || (req.protocol || 'http');
      const directUrl = `${protocol}://${host}/auth/login?qr_token=${rawToken}&user=${encodeURIComponent(targetUser.username)}`;

      // Generate ultra high quality Cyberpunk QR Code
      const qrDataUrl = await QRCode.toDataURL(directUrl, {
        width: 480,
        margin: 2,
        color: {
          dark: '#00f0ff',
          light: '#0b0e14'
        }
      });

      return reply.send({
        success: true,
        token: rawToken,
        inviteUrl: directUrl,
        qrDataUrl,
        expiresAt,
        homeName: home?.name || 'منزلي الذكي',
        role: effectiveRole,
        user: {
          id: targetUser.id,
          name: targetUser.name || targetUser.username,
          username: targetUser.username,
          role: effectiveRole
        }
      });
    } catch (e: any) {
      console.error('[API] /api/users/:id/qr-login-pass error:', e);
      return reply.status(500).send({ message: 'فشل إنشاء باركود الدخول لهذا المستخدم' });
    }
  });

  // 2. POST /api/users/invite
  server.post('/invite', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const data = inviteSchema.parse(req.body);
      
      const existing = await prisma.user.findUnique({ where: { username: data.username } });
      if (existing) {
        return reply.status(400).send({ message: 'اسم المستخدم مسجل مسبقاً' });
      }

      let homeId: string | undefined = req.tenant.homeId;
      if (!homeId) {
        const membership = await prisma.homeMember.findFirst({
          where: { userId: req.tenant.userId }
        });
        homeId = membership?.homeId;
      }

      if (!homeId) {
        return reply.status(400).send({ message: 'لا يمتلك المستخدم الحالي منزلاً مسجلاً لإضافة أعضاء إليه' });
      }

      const hashedPinCode = await bcrypt.hash(data.pinCode, 10);

      const user = await prisma.user.create({
        data: {
          username: data.username,
          pinCode: hashedPinCode,
          name: data.name || data.username,
          role: data.role.toLowerCase()
        }
      });

      // Link to the home
      await prisma.homeMember.create({
        data: {
          homeId: homeId as string,
          userId: user.id,
          role: data.role === 'ADMIN' ? 'ADMIN' : (data.role === 'SUPER_OWNER' ? 'SUPER_OWNER' : (data.role === 'MEMBER' ? 'MEMBER' : 'RESTRICTED'))
        }
      });

      return reply.status(201).send({ userId: user.id, inviteMessage: 'تم إنشاء المستخدم بنجاح وتشفير رمزه بـ (Bcrypt Hash)' });
    } catch (error: any) {
      console.error('[API] /api/users/invite ERROR:', error);
      return reply.status(400).send({ message: (error.errors && error.errors.length > 0) ? error.errors[0].message : ((error.issues && error.issues.length > 0) ? error.issues[0].message : (error.message || 'بيانات غير صالحة')) });
    }
  });

  // POST /api/users/qr-invite - Generate Smart Home QR Code Access Pass
  server.post('/qr-invite', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { role = 'GUEST', name = 'ضيف المنزل', expiresInHours = 24, allowedRooms = [] } = req.body as any;
      const homeId = req.tenant.homeId;
      if (!homeId) return reply.status(400).send({ message: 'لا يوجد منزل محدد' });

      const home = await prisma.home.findUnique({ where: { id: homeId } });
      const rawToken = `mosa_qr_${crypto.randomBytes(16).toString('hex')}`;
      const expiresAt = new Date(Date.now() + (Number(expiresInHours) || 24) * 3600 * 1000);

      // Create InviteToken in DB
      await prisma.inviteToken.create({
        data: {
          homeId,
          role: role === 'ADMIN' ? 'ADMIN' : (role === 'MEMBER' ? 'MEMBER' : 'RESTRICTED'),
          tokenHash: rawToken,
          expiresAt
        }
      });

      // Construct direct invite URL
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const protocol = (req.headers['x-forwarded-proto'] as string) || (req.protocol || 'http');
      const directUrl = `${protocol}://${host}/auth/login?qr_token=${rawToken}&home=${encodeURIComponent(home?.name || 'Home')}`;

      // Generate ultra crisp QR Code Data URL
      const qrDataUrl = await QRCode.toDataURL(directUrl, {
        width: 480,
        margin: 2,
        color: {
          dark: '#00f0ff',
          light: '#0b0e14'
        }
      });

      return reply.send({
        success: true,
        token: rawToken,
        inviteUrl: directUrl,
        qrDataUrl,
        expiresAt,
        homeName: home?.name || 'منزلي الذكي',
        role,
        name
      });
    } catch (e: any) {
      console.error('[API] /qr-invite error:', e);
      return reply.status(500).send({ message: 'فشل إنشاء باركود الدعوة' });
    }
  });

  // PUT /api/users/:id - Comprehensive Edit User & Permissions
  server.put('/:id', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { name, username, role, pinCode, roomIds } = req.body as any;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (username) updateData.username = username;
      if (role) updateData.role = role.toLowerCase();
      if (pinCode && pinCode.length >= 4) {
        updateData.pinCode = await bcrypt.hash(pinCode, 10);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData
      });

      if (role && req.tenant.homeId) {
        await prisma.homeMember.updateMany({
          where: { userId: id, homeId: req.tenant.homeId },
          data: {
            role: role === 'ADMIN' ? 'ADMIN' : (role === 'SUPER_OWNER' ? 'SUPER_OWNER' : (role === 'MEMBER' ? 'MEMBER' : 'RESTRICTED'))
          }
        }).catch(() => {});
      }

      if (Array.isArray(roomIds)) {
        await prisma.roomAccess.deleteMany({ where: { userId: id } });
        for (const rId of roomIds) {
          if (rId) {
            await prisma.roomAccess.create({
              data: { userId: id, roomId: rId }
            }).catch(() => {});
          }
        }
      }

      return reply.send({
        success: true,
        user: updatedUser,
        message: 'تم تحديث بيانات وصلاحيات المستخدم بنجاح! 🔒'
      });
    } catch (e: any) {
      console.error('[API] PUT /api/users/:id error:', e);
      return reply.status(500).send({ message: e.message || 'فشل تحديث بيانات المستخدم' });
    }
  });

  // PUT /api/users/:id/password - Admin Edit User Password/PIN
  server.put('/:id/password', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { newPinCode } = req.body as { newPinCode: string };
      if (!newPinCode || newPinCode.length < 4) {
        return reply.status(400).send({ message: 'الرمز يجب أن يكون 4 أرقام على الأقل' });
      }

      const hashedPinCode = await bcrypt.hash(newPinCode, 10);
      await prisma.user.update({
        where: { id },
        data: { pinCode: hashedPinCode }
      });

      return reply.send({ success: true, message: 'تم تحديث وتشفير الرمز بنجاح بـ (Bcrypt Hash)' });
    } catch (error) {
      return reply.status(500).send({ message: 'حدث خطأ أثناء تعديل الرمز' });
    }
  });

  // 3. DELETE /api/users/:id
  server.delete('/:id', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const requestUser = req.tenant;

    if (requestUser?.userId === id) {
      return reply.status(403).send({ message: 'لا يمكنك حذف حسابك الخاص' });
    }

    try {
      await prisma.user.delete({ where: { id } });
      return reply.status(204).send();
    } catch (error) {
      return reply.status(404).send({ message: 'المستخدم غير موجود' });
    }
  });

  // 4. PATCH /api/users/:id/role
  server.patch('/:id/role', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const requestUser = req.tenant;

    if (requestUser?.userId === id) {
      return reply.status(403).send({ message: 'لا يمكنك تغيير دورك الخاص' });
    }

    try {
      const { role } = updateRoleSchema.parse(req.body);
      const updated = await prisma.user.update({
        where: { id },
        data: { role: role.toLowerCase() }
      });
      return reply.send(updated);
    } catch (error: any) {
      return reply.status(404).send({ message: 'المستخدم غير موجود' });
    }
  });

  // PUT /api/users/me/pin
  server.put('/me/pin', async (req, reply) => {
    try {
      const { oldPin, newPin } = req.body as any;
      const requestUser = req.tenant;
      
      const user = await prisma.user.findUnique({ where: { id: requestUser.userId } });
      if (!user) return reply.status(404).send({ message: 'المستخدم غير موجود' });

      // If they are forced to change, oldPin is assumed to be 0000 or empty, but we can verify it
      if (oldPin) {
        const isBcryptMatch = await bcrypt.compare(oldPin, user.pinCode).catch(() => false);
        if (!isBcryptMatch) {
          return reply.status(400).send({ message: 'الرمز القديم غير صحيح' });
        }
      } else if (!user.mustChangePin) {
        return reply.status(400).send({ message: 'الرمز القديم مطلوب' });
      }

      const hashedPinCode = await bcrypt.hash(newPin, 10);
      await prisma.user.update({ 
        where: { id: requestUser.userId }, 
        data: { 
          pinCode: hashedPinCode,
          mustChangePin: false
        } 
      });
      
      return reply.send({ message: 'تم تغيير الرمز السري بنجاح' });
    } catch (error) {
      return reply.status(500).send({ message: 'حدث خطأ أثناء تغيير الرمز' });
    }
  });

  // 5. POST /api/users/:id/reset-pin
  server.post('/:id/reset-pin', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const requestUser = req.tenant;

    if (requestUser?.userId === id) {
      return reply.status(403).send({ message: 'لا يمكنك إعادة تعيين رمزك الخاص من هنا. استخدم إعدادات حسابك.' });
    }

    try {
      const hashedPinCode = await bcrypt.hash('0000', 10);
      await prisma.user.update({
        where: { id },
        data: { 
          pinCode: hashedPinCode,
          mustChangePin: true 
        }
      });

      return reply.send({ success: true, message: 'تم إعادة تعيين الرمز إلى 0000' });
    } catch (error) {
      return reply.status(500).send({ message: 'حدث خطأ أثناء إعادة التعيين' });
    }
  });

  // ==========================================
  // ROOM ACCESS ROUTES
  // ==========================================

  // GET /api/users/:id/rooms
  server.get('/:id/rooms', async (req, reply) => {
    const { id } = req.params as { id: string };
    const access = await prisma.roomAccess.findMany({
      where: { userId: id },
      include: { room: true }
    });
    return reply.send(access.map(a => a.room));
  });

  // POST /api/users/:id/rooms
  server.post('/:id/rooms', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { roomId } = assignRoomSchema.parse(req.body);
      
      const existing = await prisma.roomAccess.findUnique({
        where: { userId_roomId: { userId: id, roomId } }
      });

      if (existing) {
        return reply.status(400).send({ message: 'هذا المستخدم لديه صلاحية وصول لهذه الغرفة مسبقاً' });
      }

      const access = await prisma.roomAccess.create({
        data: { userId: id, roomId }
      });
      return reply.status(201).send(access);
    } catch (error: any) {
      return reply.status(404).send({ message: 'الغرفة غير موجودة أو المستخدم غير موجود' });
    }
  });

  // DELETE /api/users/:id/rooms/:roomId
  server.delete('/:id/rooms/:roomId', async (req, reply) => {
    const { id, roomId } = req.params as { id: string, roomId: string };
    try {
      await prisma.roomAccess.delete({
        where: { userId_roomId: { userId: id, roomId } }
      });
      return reply.status(204).send();
    } catch (error) {
      return reply.status(404).send({ message: 'صلاحية الوصول غير موجودة' });
    }
  });
}
