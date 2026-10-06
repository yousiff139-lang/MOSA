import { FastifyInstance } from 'fastify';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import { getTenantPrisma } from '../lib/tenantPrisma';
import { MqttService } from '../services/mqtt.service';
import { prisma } from '../lib/prisma';

import { getBoardId } from '../lib/mqtt';

export async function commandRoutes(server: FastifyInstance) {
  server.addHook('preHandler', verifyTenant);

  server.post('/', { preHandler: [requireRole(Role.GUEST)] }, async (req, reply) => {
    try {
      const body = (req.body as any) || {};
      const payload = body.payload || body;
      const boardId = body.boardId || payload.boardId || body.targetBoardId || payload.targetBoardId;
      const homeId = req.tenant.homeId;
      
      let targetBoard = boardId;
      let targetHomeId = homeId;
      let finalPayload = { ...(payload || {}) };

      let device = null;
      const targetDevId = payload.id !== undefined && payload.id !== null ? payload.id : (body.id !== undefined && body.id !== null ? body.id : (payload.deviceId || body.deviceId));
      if (targetDevId !== undefined && targetDevId !== null) {
        const idStr = String(targetDevId);
        
        let nodeConditions: any[] = [];
        if (boardId) {
          nodeConditions = [
            { nodeId: boardId },
            { node: { mac: boardId } },
            { node: { name: boardId } }
          ];
        }

        device = await prisma.device.findFirst({
          where: {
            OR: [
              { id: idStr },
              { id: `dev-${idStr}` },
              ...(typeof targetDevId === 'number' ? [
                {
                  pin: targetDevId,
                  ...(nodeConditions.length ? { OR: nodeConditions } : {})
                }
              ] : [])
            ]
          },
          include: { node: true, room: true }
        });
      }

      if (device) {
        if (device.node) {
          targetBoard = getBoardId(device.node, boardId);
          if (device.node.homeId) targetHomeId = device.node.homeId;
        } else if (device.nodeId) {
          targetBoard = getBoardId(null, device.nodeId);
        }

        // 🛡️ ROLE-BASED ACCESS CONTROL (RBAC)
        const isRestrictedRole = req.tenant.role === Role.RESTRICTED || req.tenant.role === Role.GUEST || (req.tenant.role as string) === 'RESTRICTED_USER';
        if (isRestrictedRole) {
          const allowedRoomIds = (req.tenant as any).allowedRoomIds || [];
          const allowedDeviceIds = (req.tenant as any).allowedDeviceIds || [];

          const isRoomAllowed = (device.roomId && allowedRoomIds.includes(device.roomId)) ||
                                (device.room?.name && allowedRoomIds.includes(device.room.name)) ||
                                (device.room?.id && allowedRoomIds.includes(device.room.id));

          const isDeviceAllowed = allowedDeviceIds.includes(device.id) || 
                                  (device.nodeId && allowedDeviceIds.includes(device.nodeId));

          if (!isRoomAllowed && !isDeviceAllowed) {
            return reply.status(403).send({ error: 'عذراً، هذا الجهاز غير مشمول ضمن الغرف أو الأجهزة المصرح لك بالتحكم بها' });
          }
        }

        if (device.pin !== null && device.pin !== undefined) {
          finalPayload.pin = device.pin;
        }
        const stateObj = (device.state as any) || {};
        if (stateObj.activeState) finalPayload.activeState = stateObj.activeState;
        if (stateObj.switchMode) finalPayload.switchMode = stateObj.switchMode;
        if (stateObj.switchPin !== undefined) finalPayload.inPin = stateObj.switchPin;

        const cmdType = String(payload.type || payload.action || body.type || body.action || '').toLowerCase();
        if (cmdType === 'toggle') {
          finalPayload.action = 'TOGGLE';
          const isCurrentlyOn = stateObj.isOn === true || stateObj.isOn === 'ON' || device.state === 'ON';
          const newState = isCurrentlyOn ? 'OFF' : 'ON';
          finalPayload.state = newState;

          // Update DB state
          const isNewOn = !isCurrentlyOn;
          await prisma.device.update({
            where: { id: device.id },
            data: { state: { ...stateObj, isOn: isNewOn } }
          }).catch(console.error);

          const userName = (req.tenant as any)?.name || (req.tenant as any)?.username || 'المستخدم';
          const roomName = (device as any)?.room?.name || '';
          const cmdLogMsg = `قام المستخدم (${userName}) بـ ${newState === 'ON' ? 'تشغيل' : 'إطفاء'} مفتاح "${device.name}"${roomName ? ` في ${roomName}` : ''}`;

          await prisma.auditLog.create({
            data: {
              homeId: req.tenant.homeId,
              userId: req.tenant.userId,
              action: cmdLogMsg,
              resource: `مخرج GPIO ${device.pin}`,
              resourceId: device.id,
              severity: 'INFO'
            }
          }).catch(console.error);

          const deviceStatePayload = {
            id: device.id,
            deviceId: device.id,
            nodeId: device.nodeId,
            boardId: targetBoard,
            pin: device.pin,
            state: newState,
            isOn: isNewOn,
            timestamp: Date.now()
          };

          if (server.io) {
            server.io.to(`home:${req.tenant.homeId}`).emit('device_state', deviceStatePayload);
            server.io.to(`home:${req.tenant.homeId}`).emit('device_state_changed', { id: device.id, state: { isOn: isNewOn } });
          }

          // Full list broadcast to all connected devices in home
          try {
            const { SocketService } = require('../services/socket.service');
            const allDevices = await prisma.device.findMany({
              where: { homeId: req.tenant.homeId, deletedAt: null },
              include: { node: true, room: true }
            });
            const mapped = allDevices.map((d: any) => {
              const sObj = (d.state as any) || {};
              const isOn = sObj.isOn ? 'ON' : 'OFF';
              return {
                id: d.id,
                name: d.name,
                type: d.type.toUpperCase(),
                pinNumber: d.pin,
                pin: d.pin,
                state: isOn,
                currentState: isOn,
                boardId: d.nodeId,
                controller: { name: d.node?.name },
                roomId: d.room?.id,
                room: d.room ? { name: d.room.name } : null
              };
            });
            await SocketService.broadcastDevices(server, req.tenant.homeId, mapped);
          } catch (e) {
            server.log.error(e, '[Socket Broadcast Error in command.ts]');
          }

          const notifTitle = newState === 'ON' ? 'تشغيل مفتاح 💡' : 'إطفاء مفتاح 🔌';
          
          await prisma.notification.create({
            data: {
              homeId: req.tenant.homeId,
              userId: req.tenant.userId,
              title: notifTitle,
              message: cmdLogMsg,
              type: 'INFO'
            }
          }).catch(console.error);

          if (server.io) {
            server.io.to(`home:${req.tenant.homeId}`).emit('notification', {
              id: `notif_cmd_${Date.now()}`,
              title: notifTitle,
              message: cmdLogMsg,
              type: 'INFO',
              timestamp: new Date().toISOString()
            });
          }

          server.io.to(`home:${req.tenant.homeId}`).emit('activity_log', {
            id: `log_cmd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            message: cmdLogMsg,
            details: `تحكم عن بُعد عبر المنصة | المخرج GPIO ${device.pin}`,
            timestamp: new Date().toISOString(),
            type: 'USER_ACTION'
          });
        }
      }

      // If targetBoard is not yet in MosaNode_ format, lookup Node
      if (!targetBoard || !targetBoard.startsWith('MosaNode_')) {
        const node = await prisma.node.findFirst({
          where: {
            OR: [
              { id: targetBoard },
              { mac: targetBoard },
              { name: targetBoard }
            ]
          }
        });
        if (node) {
          targetBoard = getBoardId(node, targetBoard);
          if (node.homeId) targetHomeId = node.homeId;
        } else {
          targetBoard = getBoardId(null, targetBoard);
        }
      }

      if (!finalPayload.action && payload.type) {
        finalPayload.action = String(payload.type).toUpperCase();
      }
      finalPayload.targetBoardId = targetBoard;
      finalPayload.boardId = targetBoard;

      console.log(`[Command Route] Publishing command to Topic mosa/${targetHomeId}/device/${targetBoard}/command Payload:`, JSON.stringify(finalPayload));

      // Use optimistic UI logic: publish command to MQTT broker
      let success = await MqttService.publishCommand(targetHomeId, targetBoard, finalPayload);
      if (!success && (server as any).mqtt) {
        try {
          const topic = `mosa/${targetHomeId}/device/${targetBoard}/command`;
          (server as any).mqtt.publish(topic, JSON.stringify(finalPayload), { qos: 1 });
          success = true;
        } catch (e) {}
      }
      
      if (!success) {
         return reply.status(504).send({ error: 'Device unresponsive (Timeout)', success: false });
      }
      
      // If non-toggle generic command, emit real event only if specific
      if (!device && payload.type) {
        let title = 'أمر المنظومة ⚙️';
        if (payload.type === 'security_alarm') title = 'نظام الحماية 🛡️';
        if (payload.type === 'media_control') title = 'مكبر الصوت 🔊';

        const notifMsg = `تم إرسال أمر ${payload.type} إلى الجهاز (${targetBoard})`;
        await prisma.notification.create({
          data: {
            homeId,
            userId: req.tenant.userId,
            title,
            message: notifMsg,
            type: payload.type === 'security_alarm' && payload.state === 'ARMED' ? 'ALERT' : 'INFO'
          }
        }).catch(console.error);

        server.io.to(`home:${homeId}`).emit('notification', {
          id: `notif_${Date.now()}`,
          title,
          message: notifMsg,
          type: payload.type === 'security_alarm' && payload.state === 'ARMED' ? 'ALERT' : 'INFO',
          timestamp: new Date().toISOString()
        });
      }
      
      return reply.send({ success: true, message: 'Command executed successfully' });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to send command' });
    }
  });

  server.post('/security/arm', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { state } = req.body as { state: string };
      const homeId = req.tenant.homeId;
      
      const topic = `mosa/${homeId}/system/security/command`;
      server.mqtt.publish(topic, JSON.stringify({ action: 'ARM', state }), { retain: true, qos: 1 });
      
      server.io.to(`home:${homeId}`).emit('notification', {
        title: 'نظام الحماية',
        message: state === 'ARMED' ? 'تم تفعيل نظام الحماية' : 'تم إيقاف نظام الحماية',
        type: state === 'ARMED' ? 'ALERT' : 'INFO'
      });
      
      // Persist the security state in database
      const securityState = await prisma.securityState.upsert({
        where: { homeId },
        update: { state },
        create: { homeId, state }
      });
      
      // Emit a global state update so frontend updates instantly if we had a global state for security
      server.io.to(`home:${homeId}`).emit('security:state', { state });

      return reply.send({ success: true, message: 'Security state updated', securityState });
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({ error: 'Failed to arm security system' });
    }
  });
}
