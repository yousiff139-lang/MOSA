import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { MQTTService } from '@mosa/mqtt';
import { AutomationEngine } from './automation.engine';
import { ZigbeeService } from './zigbee.service';
import { sendTelegram } from './telegram';
import { SocketService } from './socket.service';
import { TelemetryBufferService } from './telemetry.buffer';
import { parseTopic } from '../lib/mqtt';
import { setCache } from '../lib/cache';

export class TelemetryProcessor {
  static init(server: FastifyInstance, prisma: PrismaClient, redisClient: any, mqttService: MQTTService, automationEngine: AutomationEngine) {
    const wsThrottleCache = new Map<string, number>();
    const telemetryCache = new Map<string, { count: number; temperature: number; humidity: number; power: number; lastWrite: number }>();
    const nodeOfflineTimers = new Map<string, NodeJS.Timeout>();

    mqttService.onConnect(() => {
      server.io.emit('mqtt_status_change', { online: true });
      // 🟢 Immediate Auto-Discovery Ping on Boot/Reconnect to awaken all ESP32 nodes
      server.mqtt.publish('mosa/scan', 'START_SCAN');
      server.mqtt.publish('mosa/discovery/request', 'REQUEST_DISCOVERY');
      server.log.info('[TelemetryProcessor] Connected to MQTT Broker. Broadcasted wake/discovery ping.');
    });

    const client = (mqttService as any).client;
    if (client) {
      client.on('offline', () => {
        server.io.emit('mqtt_status_change', { online: false });
      });
    }

    mqttService.connect().catch((err: any) => {
      server.log.warn('[TelemetryProcessor] Initial MQTT connect deferred (will auto-retry):', err?.message || err);
    });

    // 1. Strict State Namespace
    server.mqtt.subscribe('mosa/+/device/+/state', async (msg: string, topic: string) => {
        try {
          const parsed = parseTopic(topic);
          if (!parsed || parsed.category !== 'device' || parsed.action !== 'state') return;
          const topicHomeId = parsed.homeId;
          const topicDeviceId = parsed.entityId;
          const payload = JSON.parse(msg);
          let targetHomeId = topicHomeId;

          server.log.info(`Received state for Device/Node ${topicDeviceId} in Home ${topicHomeId}`);

          const dbDevice = await prisma.device.findUnique({
            where: { id: topicDeviceId },
            include: { node: true }
          });

          if (dbDevice) {
            targetHomeId = dbDevice.homeId;
            const isPayloadOn = payload.state === 'ON' || payload.isOn === true || payload.state === true;
            const currentState = (dbDevice.state as any) || {};
            const updatedState = {
              ...currentState,
              isOn: isPayloadOn,
              state: payload.state || (isPayloadOn ? 'ON' : 'OFF'),
              brightness: payload.brightness || 100,
              ...(payload.motion !== undefined ? { motion: payload.motion } : {})
            };

            await prisma.device.update({
              where: { id: topicDeviceId },
              data: { state: updatedState }
            });

            // Update Universal Device Shadow in Redis
            await setCache(`device:shadow:${topicDeviceId}`, updatedState, 86400);

            console.log(`Device ${topicDeviceId} updated: ${isPayloadOn ? 'ON' : 'OFF'}`);

            const allDevices = await prisma.device.findMany({
              where: { homeId: targetHomeId, deletedAt: null },
              include: { room: true, node: true }
            });
            const mappedDevices = allDevices.map((d: any) => {
              const stateObj = (d.state as any) || {};
              const isOn = stateObj.isOn ? 'ON' : 'OFF';
              return {
                id: d.id,
                name: d.name,
                type: d.type.toUpperCase(),
                pinNumber: d.pin,
                pin: d.pin,
                activeState: stateObj.activeState || 'HIGH',
                switchPin: stateObj.switchPin ?? stateObj.inPin ?? stateObj.inpin ?? (d as any).inPin ?? null,
                inPin: stateObj.switchPin ?? stateObj.inPin ?? stateObj.inpin ?? (d as any).inPin ?? null,
                inpin: stateObj.switchPin ?? stateObj.inPin ?? stateObj.inpin ?? (d as any).inPin ?? null,
                switchMode: stateObj.switchMode || 'GND',
                state: isOn,
                currentState: isOn,
                controller: { name: d.node?.name },
                roomId: d.roomId || d.room?.id || null,
                room: d.room ? { id: d.room.id, name: d.room.name } : null
              };
            });
            await SocketService.broadcastDevices(server, targetHomeId, mappedDevices);
          } else {
            let node = await prisma.node.findUnique({ where: { id: topicDeviceId } });
            if (!node) {
              let normalizedMac = topicDeviceId.replace('MosaNode_', '').toUpperCase();
              if (normalizedMac.length === 12) {
                normalizedMac = normalizedMac.match(/.{1,2}/g)!.join(':');
              }
              node = await prisma.node.findFirst({
                where: {
                  OR: [
                    { id: topicDeviceId },
                    { mac: topicDeviceId },
                    { mac: normalizedMac },
                    { mac: normalizedMac.toLowerCase() },
                    { mac: topicDeviceId.replace('MosaNode_', '') }
                  ]
                }
              });
            }
            if (!node) {
              server.log.warn(`Unknown node on topic ${topic}`);
              return;
            }
            const activeNode = node;
            if (!activeNode.homeId) {
              const defaultHome = await prisma.home.findFirst();
              if (defaultHome) {
                const updated = await prisma.node.update({
                  where: { id: activeNode.id },
                  data: {
                    homeId: defaultHome.id,
                    status: 'online',
                    lastSeen: new Date(),
                    ...(payload.ip || payload.ipAddress ? { ip: payload.ip || payload.ipAddress } : {})
                  }
                });
                node = updated;
              }
            } else {
              const updated = await prisma.node.update({
                where: { id: activeNode.id },
                data: {
                  status: 'online',
                  lastSeen: new Date(),
                  ...(payload.ip || payload.ipAddress ? { ip: payload.ip || payload.ipAddress } : {})
                }
              }).catch(() => activeNode);
              node = updated;
            }
            if (!node) return;
            targetHomeId = node.homeId || topicHomeId;

            // 🟢 AUTOMATIC HARDWARE PIN AUTO-SYNC ENGINE: Remind ESP32 of all Relay Pins, External Switch Pins (inPin), ActiveState, SwitchMode, Names & Types from PostgreSQL!
            const nodeSyncKey = `synced_node:${node.id}`;
            const lastSynced = wsThrottleCache.get(nodeSyncKey) || 0;
            const nowTime = Date.now();
            const isRebootedOrEmpty = (payload.components && Array.isArray(payload.components) && payload.components.length === 0) ||
                                     (!payload.devices || (Array.isArray(payload.devices) && payload.devices.length === 0));

            if (isRebootedOrEmpty || nowTime - lastSynced > 60000) {
              wsThrottleCache.set(nodeSyncKey, nowTime);
              const dbNodeDevices = await prisma.device.findMany({
                where: {
                  homeId: targetHomeId,
                  deletedAt: null,
                  OR: [
                    { nodeId: node.id },
                    { nodeId: node.mac },
                    { nodeId: `MosaNode_${node.mac.replace(/:/g, '')}` },
                    { nodeId: topicDeviceId }
                  ]
                }
              });

              for (const dev of dbNodeDevices) {
                // Skip invalid/system/restricted bus pins (0, 3, 6-11, 19, 20, 26-37, 45, 46) to protect ESP32 hardware from crash
                const restrictedPins = [0, 3, 6, 7, 8, 9, 10, 11, 19, 20, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 45, 46];
                if (dev.pin !== null && restrictedPins.includes(dev.pin)) {
                  console.warn(`[Auto-Sync] Skipped device ${dev.name} with restricted flash pin ${dev.pin}`);
                  continue;
                }
                const stateObj = (dev.state as any) || {};
                const rawSwitchPin = stateObj.switchPin ?? stateObj.inPin ?? stateObj.inpin ?? -1;
                const safeSwitchPin = (rawSwitchPin && Number(rawSwitchPin) > 3) ? Number(rawSwitchPin) : -1;
                const syncPayload = {
                  action: 'ADD_DEVICE',
                  deviceId: dev.id,
                  name: dev.name,
                  type: dev.type,
                  pin: dev.pin,
                  inPin: safeSwitchPin,
                  switchPin: safeSwitchPin,
                  activeState: stateObj.activeState || 'HIGH',
                  switchMode: stateObj.switchMode || 'GND',
                  state: stateObj.isOn ? 'ON' : 'OFF',
                  timestamp: nowTime
                };
                // Build boardID matching ESP32's format: "MosaNode_" + MAC without colons
                const macForSync = node.mac ? `MosaNode_${node.mac.replace(/:/g, '').toUpperCase()}` : node.id;
                const syncTopic = `mosa/${targetHomeId}/device/${macForSync}/command`;
                server.mqtt.publish(syncTopic, JSON.stringify(syncPayload), { retain: false });
                console.log(`[Auto-Sync] Reminded ESP32 Node ${macForSync} of Device ${dev.name}: Relay Pin ${dev.pin}, Switch Pin ${stateObj.switchPin ?? -1}`);
              }
            }

            if (payload.status === 'SUCCESS' || payload.status === 'FAILED' || payload.status === 'DOWNLOADING') {
              const { handleOTAResult } = require('../routes/ota');
              await handleOTAResult(topicHomeId, node.mac || topicDeviceId, payload).catch((err: any) => console.error(err));
              return;
            }

            const temperature = payload.temperature !== undefined ? payload.temperature : (payload.currentTemp !== undefined ? payload.currentTemp : 0);
            const humidity = payload.humidity !== undefined ? payload.humidity : (payload.currentHum !== undefined ? payload.currentHum : 0);

            // Calculate Real Power (Watts) = V_RMS * I_RMS * PowerFactor (PF)
            const vRms = payload.vRms !== undefined ? Number(payload.vRms) : (payload.voltage !== undefined ? Number(payload.voltage) : 220);
            const iRms = payload.iRms !== undefined ? Number(payload.iRms) : (payload.current !== undefined ? Number(payload.current) : 0);
            const pf = payload.pf !== undefined ? Number(payload.pf) : (payload.powerFactor !== undefined ? Number(payload.powerFactor) : 0.9);
            const calculatedRealPower = Math.round(vRms * iRms * pf * 100) / 100;

            const power = payload.power !== undefined ? payload.power : (payload.currentPower !== undefined ? payload.currentPower : calculatedRealPower);
            const kwh = payload.kwh !== undefined ? payload.kwh : (payload.totalKWh !== undefined ? payload.totalKWh : 0);

            const rawDevicesList = (payload.devices && Array.isArray(payload.devices)) 
              ? payload.devices 
              : ((payload.pin !== undefined || payload.id !== undefined || payload.state !== undefined || payload.isOn !== undefined || payload.motion !== undefined) ? [payload] : []);

            if (rawDevicesList.length > 0) {
              for (const dev of rawDevicesList) {
                const isDevOn = dev.state === 'ON' || dev.isOn === true || dev.state === true;
                await redisClient.hset(`mosa:home:${targetHomeId}:device_state:${topicDeviceId}:${dev.id || dev.pin || '0'}`, 'state', isDevOn ? 'ON' : 'OFF');
                await redisClient.hset(`mosa:home:${targetHomeId}:device_state:${topicDeviceId}:${dev.id || dev.pin || '0'}`, 'pwm', dev.pwmValue || 100);

                const targetPin = dev.pin !== undefined ? Number(dev.pin) : undefined;
                const matchingDevices = await prisma.device.findMany({
                  where: {
                    deletedAt: null,
                    homeId: targetHomeId,
                    ...(targetPin !== undefined ? { pin: targetPin } : {}),
                    OR: [
                      { nodeId: node.id },
                      { nodeId: node.mac },
                      { nodeId: `MosaNode_${node.mac.replace(/:/g, '')}` },
                      { nodeId: `MosaNode_${node.mac.replace(/:/g, '').toUpperCase()}` },
                      { nodeId: topicDeviceId }
                    ]
                  },
                  include: { room: true }
                });

                for (const mDev of matchingDevices) {
                  const currentState = (mDev.state as any) || {};
                  
                  const rawDevInPin = dev.inPin !== undefined && dev.inPin !== null && dev.inPin !== -1
                    ? Number(dev.inPin)
                    : (dev.switchPin !== undefined && dev.switchPin !== null && dev.switchPin !== -1
                      ? Number(dev.switchPin)
                      : (dev.switchpin !== undefined && dev.switchpin !== null && dev.switchpin !== -1 ? Number(dev.switchpin) : undefined));

                  const effectiveSwitchPin = rawDevInPin !== undefined
                    ? rawDevInPin
                    : (currentState.switchPin !== undefined && currentState.switchPin !== -1 ? currentState.switchPin : null);

                  const newMergedState = {
                    ...currentState,
                    isOn: isDevOn,
                    state: dev.state || (isDevOn ? 'ON' : 'OFF'),
                    ...(payload.motion !== undefined ? { motion: payload.motion } : {}),
                    ...(payload.occupancy !== undefined ? { motion: payload.occupancy } : {}),
                    temperature: temperature !== undefined ? temperature : currentState.temperature,
                    humidity: humidity !== undefined ? humidity : currentState.humidity,
                    power: power !== undefined ? power : currentState.power,
                    ...(effectiveSwitchPin !== undefined && effectiveSwitchPin !== null ? { switchPin: effectiveSwitchPin, inPin: effectiveSwitchPin } : {})
                  };

                  await prisma.device.update({
                    where: { id: mDev.id },
                    data: { state: newMergedState }
                  });

                  // Update Universal Device Shadow in Redis
                  await setCache(`device:shadow:${mDev.id}`, newMergedState, 86400);
                  await setCache(`node:shadow:${node.mac}`, newMergedState, 86400);

                  console.log(`[Realtime State Sync] Node ${node.id} Device ${mDev.name} (Pin ${targetPin}, SwitchPin: ${effectiveSwitchPin}) updated -> ${isDevOn ? 'ON' : 'OFF'}`);

                  // 🔘 Realtime Notification & Log exclusively on Physical Wall Switch Press
                  const isPhysicalSwitch = payload.source === 'physical_switch' || 
                                           payload.trigger === 'WALL_SWITCH' || 
                                           dev.source === 'physical_switch' || 
                                           dev.trigger === 'WALL_SWITCH';

                  if (isPhysicalSwitch) {
                    const roomName = (mDev as any).room?.name || 'الغرفة';
                    const notifMsg = `تم ${isDevOn ? 'تشغيل' : 'إطفاء'} مفتاح "${mDev.name}" في "${roomName}" محلياً عبر المفتاح الجداري 🔘`;
                    const notifTitle = isDevOn ? 'مفتاح جداري (تشغيل) 💡' : 'مفتاح جداري (إطفاء) 🔌';

                    try {
                      const homeOwner = await prisma.homeMember.findFirst({ where: { homeId: targetHomeId, role: 'SUPER_OWNER' } });
                      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
                      const targetUserId = homeOwner?.userId || fallbackUser?.id;
                      if (targetUserId) {
                        await prisma.notification.create({
                          data: {
                            homeId: targetHomeId,
                            userId: targetUserId,
                            title: notifTitle,
                            message: notifMsg,
                            type: 'INFO'
                          }
                        });
                      }

                      await prisma.auditLog.create({
                        data: {
                          homeId: targetHomeId,
                          action: notifMsg,
                          resource: mDev.name,
                          resourceId: mDev.id,
                          severity: 'INFO'
                        }
                      });
                    } catch (err) {}

                    if (targetHomeId) {
                      server.io.to(`home:${targetHomeId}`).emit('notification', {
                        id: `notif_wall_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        title: notifTitle,
                        message: notifMsg,
                        type: 'INFO',
                        timestamp: new Date().toISOString()
                      });

                      server.io.to(`home:${targetHomeId}`).emit('activity_log', {
                        id: `log_wall_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        message: notifMsg,
                        details: `المفتاح الخارجي GPIO ${effectiveSwitchPin ?? targetPin} | استجابة فورية للضغط اليدوي`,
                        timestamp: new Date().toISOString(),
                        type: 'USER_ACTION'
                      });
                    }
                  }
                }

                const primaryDev = matchingDevices[0];
                const statePayload = {
                  id: primaryDev ? primaryDev.id : String(dev.id || dev.pin || topicDeviceId),
                  boardId: node ? node.id : undefined,
                  nodeId: node ? node.id : undefined,
                  pin: targetPin,
                  state: isDevOn ? 'ON' : 'OFF',
                  isOn: isDevOn
                };

                if (targetHomeId) {
                  server.io.to(`home:${targetHomeId}`).emit('device_state', statePayload);
                }

                if (node && targetHomeId) {
                  const cleanMac = node.mac.replace(/:/g, '').toUpperCase();
                  server.io.to(`home:${targetHomeId}`).emit('board_status_change', { boardId: node.id, online: true });
                  server.io.to(`home:${targetHomeId}`).emit('board_status_change', { boardId: `MosaNode_${cleanMac}`, online: true });
                  server.io.to(`home:${targetHomeId}`).emit('board_status_change', { boardId: node.mac, online: true });
                }
              }
            }

              // Broadcast updated devices state to Web UI over Socket.io so Web UI updates immediately on physical switch toggles!
              const effectiveHomeId = targetHomeId || topicHomeId || 'home-1';
              const allDevices = await prisma.device.findMany({
                where: { homeId: effectiveHomeId, deletedAt: null },
                include: { room: true, node: true }
              }).catch(() => []);
              const mappedFullDevices = allDevices.map((d: any) => {
                const stateObj = (d.state as any) || {};
                const isOn = stateObj.isOn ? 'ON' : 'OFF';
                const typeUp = d.type.toUpperCase();
                const isSensor = ['SENSOR', 'TEMPERATURE', 'MOISTURE', 'ENERGY', 'POWER', 'MOTION', 'SECURITY'].includes(typeUp) || d.name?.includes('حساس') || d.name?.includes('حرار') || d.name?.includes('طاقة') || d.name?.includes('حركة');
                return {
                  id: d.id,
                  name: d.name,
                  type: typeUp,
                  pinNumber: d.pin,
                  pin: d.pin,
                  activeState: stateObj.activeState || 'HIGH',
                  switchPin: stateObj.switchPin ?? stateObj.inPin ?? stateObj.inpin ?? (d as any).inPin ?? null,
                  inPin: stateObj.switchPin ?? stateObj.inPin ?? stateObj.inpin ?? (d as any).inPin ?? null,
                  inpin: stateObj.switchPin ?? stateObj.inPin ?? stateObj.inpin ?? (d as any).inPin ?? null,
                  switchMode: stateObj.switchMode || 'GND',
                  state: isOn,
                  currentState: isOn,
                  boardId: d.nodeId,
                  temperature: isSensor && (d.pin === 16 || d.name?.includes('حرار') || d.name === 'حساس') ? temperature : undefined,
                  humidity: isSensor && (d.pin === 16 || d.name?.includes('حرار') || d.name === 'حساس') ? humidity : undefined,
                  powerUsage: isSensor && (d.pin === 12 || d.name?.includes('كهربا')) ? power : undefined,
                  soilMoisture: isSensor && (d.pin === 15 || d.name?.includes('ترب')) ? (payload.soilMoisture ?? payload.moisture) : undefined,
                  controller: { name: d.node?.name },
                  roomId: d.roomId || d.room?.id || null,
                  room: d.room ? { id: d.room.id, name: d.room.name } : null
                };
              });
              await SocketService.broadcastDevices(server, targetHomeId, mappedFullDevices);
              if (topicHomeId && topicHomeId !== targetHomeId) {
                await SocketService.broadcastDevices(server, topicHomeId, mappedFullDevices);
              }

            // Calculate current cost and check budget limits
            let tariff = 10.0;
            let budget = 50000.0;
            try {
              const settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });
              if (settings) {
                tariff = settings.energyTariff;
                budget = settings.energyBudget;
              }
            } catch (err) {
              server.log.warn('Failed to load system settings in telemetry processor');
            }

            const currentCost = kwh * tariff;
            if (currentCost >= budget * 0.9) {
              const warningMessage = `⚠️ <b>تنبيه استهلاك الكهرباء:</b> لقد شارف استهلاكك على تجاوز ميزانية الكهرباء المحددة (${budget} د.ع). التكلفة الحالية: <b>${Math.round(currentCost)} د.ع</b> (${kwh.toFixed(2)} kWh).`;
              try {
                const lastAlert = await redisClient.get(`last_budget_alert:${targetHomeId}`);
                if (!lastAlert) {
                  await redisClient.setex(`last_budget_alert:${targetHomeId}`, 3600, 'sent');
                  sendTelegram(warningMessage, { homeId: targetHomeId });
                  server.io.to(`home:${targetHomeId}`).emit('budget_alert', {
                    message: warningMessage,
                    currentCost,
                    budget
                  });
                }
              } catch (cacheErr) {
                // Ignore cache errors
              }
            }

            const nowMs = Date.now();
            const lastEmit = wsThrottleCache.get(targetHomeId) || 0;

            if (nowMs - lastEmit > 500) {
              const telemetryData = {
                currentTemp: temperature,
                currentHum: humidity,
                currentPower: power,
                totalKWh: kwh,
                currentCost: currentCost,
                energyTariff: tariff
              };
              server.io.to(`home:${targetHomeId}`).emit('telemetry_update', telemetryData);
              if (topicHomeId && topicHomeId !== targetHomeId) {
                server.io.to(`home:${topicHomeId}`).emit('telemetry_update', telemetryData);
              }
              wsThrottleCache.set(targetHomeId, nowMs);
            }

            const now = Date.now();
            const cacheKey = node.id;
            const currentCache = telemetryCache.get(cacheKey) || { count: 0, temperature: 0, humidity: 0, power: 0, lastWrite: 0 };

            currentCache.count += 1;
            currentCache.temperature += temperature;
            currentCache.humidity += humidity;
            currentCache.power += power;

            if (now - currentCache.lastWrite > 60000) {
              const avgPower = currentCache.power / currentCache.count;
              const avgTemp = currentCache.temperature / currentCache.count;
              const avgHum = currentCache.humidity / currentCache.count;
              const firstDevice = await prisma.device.findFirst({ where: { nodeId: node.id } });

              if (firstDevice) {
                if (avgPower > 0) {
                  TelemetryBufferService.enqueue(redisClient, {
                    timestamp: now,
                    homeId: targetHomeId,
                    nodeId: node.id,
                    deviceId: firstDevice.id,
                    type: 'energy',
                    data: { powerW: avgPower }
                  }).catch((e: any) => server.log.error('Failed to enqueue energy telemetry', e));
                }

                if (avgTemp > 0 || avgHum > 0) {
                  TelemetryBufferService.enqueue(redisClient, {
                    timestamp: now,
                    homeId: targetHomeId,
                    nodeId: node.id,
                    deviceId: firstDevice.id,
                    type: 'climate',
                    data: { temperature: avgTemp, humidity: avgHum }
                  }).catch((e: any) => server.log.error('Failed to enqueue climate telemetry', e));
                }
              }

              currentCache.count = 0;
              currentCache.temperature = 0;
              currentCache.humidity = 0;
              currentCache.power = 0;
              currentCache.lastWrite = now;
            }
            telemetryCache.set(cacheKey, currentCache);
          }

          const automationIdentifier = dbDevice ? (dbDevice.node?.mac || dbDevice.id) : topicDeviceId;
          automationEngine.handleMqttMessage(automationIdentifier, payload);

          if (payload.motion === true) {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            sendTelegram(`🚨 تم اكتشاف حركة في المدخل - ${timeStr}`, { homeId: targetHomeId });
          }
        } catch (e) {
          server.log.error({ err: e, topic }, 'Critical MQTT State Parsing Error');
        }
      });

      // 2. OTA Updates
      server.mqtt.subscribe('mosa/+/ota/+/result', async (msg: string, topic: string) => {
        try {
          const parsed = parseTopic(topic);
          if (!parsed || parsed.category !== 'ota' || parsed.action !== 'result') return;
          const topicHomeId = parsed.homeId;
          const topicDeviceId = parsed.entityId;
          const payload = msg.toString();

          const controller = await prisma.node.findFirst({
            where: {
              homeId: topicHomeId,
              OR: [
                { id: topicDeviceId },
                { mac: topicDeviceId }
              ]
            }
          });
          if (!controller) return;

          const update = await prisma.otaUpdate.findFirst({
            where: { controllerId: controller.id, status: 'PENDING' },
            orderBy: { startedAt: 'desc' }
          });

          if (update) {
            await prisma.otaUpdate.update({
              where: { id: update.id },
              data: { status: payload, completedAt: new Date() }
            });

            server.io.to(`home:${topicHomeId}`).emit('ota:update', {
              controllerId: controller.id,
              status: payload,
              version: update.versionId
            });

            if (payload === 'SUCCESS') {
              sendTelegram(`✅ تم تحديث ${controller.name || 'المتحكم'} بنجاح`, { homeId: topicHomeId });
            } else if (payload === 'FAILED') {
              sendTelegram(`❌ فشل تحديث ${controller.name || 'المتحكم'}`, { homeId: topicHomeId });
            }
          }
        } catch (e: any) {
          server.log.error({ err: e, topic }, 'Critical MQTT OTA Parsing Error');
        }
      });

      // 3. Controller Status
      server.mqtt.subscribe('mosa/+/controller/+/status', async (msg: string, topic: string) => {
        try {
          const parsed = parseTopic(topic);
          if (!parsed || parsed.category !== 'controller' || parsed.action !== 'status') return;
          const topicHomeId = parsed.homeId;
          const topicDeviceId = parsed.entityId;
          const payload = msg.toString().trim();

          const cleanMac = topicDeviceId.replace('MosaNode_', '').toUpperCase();
          let formattedMac = cleanMac;
          if (cleanMac.length === 12) {
            formattedMac = cleanMac.match(/.{1,2}/g)!.join(':');
          }

          const controller = await prisma.node.findFirst({
            where: {
              OR: [
                { id: topicDeviceId },
                { mac: topicDeviceId },
                { mac: formattedMac },
                { mac: formattedMac.toLowerCase() },
                { id: `MosaNode_${cleanMac}` }
              ]
            }
          });
          if (controller) {
            const isOnline = payload.toLowerCase() === 'online' || payload.toLowerCase() === 'alive';
            const targetHomeId = controller.homeId || topicHomeId;

            if (isOnline) {
              // Cancel pending offline debounce timer if ESP reconnected quickly
              const pendingTimer = nodeOfflineTimers.get(controller.id);
              if (pendingTimer) {
                clearTimeout(pendingTimer);
                nodeOfflineTimers.delete(controller.id);
              }

              const wasOffline = controller.status === 'offline';
              await redisClient.hset(`mosa:home:${targetHomeId}:node_status:${controller.id}`, 'status', 'online');

              await prisma.node.update({
                where: { id: controller.id },
                data: {
                  status: 'online',
                  lastSeen: new Date()
                }
              });

              if (targetHomeId) {
                server.io.to(`home:${targetHomeId}`).emit('board_status_change', { boardId: controller.id, online: true });
                server.io.to(`home:${targetHomeId}`).emit('board_status_change', { boardId: `MosaNode_${cleanMac}`, online: true });
                server.io.to(`home:${targetHomeId}`).emit('board_status_change', { boardId: controller.mac, online: true });
              }

              // Only log/notify if controller was genuinely offline before
              if (wasOffline) {
                const statusMsg = `تم اتصال لوحة الـ ESP32 [${controller.name || controller.mac}] بالشبكة بنجاح 🟢`;

                await prisma.auditLog.create({
                  data: {
                    homeId: targetHomeId,
                    action: statusMsg,
                    resource: `لوحة ${controller.name || controller.mac}`,
                    resourceId: controller.id,
                    severity: 'INFO'
                  }
                }).catch(console.error);

                server.io.to(`home:${targetHomeId}`).emit('activity_log', {
                  id: `log_node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                  message: statusMsg,
                  details: `IP: ${controller.ip || 'مزامنة تلقائية'} | جاهز لاستقبال الأوامر`,
                  timestamp: new Date().toISOString(),
                  type: 'SYSTEM'
                });

                sendTelegram(`✅ المتحكم ${controller.name || 'غير معروف'} متصل مجدداً`, { homeId: targetHomeId });
              }
            } else {
              // OFFLINE event: Debounce by 2000ms to eliminate broker client-reconnect disconnect race
              if (!nodeOfflineTimers.has(controller.id)) {
                const timer = setTimeout(async () => {
                  nodeOfflineTimers.delete(controller.id);
                  try {
                    await redisClient.hset(`mosa:home:${targetHomeId}:node_status:${controller.id}`, 'status', 'offline');
                    await prisma.node.update({
                      where: { id: controller.id },
                      data: { status: 'offline' }
                    });

                    if (targetHomeId) {
                      server.io.to(`home:${targetHomeId}`).emit('board_status_change', { boardId: controller.id, online: false });
                      server.io.to(`home:${targetHomeId}`).emit('board_status_change', { boardId: `MosaNode_${cleanMac}`, online: false });
                      server.io.to(`home:${targetHomeId}`).emit('board_status_change', { boardId: controller.mac, online: false });
                    }

                    const statusMsg = `انقطع اتصال لوحة الـ ESP32 [${controller.name || controller.mac}] عن الشبكة 🔴`;

                    await prisma.auditLog.create({
                      data: {
                        homeId: targetHomeId,
                        action: statusMsg,
                        resource: `لوحة ${controller.name || controller.mac}`,
                        resourceId: controller.id,
                        severity: 'WARNING'
                      }
                    }).catch(console.error);

                    server.io.to(`home:${targetHomeId}`).emit('activity_log', {
                      id: `log_node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                      message: statusMsg,
                      details: `انقطع الاتصال عبر وسيط MQTT`,
                      timestamp: new Date().toISOString(),
                      type: 'SYSTEM'
                    });

                    sendTelegram(`⚠️ المتحكم ${controller.name || 'غير معروف'} انقطع عن الإنترنت`, { homeId: targetHomeId });
                  } catch (err) {
                    console.error('[TelemetryProcessor] Offline debounce error:', err);
                  }
                }, 2000);

                nodeOfflineTimers.set(controller.id, timer);
              }
            }
          }
        } catch (e: any) {
          server.log.error({ err: e, topic }, 'Critical MQTT Status Parsing Error');
        }
      });

      // Also handle heartbeat topic for online status
      server.mqtt.subscribe('mosa/+/controller/+/heartbeat', async (msg: string, topic: string) => {
        try {
          const parsed = parseTopic(topic);
          if (!parsed) return;
          const topicDeviceId = parsed.entityId;
          const cleanMac = topicDeviceId.replace('MosaNode_', '').toUpperCase();
          let formattedMac = cleanMac;
          if (cleanMac.length === 12) {
            formattedMac = cleanMac.match(/.{1,2}/g)!.join(':');
          }

          const controller = await prisma.node.findFirst({
            where: {
              OR: [
                { id: topicDeviceId },
                { mac: topicDeviceId },
                { mac: formattedMac },
                { id: `MosaNode_${cleanMac}` }
              ]
            }
          });

          if (controller) {
            await prisma.node.update({
              where: { id: controller.id },
              data: { status: 'online', lastSeen: new Date() }
            });
            const targetHomeId = controller.homeId || parsed.homeId;
            if (targetHomeId) {
              server.io.to(`home:${targetHomeId}`).emit('board_status_change', { boardId: controller.id, online: true });
            }
          }
        } catch (e: any) {
          server.log.error({ err: e, topic }, 'Critical MQTT Heartbeat Parsing Error');
        }
      });

      // 4. Zigbee2MQTT Discovery Bridge & Device States
      server.mqtt.subscribe('zigbee2mqtt/bridge/devices', async (msg: string, topic: string) => {
        await ZigbeeService.handleDeviceDiscovery(msg);
      });

      server.mqtt.subscribe('zigbee2mqtt/bridge/event', async (msg: string, topic: string) => {
        await ZigbeeService.handleBridgeEvent(msg, server);
      });

      server.mqtt.subscribe('zigbee2mqtt/+', async (msg: string, topic: string) => {
        if (!topic.includes('/bridge')) {
          await ZigbeeService.handleDeviceState(topic, msg, server, automationEngine);
        }
      });

      // 5. MOSA Native Device Discovery
      const handleDiscoveryPayload = async (msg: string, topic: string) => {
        try {
          const payload = JSON.parse(msg);
          const mac = payload.mac || payload.macAddress || payload.id;
          if (mac) {
            const discovered = await prisma.discoveredDevice.upsert({
              where: { macAddress: mac },
              update: { lastSeen: new Date(), ipAddress: payload.ip || '', components: payload.components || [] },
              create: {
                macAddress: mac,
                ipAddress: payload.ip || '',
                deviceType: payload.type || 'ESP32',
                components: payload.components || [],
                id: mac
              }
            });
            server.log.info(`[Discovery] Discovered device ${mac} at ${payload.ip}`);
            const topicParts = topic.split('/');
            const discoveryHomeId = payload.homeId || (topicParts.length >= 2 && topicParts[1] !== 'discovery' ? topicParts[1] : null);
            const alertInfo = { name: payload.id || mac, boardId: mac, ...discovered };
            if (discoveryHomeId) {
              server.io.to(`home:${discoveryHomeId}`).emit('device_discovered', alertInfo);
              server.io.to(`home:${discoveryHomeId}`).emit('new_board_discovered', alertInfo);
            } else {
              server.io.emit('device_discovered', alertInfo);
              server.io.emit('new_board_discovered', alertInfo);
            }
          }
        } catch (e) {
          server.log.error({ err: e, topic }, 'Critical MQTT Discovery Parsing Error');
        }
      };

    server.mqtt.subscribe('mosa/discovery', handleDiscoveryPayload);
    server.mqtt.subscribe('mosa/+/discovery', handleDiscoveryPayload);
    server.mqtt.subscribe('mosa/+/device/+/discovery', handleDiscoveryPayload);
  }
}
