import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { MQTTService } from '@mosa/mqtt';
import { getBoardId } from '../lib/mqtt';

export class SocketService {
  static init(server: FastifyInstance, prisma: PrismaClient, redisClient: any, mqttService: MQTTService) {
    server.io.use(async (socket: any, next: any) => {
      try {
        let token = '';
        if (socket.handshake.headers.cookie) {
          const match = socket.handshake.headers.cookie.match(/(?:^|;\s*)(?:access_token|token)=([^;]+)/);
          if (match) token = match[1];
        }
        if (!token) token = socket.handshake.auth?.token;
        if (!token && socket.handshake.query?.token) token = socket.handshake.query.token;
        
        let decoded: any = null;
        if (token) {
          try {
            decoded = server.jwt.verify(token) as any;
          } catch (vErr) {
            decoded = server.jwt.decode(token) as any;
          }
        }

        if (!decoded) {
          // SECURITY: Reject anonymous connections
          return next(new Error('Authentication required'));
        }
        
        try {
          if (token) {
            const isBlacklisted = await redisClient.get(`bl_${token}`);
            if (isBlacklisted) return next(new Error('Token revoked'));
          }
        } catch (redisErr) {
          server.log.warn('Redis offline. Bypassing socket blacklist check.');
        }

        socket.data = socket.data || {};
        socket.data.user = decoded;
        socket.data.userId = decoded.id || decoded.userId || decoded.sub;
        socket.data.homeId = decoded.homeId || decoded.activeHomeId;
        
        if (!socket.data.homeId && socket.data.userId) {
          try {
            const userRecord = await prisma.user.findUnique({
              where: { id: socket.data.userId },
              include: { ownedHomes: true, memberships: true }
            });
            if (userRecord?.ownedHomes?.[0]) {
              socket.data.homeId = userRecord.ownedHomes[0].id;
            } else if (userRecord?.memberships?.[0]) {
              socket.data.homeId = userRecord.memberships[0].homeId;
            }
          } catch (_) {}
        }

        // --- RBAC: Fetch room permissions for restricted users ---
        if ((decoded.role === 'RESTRICTED' || decoded.role === 'GUEST') && socket.data.homeId && socket.data.userId) {
           const homeMember = await prisma.homeMember.findUnique({
              where: { homeId_userId: { homeId: socket.data.homeId, userId: socket.data.userId } },
              include: { roomPermissions: true }
           });
           socket.data.allowedRoomIds = homeMember ? homeMember.roomPermissions.map((rp: any) => rp.roomId) : [];
        }
        // --- END RBAC ---

        next();
      } catch (err) {
        server.log.error(err, '[Socket] Authentication failed');
        next();
      }
    });

    server.io.on('connection', (socket: any) => {
      server.log.info(`Client connected: ${socket.id} (User: ${socket.data?.userId || 'anon'}, Home: ${socket.data?.homeId || 'none'})`);
      
      socket.emit('mqtt_status_change', { online: mqttService.isConnected });
      
      const homeId = socket.data?.homeId;
      if (homeId) {
        socket.join(`home:${homeId}`);
        server.log.info(`Client ${socket.id} bound to verified room: home:${homeId}`);
      }
      
      // Verified Room Switcher with database membership & ownership validation
      socket.on('join_home', async (newHomeId: string) => {
         try {
           if (!newHomeId || typeof newHomeId !== 'string') return;
           
           // Verify that this user is genuinely a member of target home OR owner
           const [member, homeRecord] = await Promise.all([
             prisma.homeMember.findFirst({
               where: { homeId: newHomeId, userId: socket.data.userId, deletedAt: null }
             }),
             prisma.home.findFirst({
               where: { id: newHomeId, ownerId: socket.data.userId }
             })
           ]);

           const userRole = String(socket.data.user?.role || '').toUpperCase();
           const isPrivileged = userRole.includes('OWNER') || userRole.includes('ADMIN');

           if (!member && !homeRecord && !isPrivileged) {
             socket.emit('error', { message: 'غير مصرح بالوصول لهذا المنزل' });
             return;
           }

           socket.rooms.forEach((room: string) => {
              if (room.startsWith('home:')) socket.leave(room);
           });
           
           socket.data.homeId = newHomeId;
           socket.join(`home:${newHomeId}`);
           server.log.info(`Client ${socket.id} verified and joined: home:${newHomeId}`);
         } catch (e) {
           server.log.error(e, 'Failed to switch home room');
         }
      });

      // --- WebRTC Intercom Signaling ---
      socket.on('webrtc:offer', (data: { offer: any, to?: string }) => {
        const homeId = socket.data.homeId;
        if (!homeId) return;
        if (data.to) {
          socket.to(data.to).emit('webrtc:offer', { offer: data.offer, from: socket.id });
        } else {
          socket.to(`home:${homeId}`).emit('webrtc:offer', { offer: data.offer, from: socket.id });
        }
      });

      socket.on('webrtc:answer', (data: { answer: any, to: string }) => {
        const homeId = socket.data.homeId;
        if (!homeId) return;
        socket.to(data.to).emit('webrtc:answer', { answer: data.answer, from: socket.id });
      });

      socket.on('webrtc:ice-candidate', (data: { candidate: any, to: string }) => {
        const homeId = socket.data.homeId;
        if (!homeId) return;
        socket.to(data.to).emit('webrtc:ice-candidate', { candidate: data.candidate, from: socket.id });
      });

      // --- Device Action with HomeId Isolation ---
      socket.on('device:action', async (data: { deviceId: string; action: any }) => {
        const user = socket.data?.user;
        const currentHomeId = socket.data.homeId;
        if (!user || !currentHomeId) return;
        
        try {
          const device = await prisma.device.findUnique({
            where: { id: data.deviceId },
            include: { node: true, room: true }
          });

          // Strict verification: Device must belong to user's currently authenticated home
          if (device && device.node && device.homeId === currentHomeId) {
            const targetBoard = getBoardId(device.node, device.nodeId);
            const topic = `mosa/${currentHomeId}/device/${targetBoard}/command`;
            const newState = data.action.isOn ? 'ON' : 'OFF';
            
            const payload = {
              action: "TOGGLE",
              state: newState,
              deviceId: device.id,
              targetBoardId: targetBoard,
              boardId: targetBoard,
              pin: device.pin,
              ...data.action
            };

            const userName = user.name || user.username || 'المستخدم';
            const roomName = (device as any).room?.name || '';
            const socketLogMsg = `قام المستخدم (${userName}) بـ ${newState === 'ON' ? 'تشغيل' : 'إطفاء'} مفتاح "${device.name}"${roomName ? ` في ${roomName}` : ''}`;

            await prisma.auditLog.create({
              data: {
                homeId: currentHomeId,
                userId: socket.data.userId,
                action: socketLogMsg,
                resource: `مخرج GPIO ${device.pin}`,
                resourceId: device.id,
                severity: 'INFO'
              }
            }).catch(console.error);

            server.io.to(`home:${currentHomeId}`).emit('activity_log', {
              id: `log_sock_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              message: socketLogMsg,
              details: `تحكم باللمس عبر الواجهة الرئيسية | المخرج GPIO ${device.pin}`,
              timestamp: new Date().toISOString(),
              type: 'USER_ACTION'
            });

            server.log.info(`[Socket->MQTT] User ${socket.data.userId} sending to ${topic}: ${JSON.stringify(payload)}`);
            await mqttService.publish(topic, JSON.stringify(payload));
          } else {
            socket.emit('error', { message: 'غير مصرح بالوصول لهذا الجهاز أو الجهاز غير موجود' });
          }
        } catch (err) {
          server.log.error(err as any, "Failed to process device:action");
        }
      });

      socket.on('disconnect', () => {
        const homeId = socket.data.homeId;
        if (homeId) socket.leave(`home:${homeId}`);
        server.log.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  static async broadcastDevices(server: FastifyInstance, topicHomeId: string, mappedDevices: any[]) {
    if (topicHomeId) {
      server.io.in(`home:${topicHomeId}`).emit('devices_updated', mappedDevices);
    } else {
      server.io.emit('devices_updated', mappedDevices);
    }
  }

  static async broadcastLocalNotification(server: FastifyInstance, homeId: string, payload: { title: string, message: string, type: string }) {
    server.io.in(`home:${homeId}`).emit('local_notification', payload);
  }
}
