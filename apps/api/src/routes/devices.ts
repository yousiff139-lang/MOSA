import { FastifyInstance } from 'fastify';
import { prisma, withTimeout } from '../lib/prisma';
import { z } from 'zod';
import { verifyTenant, requireRole, Role } from '../lib/permissions';
import crypto from 'crypto';
import { getTenantPrisma } from '../lib/tenantPrisma';
import { ActivityService } from '../services/activity.service';
import { randomBytes, createHash } from 'crypto';

import { getBoardId } from '../lib/mqtt';

// ==============================================================================
// ESP32-S3-WROOM-2 (8MB Octal PSRAM) Pin Validation Guards
// Reference: ESP32-S3 Technical Reference Manual (TRM) & Datasheet Section 2.2 / Table 2-1
// Master Truth Table: Enforces 8MB Octal PSRAM, Silicon Die Gap, Input-Only & UART0
// ==============================================================================

export const isSafeOutputGpio = (pin: number): boolean => {
  if (pin <= 0 || pin > 48) return false;
  // Non-existent silicon gap (22..25 do not exist on ESP32-S3 die)
  if (pin >= 22 && pin <= 25) return false;
  // Dedicated SPI Flash bus (26..32)
  if (pin >= 26 && pin <= 32) return false;
  // 8MB Octal SPI PSRAM bus on WROOM-2 (33..37)
  if (pin >= 33 && pin <= 37) return false;
  // Dedicated UART0 TX/RX tied to onboard CH343 USB Serial bridge (43, 44)
  if (pin === 43 || pin === 44) return false;
  // Hardware constraint: GPIO 46 is fixed input-only in silicon (no output driver)
  if (pin === 46) return false;
  return true;
};

export const isSafeInputGpio = (pin: number): boolean => {
  if (pin <= 0 || pin > 48) return false;
  // Non-existent silicon gap (22..25 do not exist on ESP32-S3 die)
  if (pin >= 22 && pin <= 25) return false;
  // Dedicated SPI Flash bus (26..32)
  if (pin >= 26 && pin <= 32) return false;
  // 8MB Octal SPI PSRAM bus on WROOM-2 (33..37)
  if (pin >= 33 && pin <= 37) return false;
  // Dedicated UART0 TX/RX tied to onboard CH343 USB Serial bridge (43, 44)
  if (pin === 43 || pin === 44) return false;
  // Note: GPIO 46 is a valid input pad
  return true;
};

// Backwards compatibility alias
export const isSafeGpioPin = isSafeOutputGpio;

export const createDeviceSchema = z.object({
  name: z.string(),
  type: z.enum(['LIGHT', 'RGB', 'CURTAIN', 'SOCKET', 'SENSOR_TEMP', 'SENSOR_MOTION', 'SENSOR_DOOR', 'CLIMATE', 'CAMERA', 'LOCK', 'PUMP', 'MOISTURE', 'ENERGY', 'TEMPERATURE']),
  pinNumber: z.number().min(0, 'رقم الـ Pin غير صالح').max(48, 'أقصى رقم منفذ متاح هو 48'),
  pinMode: z.enum(['INPUT', 'OUTPUT']).optional().default('OUTPUT'),
  activeState: z.enum(['HIGH', 'LOW']).optional().default('HIGH'),
  switchPin: z.union([z.number(), z.string()]).optional().nullable(),
  inPin: z.union([z.number(), z.string()]).optional().nullable(),
  inpin: z.union([z.number(), z.string()]).optional().nullable(),
  switchMode: z.enum(['GND', 'VCC']).optional().default('GND'),
  controllerId: z.string(),
  roomId: z.string().optional(),
  ipAddress: z.string().optional(),
})
.refine(
  (data) => {
    if (data.type === 'CAMERA') return true;
    return isSafeOutputGpio(data.pinNumber);
  },
  { message: 'منفذ المخرج (Relay Out) محظور هاردويرياً على ESP32-S3 (محجوز لذاكرة الفلاش/الرام/السيريال/فجوة السيليكون أو مدخل فقط)', path: ['pinNumber'] }
)
.refine(
  (data) => {
    const raw = data.switchPin ?? data.inPin ?? data.inpin;
    if (raw === undefined || raw === null || raw === '' || raw === -1) return true;
    const sPin = Number(raw);
    if (isNaN(sPin)) return false;
    return isSafeInputGpio(sPin);
  },
  { message: 'منفذ السويتش (Switch In) محظور هاردويرياً على ESP32-S3 (محجوز لذاكرة الفلاش/الرام/السيريال/فجوة السيليكون)', path: ['switchPin'] }
);

export const toggleDeviceSchema = z.object({
  state: z.enum(['ON', 'OFF']),
});

export async function deviceRoutes(server: FastifyInstance) {
  // Pre-handlers apply to all routes in this plugin instance
  server.addHook('preHandler', verifyTenant);

  server.post('/bulk-toggle', { preHandler: [requireRole(Role.MEMBER)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;
    if (!homeId) return reply.status(400).send({ error: 'No active home' });

    const { deviceIds, roomId, type, state } = req.body as {
      deviceIds?: string[];
      roomId?: string;
      type?: string;
      state: 'ON' | 'OFF';
    };

    if (!state || (state !== 'ON' && state !== 'OFF')) {
      return reply.status(400).send({ error: 'Invalid state specified' });
    }

    let whereClause: any = { homeId, deletedAt: null };
    if (deviceIds && Array.isArray(deviceIds) && deviceIds.length > 0) {
      whereClause.id = { in: deviceIds };
    } else if (roomId) {
      whereClause.roomId = roomId;
    } else if (type) {
      whereClause.type = type;
    }

    const devices = await prisma.device.findMany({
      where: whereClause,
      // PERFORMANCE FIX #3: Pre-load node data to avoid N+1 queries
      // Instead of using include (which still queries nodes separately in the loop),
      // use select to explicitly fetch only what we need
      select: {
        id: true,
        nodeId: true,
        pin: true,
        state: true,
        node: {
          select: {
            id: true,
            mac: true
          }
        }
      }
    });

    if (devices.length === 0) {
      return reply.send({ success: true, count: 0 });
    }

    const isPayloadOn = state === 'ON';

    // 1. Bulk update DB state
    await prisma.device.updateMany({
      where: { id: { in: devices.map(d => d.id) } },
      data: { state: { isOn: isPayloadOn } }
    });

    // 2. Publish MQTT commands concurrently
    const publishPromises = devices.map(async (device) => {
      const node = device.node;
      const targetBoardId = getBoardId(node, device.nodeId);
      const commandTopic = `mosa/${homeId}/device/${targetBoardId}/command`;
      const payload = JSON.stringify({
        deviceId: device.id,
        targetBoardId: targetBoardId,
        boardId: targetBoardId,
        pin: device.pin,
        state: state,
        isOn: isPayloadOn,
        timestamp: Date.now()
      });
      return server.mqtt.publish(commandTopic, payload);
    });

    await Promise.allSettled(publishPromises);

    // 3. Log Activity
    ActivityService.log({
      homeId,
      userId: (req.user as any)?.id,
      action: 'BULK_DEVICE_TOGGLE',
      targetType: 'DEVICE_GROUP',
      targetId: roomId || type || 'bulk',
      metadata: { count: devices.length, state }
    });

    return reply.send({
      success: true,
      count: devices.length,
      state
    });
  });

  server.get('/', { preHandler: [requireRole(Role.GUEST)] }, async (req, reply) => {
    const homeId = req.tenant.homeId;
    if (!homeId) return reply.send({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false } });
    
    const query = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    const isPaginated = query.page !== undefined || query.limit !== undefined;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50', 10)));
    const skip = (page - 1) * limit;

    const tPrisma = getTenantPrisma(homeId);
    const allowedRoomIds = (req.tenant as any).allowedRoomIds;
    const allowedDeviceIds = (req.tenant as any).allowedDeviceIds;

    let whereClause: any = { homeId, deletedAt: null };
    if (query.search) {
      whereClause.name = { contains: query.search, mode: 'insensitive' };
    }

    if (req.tenant.role === Role.RESTRICTED || req.tenant.role === Role.GUEST) {
      const conditions: any[] = [];
      if (allowedRoomIds && allowedRoomIds.length > 0) {
        conditions.push({ roomId: { in: allowedRoomIds } });
      }
      if (allowedDeviceIds && allowedDeviceIds.length > 0) {
        conditions.push({ id: { in: allowedDeviceIds } });
        conditions.push({ nodeId: { in: allowedDeviceIds } });
      }
      if (conditions.length > 0) {
        whereClause.OR = conditions;
      } else {
        return reply.send(isPaginated ? { data: [], meta: { total: 0, page, limit, totalPages: 0, hasNext: false, hasPrev: false } } : []);
      }
    }

    let devices: any[] = [];
    let total = 0;
    try {
      const res = await Promise.all([
        withTimeout(tPrisma.device.findMany({ 
          where: whereClause,
          skip: isPaginated ? skip : undefined,
          take: isPaginated ? limit : undefined,
          orderBy: query.sortBy ? { [query.sortBy]: query.sortOrder || 'desc' } : { createdAt: 'desc' },
          include: { room: true, node: true } 
        }), 200).catch(() => []),
        withTimeout(tPrisma.device.count({ where: whereClause }), 200).catch(() => 0)
      ]);
      devices = (res[0] as any) || [];
      total = (res[1] as any) || 0;
    } catch {
      devices = [];
      total = 0;
    }

    // SECURITY FIX #16: Return empty array when no devices exist (no fake data)
    // The frontend should detect this and show onboarding UI instead
    const isEmpty = devices.length === 0 && !query.search;

    const mapped = devices.map((d: any) => {
      const stateObj = (d.state as any) || {};
      const isOn = stateObj.isOn ? 'ON' : 'OFF';
      const rawSwitchPin = stateObj.switchPin ?? stateObj.inPin ?? stateObj.inpin ?? (d as any).inPin ?? null;
      return {
        id: d.id,
        name: d.name,
        type: d.type.toUpperCase(),
        pinNumber: d.pin,
        pin: d.pin,
        activeState: stateObj.activeState || 'HIGH',
        switchPin: rawSwitchPin,
        inPin: rawSwitchPin,
        inpin: rawSwitchPin,
        switchMode: stateObj.switchMode || 'GND',
        ipAddress: d.ipAddress,
        state: isOn,
        currentState: isOn,
        boardId: d.nodeId,
        controller: { name: d.node?.name },
        roomId: d.roomId,
        room: d.room ? { id: d.room.id, name: d.room.name } : null
      };
    });

    if (isPaginated) {
      return reply.send({
        data: mapped,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
          isEmpty  // Flag for frontend to show onboarding UI
        }
      });
    }

    return reply.send(mapped);
  });

  server.post('/', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const body = (req.body as any) || {};
      if (body.pin !== undefined && body.pinNumber === undefined) body.pinNumber = Number(body.pin);
      if (body.boardId !== undefined && body.controllerId === undefined) body.controllerId = String(body.boardId);
      const rawInPin = body.switchPin ?? body.inPin ?? body.inpin;
      if (rawInPin !== undefined && rawInPin !== null && rawInPin !== '' && rawInPin !== -1) {
        body.switchPin = Number(rawInPin);
      } else {
        body.switchPin = null;
      }
      const data = createDeviceSchema.parse(body);
      const homeId = req.tenant.homeId;
      const tPrisma = getTenantPrisma(homeId);

      // Quota Limit Checking
      const subscription = await prisma.tenantSubscription.findFirst({
        where: { homeId }
      });
      
      let maxDevices = 999999; // Platform is completely free with unlimited devices
      
      const currentDevicesCount = await prisma.device.count({
        where: { homeId, deletedAt: null }
      });

      if (currentDevicesCount >= maxDevices) {
        return reply.status(403).send({ 
          message: `عذراً، لقد تجاوزت الحد الأقصى للأجهزة المسموح بها في باقتك الحالية (${maxDevices} أجهزة). يرجى ترقية باقتك للبدء في إضافة المزيد.` 
        });
      }
      
      let controller = await tPrisma.node.findFirst({
        where: {
          OR: [
            { id: data.controllerId },
            { mac: data.controllerId },
            { mac: data.controllerId.replace('MosaNode_', '').replace(/:/g, '') }
          ]
        }
      });
      if (!controller) {
        controller = await prisma.node.findFirst({
          where: {
            OR: [
              { id: data.controllerId },
              { mac: data.controllerId },
              { mac: data.controllerId.replace('MosaNode_', '').replace(/:/g, '') }
            ]
          }
        });
      }
      if (!controller) return reply.status(404).send({ message: 'المتحكم غير موجود أو لا يتبع لمنزلك' });

      // Check if GPIO pin or switch pin is already used by another device on this controller
      const existingDevices = await prisma.device.findMany({
        where: {
          OR: [
            { nodeId: controller.id },
            { nodeId: data.controllerId }
          ],
          deletedAt: null
        }
      });

      for (const d of existingDevices) {
        const dPin = d.pin;
        const dSwitchPin = (d.state as any)?.switchPin;

        if (dPin === data.pinNumber) {
          return reply.status(400).send({ message: `عذراً، منفذ GPIO ${data.pinNumber} مستخدم بالفعل في جهاز آخر ("${d.name}") على نفس هذا المتحكم.` });
        }
        if (dSwitchPin && dSwitchPin === data.pinNumber) {
          return reply.status(400).send({ message: `عذراً، منفذ GPIO ${data.pinNumber} مستخدم بالفعل كسويتش خارجي لجهاز آخر ("${d.name}") على نفس هذا المتحكم.` });
        }
        if (data.switchPin) {
          if (dPin === data.switchPin) {
            return reply.status(400).send({ message: `عذراً، منفذ السويتش GPIO ${data.switchPin} مستخدم كمنفذ رئيسي لجهاز آخر ("${d.name}") على نفس هذا المتحكم.` });
          }
          if (dSwitchPin && dSwitchPin === data.switchPin) {
            return reply.status(400).send({ message: `عذراً، منفذ السويتش GPIO ${data.switchPin} مستخدم كسويتش خارجي لجهاز آخر ("${d.name}") على نفس هذا المتحكم.` });
          }
        }
      }

      const device = await tPrisma.device.create({
        data: {
          homeId,
          name: data.name,
          type: data.type.toLowerCase(),
          pin: data.pinNumber,
          nodeId: controller.id,
          roomId: data.roomId,
          ipAddress: data.ipAddress,
          state: { pinMode: data.pinMode, isOn: false, switchPin: data.switchPin, activeState: data.activeState, switchMode: data.switchMode }
        }
      });

      const username = `device_${device.id}`;
      const password = randomBytes(32).toString('hex');
      const passwordHash = createHash('sha256').update(password).digest('hex');

      await tPrisma.deviceCredential.create({
        data: { deviceId: device.id, username, passwordHash }
      });

      await ActivityService.log({
        homeId,
        userId: req.tenant.userId,
        action: 'DEVICE_CREATED',
        targetType: 'DEVICE',
        targetId: device.id,
        ipAddress: req.ip
      });

      const createMsg = `تمت إضافة جهاز جديد: ${device.name}`;
      await prisma.auditLog.create({
        data: {
          homeId,
          userId: req.tenant.userId,
          action: createMsg,
          resource: `جهاز جديد`,
          resourceId: device.id,
          severity: 'INFO'
        }
      }).catch(console.error);

      if (server.io) {
        server.io.to(`home:${homeId}`).emit('activity_log', {
          id: `log_usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          message: createMsg,
          details: `المنفذ: GPIO ${device.pin}`,
          timestamp: new Date().toISOString(),
          type: 'SYSTEM'
        });
      }

      // Publish MQTT config payload to ESP32 node
      const targetNode = getBoardId(controller, data.controllerId);
      const targetHome = controller?.homeId || homeId;
      const commandTopic = `mosa/${targetHome}/device/${targetNode}/command`;
      const configPayload = {
        action: 'ADD_DEVICE',
        deviceId: device.id,
        name: data.name,
        type: data.type,
        pin: data.pinNumber,
        inPin: data.switchPin ?? -1,
        activeState: data.activeState || 'HIGH',
        switchMode: data.switchMode || 'GND',
        state: 'OFF',
        timestamp: Date.now()
      };
      server.mqtt.publish(commandTopic, JSON.stringify(configPayload), { retain: false });

      return reply.status(201).send({ ...device, credentials: { username, password } });
    } catch (error: any) {
      console.error("CREATE DEVICE ERROR:", error);
      const errorMessage = (error.errors && error.errors.length > 0) ? error.errors[0].message : ((error.issues && error.issues.length > 0) ? error.issues[0].message : (error.message || 'بيانات غير صالحة'));
      return reply.status(400).send({ message: errorMessage });
    }
  });

  server.put('/:id', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = (req.body as any) || {};

      const name = body.name;
      const pinNumber = body.pinNumber !== undefined ? Number(body.pinNumber) : (body.pin !== undefined ? Number(body.pin) : undefined);
      const activeState = body.activeState;

      const rawSwitchPin = body.switchPin !== undefined ? body.switchPin : (body.inPin !== undefined ? body.inPin : (body.inpin !== undefined ? body.inpin : undefined));
      const finalSwitchPin = (rawSwitchPin !== undefined && rawSwitchPin !== null && rawSwitchPin !== '' && rawSwitchPin !== -1) ? Number(rawSwitchPin) : (rawSwitchPin === null || rawSwitchPin === -1 || rawSwitchPin === '' ? null : undefined);

      const switchMode = body.switchMode;
      const controllerId = body.controllerId || body.boardId;
      const roomId = body.roomId;

      const homeId = req.tenant.homeId;
      const tPrisma = getTenantPrisma(homeId);

      let targetRoomId = roomId;
      if (targetRoomId === undefined && body.roomName) {
        let rObj = await tPrisma.room.findFirst({
          where: { homeId, name: body.roomName.trim() }
        });
        if (!rObj) {
          rObj = await tPrisma.room.create({
            data: { homeId, name: body.roomName.trim() }
          });
        }
        targetRoomId = rObj.id;
      }

      const device = await tPrisma.device.findUnique({ where: { id } });
      if (!device) return reply.status(404).send({ message: 'الجهاز غير موجود' });

      if (pinNumber !== undefined && (device.type as any) !== 'CAMERA' && !isSafeOutputGpio(pinNumber)) {
        return reply.status(400).send({ message: `عذراً، منفذ المخرج GPIO ${pinNumber} محظور هاردويرياً على ESP32-S3` });
      }
      if (finalSwitchPin !== undefined && finalSwitchPin !== null && !isSafeInputGpio(finalSwitchPin)) {
        return reply.status(400).send({ message: `عذراً، منفذ السويتش GPIO ${finalSwitchPin} محظور هاردويرياً على ESP32-S3` });
      }

      const currentState = (device.state as any) || {};
      const updatedState = {
        ...currentState,
        ...(activeState ? { activeState } : {}),
        ...(switchMode ? { switchMode } : {}),
        ...(finalSwitchPin !== undefined ? { switchPin: finalSwitchPin, inPin: finalSwitchPin } : {})
      };

      const updated = await tPrisma.device.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(pinNumber !== undefined ? { pin: pinNumber } : {}),
          ...(controllerId ? { nodeId: controllerId } : {}),
          ...(targetRoomId !== undefined ? { roomId: targetRoomId } : {}),
          state: updatedState
        }
      });

      // Publish MQTT update config payload to ESP32 node so ESP32 updates its inPin / switchPin in NVS memory immediately!
      if (updated.nodeId) {
        const nodeObj = await tPrisma.node.findUnique({ where: { id: updated.nodeId } });
        const targetNode = getBoardId(nodeObj, updated.nodeId);
        const targetHome = nodeObj?.homeId || homeId;
        const commandTopic = `mosa/${targetHome}/device/${targetNode}/command`;
        const stateObj = (updated.state as any) || {};
        const configPayload = {
          action: 'ADD_DEVICE',
          deviceId: updated.id,
          name: updated.name,
          type: updated.type,
          pin: updated.pin,
          inPin: stateObj.switchPin ?? -1,
          switchPin: stateObj.switchPin ?? -1,
          activeState: stateObj.activeState || 'HIGH',
          switchMode: stateObj.switchMode || 'GND',
          state: stateObj.isOn ? 'ON' : 'OFF',
          timestamp: Date.now()
        };
        server.mqtt.publish(commandTopic, JSON.stringify(configPayload), { retain: false });
      }

      return reply.send(updated);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message || 'فشل تعديل تفاصيل الجهاز' });
    }
  });

  server.delete('/:id', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const homeId = req.tenant.homeId;
      const tPrisma = getTenantPrisma(homeId);

      const device = await tPrisma.device.findFirst({ 
        where: { id, ...(homeId ? { homeId } : {}) } 
      });
      if (!device) return reply.status(404).send({ message: 'الجهاز غير موجود' });

      // 1. Delete all dependent foreign key records permanently
      await tPrisma.floorPlanDevice.deleteMany({ where: { deviceId: id } }).catch(() => {});
      await tPrisma.energyLog.deleteMany({ where: { deviceId: id } }).catch(() => {});
      await tPrisma.motionLog.deleteMany({ where: { deviceId: id } }).catch(() => {});
      await tPrisma.climateLog.deleteMany({ where: { deviceId: id } }).catch(() => {});
      await tPrisma.devicePermission.deleteMany({ where: { deviceId: id } }).catch(() => {});
      await tPrisma.deviceCredential.deleteMany({ where: { deviceId: id } }).catch(() => {});

      // 2. Permanently delete the device from database
      await tPrisma.device.delete({ where: { id } }).catch(async () => {
        await tPrisma.device.update({ 
          where: { id },
          data: { 
            deletedAt: new Date(),
            deletedBy: req.tenant.userId,
            deletedReason: 'Deleted via API'
          }
        });
      });

      // 3. Publish MQTT delete command to ESP32 node!
      if (device.nodeId) {
        const nodeObj = await tPrisma.node.findUnique({ where: { id: device.nodeId } });
        const targetNode = getBoardId(nodeObj, device.nodeId);
        const targetHome = nodeObj?.homeId || homeId;
        const commandTopic = `mosa/${targetHome}/device/${targetNode}/command`;
        const deletePayload = {
          action: 'DELETE_DEVICE',
          cmd: 'DELETE_DEVICE',
          type: 'delete',
          deviceId: device.id,
          pin: device.pin,
          boardId: targetNode,
          targetBoardId: targetNode,
          timestamp: Date.now()
        };
        try {
          if (server.mqtt) {
            server.mqtt.publish(commandTopic, JSON.stringify(deletePayload), { retain: false });
          } else {
            const { MqttService } = await import('../services/mqtt.service');
            MqttService.publish(commandTopic, JSON.stringify(deletePayload), { retain: false });
          }
        } catch (_) {}
      }

      await ActivityService.log({
        homeId,
        userId: req.tenant.userId,
        action: 'DEVICE_DELETED',
        targetType: 'DEVICE',
        targetId: id,
        ipAddress: req.ip
      });

      const deleteMsg = `تم حذف الجهاز: ${device.name}`;
      await prisma.auditLog.create({
        data: {
          homeId,
          userId: req.tenant.userId,
          action: deleteMsg,
          resource: `حذف جهاز`,
          resourceId: device.id,
          severity: 'WARNING'
        }
      }).catch(console.error);

      if (server.io) {
        server.io.to(`home:${homeId}`).emit('activity_log', {
          id: `log_usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          message: deleteMsg,
          details: `المنفذ: GPIO ${device.pin}`,
          timestamp: new Date().toISOString(),
          type: 'SYSTEM'
        });
      }

      // 4. Broadcast updated devices array to Web UI over Socket.io
      const allDevices = await tPrisma.device.findMany({
        where: { homeId, deletedAt: null },
        include: { room: true, node: true }
      });
      const mappedFullDevices = allDevices.map((d: any) => {
        const stateObj = (d.state as any) || {};
        const isOn = stateObj.isOn ? 'ON' : 'OFF';
        const rawSwitchPin = stateObj.switchPin ?? stateObj.inPin ?? stateObj.inpin ?? (d as any).inPin ?? null;
        return {
          id: d.id,
          name: d.name,
          type: d.type.toUpperCase(),
          pinNumber: d.pin,
          pin: d.pin,
          activeState: stateObj.activeState || 'HIGH',
          switchPin: rawSwitchPin,
          inPin: rawSwitchPin,
          inpin: rawSwitchPin,
          switchMode: stateObj.switchMode || 'GND',
          state: isOn,
          currentState: isOn,
          boardId: d.nodeId,
          controller: { name: d.node?.name },
          roomId: d.room?.id,
          room: d.room ? { name: d.room.name } : null
        };
      });
      const { SocketService } = require('../services/socket.service');
      await SocketService.broadcastDevices(server, homeId, mappedFullDevices);

      return reply.status(200).send({ success: true, message: 'تم حذف الجهاز نهائياً' });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({ message: error.message || 'فشل في حذف الجهاز' });
    }
  });

  server.post('/:id/toggle', { preHandler: [requireRole(Role.RESTRICTED)] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { state } = toggleDeviceSchema.parse(req.body);
      const homeId = req.tenant.homeId;
      const tPrisma = getTenantPrisma(homeId);

      const device = await tPrisma.device.findUnique({
        where: { id },
        include: { node: true, room: true }
      });
      if (!device) return reply.status(404).send({ message: 'الجهاز غير موجود' });

      // 🛡️ ROLE-BASED ACCESS CONTROL (RBAC)
      // SUPER_OWNER, ADMIN, and MEMBER have full home control
      // RESTRICTED and GUEST are restricted to their assigned rooms/devices
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
          return reply.status(403).send({ message: 'عذراً، هذا الجهاز غير مشمول ضمن الغرف أو الأجهزة المصرح لك بالتحكم بها' });
        }
      }

      // Target specific ESP32 Node via MQTT — format as MosaNode_MACWITHOUTCOLONS
      let node = (device as any).node;
      if (!node && device.nodeId) {
        node = await tPrisma.node.findUnique({ where: { id: device.nodeId } }).catch(() => null);
      }
      const targetNode = getBoardId(node, device.nodeId || id);

      const mqttHomeId = node?.homeId || homeId;
      const mqttTopic = `mosa/${mqttHomeId}/device/${targetNode}/command`;
      
      const stateObj = (device.state as any) || {};
      // Zero-Trust: Anti-Replay Protection & Node Isolation
      const payload = {
        action: 'TOGGLE',
        state,
        pin: device.pin,
        inPin: stateObj.switchPin ?? -1,
        activeState: stateObj.activeState || 'HIGH',
        switchMode: stateObj.switchMode || 'GND',
        targetBoardId: targetNode,
        boardId: targetNode,
        issuer: req.tenant.userId,
        nonce: crypto.randomUUID(),
        timestamp: Date.now()
      };

      // Publish to ESP32 MQTT topic
      server.mqtt.publish(mqttTopic, JSON.stringify(payload), { retain: false });

      // Immediate Database Update for device & all sibling devices sharing the same nodeId and pin
      const isNewOn = state === 'ON';
      if (device.nodeId && device.pin !== undefined) {
        const siblingDevices = await tPrisma.device.findMany({
          where: { nodeId: device.nodeId, pin: device.pin, deletedAt: null }
        });
        for (const sDev of siblingDevices) {
          const sState = (sDev.state as any) || {};
          await tPrisma.device.update({
            where: { id: sDev.id },
            data: { state: { ...sState, isOn: isNewOn } }
          });
        }
      } else {
        await tPrisma.device.update({
          where: { id },
          data: { state: { ...stateObj, isOn: isNewOn } }
        });
      }

      // 1. Emit granular single device state to home room (Zero Crosstalk)
      const deviceStatePayload = {
        id: device.id,
        deviceId: device.id,
        nodeId: device.nodeId,
        boardId: targetNode,
        pin: device.pin,
        state: state,
        isOn: isNewOn,
        timestamp: Date.now()
      };

      if (server.io) {
        server.io.to(`home:${homeId}`).emit('device_state', deviceStatePayload);
        server.io.to(`home:${homeId}`).emit('device_state_changed', { id: device.id, state: { isOn: isNewOn } });
      }

      // 2. Broadcast updated full mapped devices list to all connected phones/screens in the home
      try {
        const { SocketService } = require('../services/socket.service');
        const allDevices = await tPrisma.device.findMany({
          where: { homeId, deletedAt: null },
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
        await SocketService.broadcastDevices(server, homeId, mapped);
      } catch (e) {
        server.log.error(e, '[Socket Broadcast Error]');
      }
      
      const userName = (req.tenant as any).name || (req.tenant as any).username || 'المستخدم';
      const roomName = (device as any).room?.name || '';
      const actionText = `قام المستخدم (${userName}) بـ ${state === 'ON' ? 'تشغيل' : 'إطفاء'} مفتاح "${device.name}"${roomName ? ` في ${roomName}` : ''}`;

      await prisma.auditLog.create({
        data: {
          homeId,
          userId: req.tenant.userId,
          action: actionText,
          resource: `مخرج GPIO ${device.pin}`,
          resourceId: device.id,
          severity: 'INFO'
        }
      }).catch(console.error);

      server.io.to(`home:${homeId}`).emit('activity_log', {
        id: `log_usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        message: actionText,
        details: `تحكم عن بُعد عبر المنصة | المخرج GPIO ${device.pin}`,
        timestamp: new Date().toISOString(),
        type: 'USER_ACTION'
      });

      await ActivityService.log({
        homeId,
        userId: req.tenant.userId,
        action: actionText,
        targetType: 'DEVICE',
        targetId: id,
        ipAddress: req.ip,
        metadata: { state }
      });

      // Emit Notification
      server.io.to(`home:${homeId}`).emit('notification', {
        title: 'تغيير حالة جهاز',
        message: actionText,
        type: 'INFO'
      });

      return reply.send({ status: 'command_sent', topic: mqttTopic, state });
    } catch (error: any) {
      return reply.status(400).send({ message: 'خطأ في الطلب' });
    }
  });

  server.post('/:id/dim', { preHandler: [requireRole(Role.RESTRICTED)] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { level } = req.body as { level: number };
      const homeId = req.tenant.homeId;
      const tPrisma = getTenantPrisma(homeId);

      const device = await tPrisma.device.findUnique({ 
        where: { id },
        include: { room: true }
      });
      if (!device) return reply.status(404).send({ message: 'الجهاز غير موجود' });

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
          return reply.status(403).send({ message: 'عذراً، هذا الجهاز غير مشمول ضمن الغرف أو الأجهزة المصرح لك بالتحكم بها' });
        }
      }


      const mqttTopic = `mosa/${homeId}/device/${id}/command`;
      
      const payload = {
        action: 'DIM',
        level,
        pin: device.pin,
        issuer: req.tenant.userId,
        timestamp: Date.now()
      };

      server.mqtt.publish(mqttTopic, JSON.stringify(payload), { retain: false });

      // Optimistic update for UI state
      const currentState = (device.state as any) || {};
      await tPrisma.device.update({
        where: { id },
        data: { state: { ...currentState, brightness: level, isOn: level > 0 } }
      });

      return reply.send({ status: 'command_sent', topic: mqttTopic });
    } catch (error: any) {
      return reply.status(400).send({ message: 'خطأ في الطلب' });
    }
  });

  // PATCH /api/devices/:id/room
  server.patch('/:id/room', { preHandler: [requireRole(Role.ADMIN)] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { roomId, roomName } = req.body as { roomId?: string; roomName?: string };
      const homeId = req.tenant.homeId;

      let targetRoomId = roomId;

      if (!targetRoomId && roomName) {
        let room = await prisma.room.findFirst({ where: { homeId, name: roomName } });
        if (!room) {
          room = await prisma.room.create({ data: { homeId, name: roomName } });
        }
        targetRoomId = room.id;
      }

      const updated = await prisma.device.update({
        where: { id },
        data: { roomId: targetRoomId || null },
        include: { room: true }
      });

      return reply.send(updated);
    } catch (error) {
      return reply.status(400).send({ message: 'فشل في تحديث غرفة الجهاز' });
    }
  });
}
