import mqtt from 'mqtt';
import { redisClient } from '../server';
import { prisma } from '../lib/prisma';
import { env } from 'process';
import { parseTopic, getBoardId, getMacVariants } from '../lib/mqtt';

import fs from 'fs';
import path from 'path';

export class MqttService {
  private static client: mqtt.MqttClient;
  public static recentLogs: Array<{ id: string; topic: string; payload: string; timestamp: number }> = [];

  static get isConnected(): boolean {
    return this.client?.connected || false;
  }

  public static publish(topic: string, message: string | Buffer, options: mqtt.IClientPublishOptions = {}, callback?: (error?: Error) => void): boolean {
    if (!this.client) {
      console.warn(`[MQTT] Cannot publish, client not initialized: ${topic}`);
      return false;
    }
    this.client.publish(topic, message, options, callback);
    return true;
  }

  // Promise resolution map for optimistic UI
  private static pendingCommands: Map<string, (value: boolean) => void> = new Map();

  static async init() {
    if (this.client) return;
    // Connect to Mosquitto over mTLS. In docker, it's 'mosa-mosquitto:8883'
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtts://mosa-mosquitto:8883';
    
    let tlsOptions: any = {};
    try {
      const certsDir = fs.existsSync('/app/certs') 
        ? '/app/certs' 
        : fs.existsSync(path.resolve(process.cwd(), '..', '..', 'config', 'certs'))
          ? path.resolve(process.cwd(), '..', '..', 'config', 'certs')
          : path.join(process.cwd(), 'certs');
      const caPath = path.join(certsDir, 'ca.crt');
      const certPath = path.join(certsDir, 'backend.crt');
      const keyPath = path.join(certsDir, 'backend.key');

      console.log(`[MQTT TLS] Checking certs at ${certsDir}: ca=${fs.existsSync(caPath)}, cert=${fs.existsSync(certPath)}, key=${fs.existsSync(keyPath)}`);
      if (fs.existsSync(caPath) && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        tlsOptions = {
          ca: [fs.readFileSync(caPath)],
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
          rejectUnauthorized: process.env.NODE_ENV === 'development',
          checkServerIdentity: process.env.NODE_ENV === 'development' ? () => undefined : undefined
        };
        console.log('[MQTT TLS] ✅ Loaded mTLS client certificates for backend');
      } else {
        console.warn('[MQTT TLS] ⚠️ mTLS certificates missing in certs directory');
      }
    } catch (e) {
      console.warn('[MQTT] TLS certificates not found, attempting standard connection');
    }

    this.client = mqtt.connect(brokerUrl, {
      ...tlsOptions,
      rejectUnauthorized: process.env.NODE_ENV === 'development' ? false : (tlsOptions.rejectUnauthorized ?? true),
      checkServerIdentity: process.env.NODE_ENV === 'development' ? () => undefined : (tlsOptions.checkServerIdentity ?? undefined),
      clientId: `mosa-backend-${Math.random().toString(16).substring(2, 8)}`,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
    });

    // Security warning when TLS verification is disabled
    if (process.env.NODE_ENV === 'development') {
      console.warn('[MQTT TLS] ⚠️  TLS certificate verification DISABLED in development mode');
      console.warn('[MQTT TLS] ⚠️  This makes the connection vulnerable to MITM attacks');
      console.warn('[MQTT TLS] ⚠️  Set NODE_ENV=production to enable TLS verification');
    } else {
      console.log('[MQTT TLS] ✅ TLS certificate verification ENABLED (production mode)');
    }

    this.client.on('error', (err) => {
      console.warn('[MQTT Service] Mosquitto connection error (will auto-retry):', err.message || err);
    });

    this.client.on('offline', () => {
      console.warn('[MQTT Service] Mosquitto client offline');
    });

    this.client.on('reconnect', () => {
      console.log('[MQTT Service] Reconnecting to Mosquitto...');
    });

    this.client.on('connect', () => {
      console.log('[MQTT Service] Backend connected to Mosquitto');
      
      // Subscribe to telemetry, states, audio, and native discovery
      this.client.subscribe('mosa/+/device/+/state');
      this.client.subscribe('mosa/+/sensor/+/+');
      this.client.subscribe('mosa/+/controller/+/status');
      this.client.subscribe('mosa/+/controller/+/heartbeat');
      this.client.subscribe('mosa/+/audio/+/+');
      this.client.subscribe('mosa/discovery');
      this.client.subscribe('mosa/+/discovery');
      this.client.subscribe('mosa/scan_results');

      // 🟢 Immediate Auto-Discovery Ping on Boot/Reconnect
      this.client.publish('mosa/scan', 'START_SCAN');
      this.client.publish('mosa/discovery/request', 'REQUEST_DISCOVERY');
    });

    this.client.on('message', async (topic, payload) => {
      try {
        const msgStr = payload.toString();

        MqttService.recentLogs.push({
          id: Math.random().toString(36).substring(2, 9),
          topic,
          payload: msgStr,
          timestamp: Date.now()
        });
        if (MqttService.recentLogs.length > 50) {
          MqttService.recentLogs.shift();
             // 🛡️ Security Hardening: Anti-Replay Attack Timestamp Filter (< 30s threshold for Unix epoch timestamps)
        try {
          const parsed = JSON.parse(msgStr);
          const msgTs = parsed.ts || parsed.timestamp;
          if (msgTs && Number(msgTs) > 1000000000) {
            const tsSec = Number(msgTs) > 1000000000000 ? Math.floor(Number(msgTs) / 1000) : Number(msgTs);
            const nowSec = Math.floor(Date.now() / 1000);
            const ageSec = Math.abs(nowSec - tsSec);
            if (ageSec > 30) {
              console.warn(`[Anti-Replay Security] 🛡️ REJECTED stale MQTT message (Age: ${ageSec}s > 30s limit). Topic: ${topic}`);
              return;
            }
          }
        } catch (_) {}
        }

        if (topic === 'mosa/discovery') {
          try {
            const discJson = JSON.parse(msgStr);
            const rawMac = discJson.mac || discJson.id;
            if (rawMac) {
              const macVariants = getMacVariants(rawMac);
              
              let node = await prisma.node.findFirst({
                where: {
                  deletedAt: null,
                  OR: [
                    ...macVariants.map(v => ({ id: v })),
                    ...macVariants.map(v => ({ mac: v }))
                  ]
                }
              });

              if (node) {
                // If Node is already registered in DB, update status and IP
                await prisma.node.update({
                  where: { id: node.id },
                  data: {
                    status: 'online',
                    ip: discJson.ip || node.ip,
                    lastSeen: new Date()
                  }
                });
              } else {
                // If Node is NOT registered yet, place into DiscoveredDevice table for user to Pair & Bind
                await prisma.discoveredDevice.upsert({
                  where: { macAddress: rawMac },
                  update: {
                    lastSeen: new Date(),
                    ipAddress: discJson.ip || '192.168.1.101',
                    components: discJson.components || []
                  },
                  create: {
                    id: rawMac,
                    macAddress: rawMac,
                    ipAddress: discJson.ip || '192.168.1.101',
                    deviceType: discJson.type || 'ESP32',
                    components: discJson.components || []
                  }
                }).catch(() => {});
                console.log(`[MQTT Discovery] Received discovery for unpaired device ${rawMac} at ${discJson.ip}`);
                return;
              }

              const targetHomeId = node.homeId || 'home-1';
              const dbDevices = await prisma.device.findMany({
                where: { homeId: targetHomeId, nodeId: node.id, deletedAt: null }
              });

              // Check if incoming discovery has components with inPin/switchPin
              if (Array.isArray(discJson.components) && discJson.components.length > 0) {
                for (const comp of discJson.components) {
                  if (comp.pin !== undefined && comp.pin !== -1) {
                    const compInPin = comp.inPin !== undefined && comp.inPin !== -1 
                      ? Number(comp.inPin) 
                      : (comp.switchPin !== undefined && comp.switchPin !== -1 ? Number(comp.switchPin) : undefined);
                    if (compInPin !== undefined) {
                      const matched = dbDevices.find(d => d.pin === Number(comp.pin));
                      if (matched) {
                        const sObj = (matched.state as any) || {};
                        if (sObj.switchPin === undefined || sObj.switchPin === null || sObj.switchPin === -1) {
                          await prisma.device.update({
                            where: { id: matched.id },
                            data: { state: { ...sObj, switchPin: compInPin, inPin: compInPin } }
                          });
                          sObj.switchPin = compInPin;
                          sObj.inPin = compInPin;
                        }
                      }
                    }
                  }
                }
              }

              for (const dev of dbDevices) {
                if (dev.pin !== null && ((dev.pin >= 26 && dev.pin <= 37) || (dev.pin >= 6 && dev.pin <= 11))) {
                  console.warn(`[Discovery Sync] Skipped device ${dev.name} with restricted flash pin ${dev.pin}`);
                  continue;
                }
                const stateObj = (dev.state as any) || {};
                const syncPayload = {
                  action: 'ADD_DEVICE',
                  deviceId: dev.id,
                  name: dev.name,
                  type: dev.type,
                  pin: dev.pin,
                  inPin: stateObj.switchPin ?? -1,
                  switchPin: stateObj.switchPin ?? -1,
                  activeState: stateObj.activeState || 'HIGH',
                  switchMode: stateObj.switchMode || 'GND',
                  state: stateObj.isOn ? 'ON' : 'OFF',
                  timestamp: Date.now()
                };
                const formattedNodeId = getBoardId(node, node.id);
                const syncTopic = `mosa/${node.homeId}/device/${formattedNodeId}/command`;
                this.client.publish(syncTopic, JSON.stringify(syncPayload), { qos: 1 });
                console.log(`[Discovery Sync] Sent pin configuration for Device ${dev.name} (Pin ${dev.pin}, Switch Pin ${stateObj.switchPin ?? -1}) to Node ${formattedNodeId}`);
              }
            }
          } catch (e) {
            console.error('[MQTT] Discovery parse error:', e);
          }
          return;
        }

        const parsed = parseTopic(topic);
        if (parsed) {
          const homeId = parsed.homeId;
          const boardId = parsed.entityId;
          const type = parsed.action || parsed.category;
          
          if (parsed.category === 'device' && parsed.action === 'state') {
             // 1. Update In-Memory Redis State (Tenant-Scoped)
             await redisClient.hset(`mosa:home:${homeId}:device_state:${boardId}`, 'latest', msgStr);
             
             // Update node lastSeen
             const nodeMatches = await prisma.node.findMany({
               where: {
                 OR: [
                   { id: boardId },
                   { name: boardId },
                   { mac: boardId },
                   { mac: boardId.replace('MosaNode_', '') },
                   { mac: boardId.replace('MosaNode_', '').match(/.{1,2}/g)?.join(':') || boardId }
                 ]
               }
             });

             for (const n of nodeMatches) {
               await prisma.node.update({
                 where: { id: n.id },
                 data: { status: 'online', lastSeen: new Date() }
               }).catch(() => {});
             }

             // 2. Realtime State Sync to DB and Socket.IO
             try {
               const json = JSON.parse(msgStr);
               const rawHomeId = homeId !== '+' ? homeId : (nodeMatches[0]?.homeId || 'home-1');

               const stateItems: Array<{ pin?: number; state?: string; isOn?: boolean }> = [];
               if (Array.isArray(json.devices)) {
                 for (const d of json.devices) {
                   stateItems.push({
                     pin: d.pin,
                     state: d.state,
                     isOn: d.isOn ?? (d.state === 'ON')
                   });
                 }
               } else if (json.pin !== undefined) {
                 stateItems.push({
                   pin: Number(json.pin),
                   state: json.state,
                   isOn: json.isOn ?? (json.state === 'ON')
                 });
               }

               for (const item of stateItems) {
                 if (item.pin === undefined) continue;
                 const targetIsOn = item.isOn ?? (item.state === 'ON');

                 const matchingDevices = await prisma.device.findMany({
                   where: {
                     pin: item.pin,
                     deletedAt: null,
                     OR: [
                       ...nodeMatches.map(n => ({ nodeId: n.id })),
                       { nodeId: boardId }
                     ]
                   }
                 });

                 for (const dev of matchingDevices) {
                   const sObj = (dev.state as any) || {};
                   await prisma.device.update({
                     where: { id: dev.id },
                     data: { state: { ...sObj, isOn: targetIsOn } }
                   });

                   const payload = {
                     id: dev.id,
                     deviceId: dev.id,
                     pin: dev.pin,
                     state: targetIsOn ? 'ON' : 'OFF',
                     isOn: targetIsOn,
                     boardId
                   };

                    if ((this as any).server && (this as any).server.io) {
                      (this as any).server.io.to(`home:${dev.homeId}`).emit('device_state', payload);
                      (this as any).server.io.to(`home:${dev.homeId}`).emit('device_state_changed', { id: dev.id, state: { isOn: targetIsOn } });
                    }

                    // 🍏 Real-time Sync with Apple HomeKit
                    try {
                      const { syncHomeKitDeviceState } = require('./homekit.bridge');
                      syncHomeKitDeviceState(dev.pin, boardId, targetIsOn ? 'ON' : 'OFF');
                    } catch (e) {}
                 }
               }

               // 3. Broadcast updated full list
               const { SocketService } = require('./socket.service');
               if (rawHomeId && (this as any).server) {
                 const allDevices = await prisma.device.findMany({
                   where: { homeId: rawHomeId, deletedAt: null },
                   include: { node: true, room: true }
                 });
                 const mapped = allDevices.map(d => {
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
                 await SocketService.broadcastDevices((this as any).server, rawHomeId, mapped);
               }

               // 4. Optimistic UI Ack Check
               if (json.messageId && this.pendingCommands.has(json.messageId)) {
                  this.pendingCommands.get(json.messageId)!(true);
                  this.pendingCommands.delete(json.messageId);
               }
             } catch (err) {
               console.error('[MQTT State Sync Error]:', err);
             }
          } 
          else if (parsed.category === 'controller' && (parsed.action === 'status' || parsed.action === 'heartbeat')) {
             const isOnline = parsed.action === 'heartbeat' || msgStr.toLowerCase() === 'online';
             const variants = getMacVariants(boardId);
             let ipFromMsg: string | undefined;
             try {
               const parsedHb = JSON.parse(msgStr);
               if (parsedHb.ip || parsedHb.ipAddress) ipFromMsg = parsedHb.ip || parsedHb.ipAddress;
             } catch (_) {}

             await redisClient.hset(`mosa:home:${homeId}:device_status:${boardId}`, 'online', isOnline ? 'true' : 'false');
             await prisma.node.updateMany({
               where: {
                 deletedAt: null,
                 OR: [
                   ...variants.map(v => ({ id: v })),
                   ...variants.map(v => ({ mac: v })),
                   { name: boardId }
                 ]
               },
               data: {
                 status: isOnline ? 'online' : 'offline',
                 lastSeen: new Date(),
                 ...(ipFromMsg ? { ip: ipFromMsg } : {})
               }
             }).catch(() => {});

             if ((this as any).server && (this as any).server.io) {
               (this as any).server.io.to(`home:${homeId}`).emit('controller:status', { id: boardId, status: isOnline ? 'online' : 'offline' });
               (this as any).server.io.to(`home:${homeId}`).emit('board_status_change', { boardId, online: isOnline });
             }
          }
          else if (parsed.category === 'sensor') {
             // Handle sensor / alarms immediately
             await redisClient.publish(`alarms:${homeId}`, msgStr);
          }
          else if (parsed.category === 'audio') {
             // Handle smart speaker state, status, and telemetry (Tenant-Scoped)
             try {
               const json = JSON.parse(msgStr);
               await redisClient.hset(`mosa:home:${homeId}:audio_state:${boardId}`, 'latest', msgStr);
               if ((this as any).server && (this as any).server.io) {
                 (this as any).server.io.to(`home:${homeId}`).emit('audio_state', json);
               }
             } catch (err) {
               console.error('[MQTT Audio Sync Error]:', err);
             }
          }
        }
      } catch (err) {
        console.error('[MQTT] Message parsing error:', err);
      }
    });

    this.client.on('error', (err) => {
      console.error('[MQTT] Connection Error:', err);
    });
  }

  /**
   * Send a command with QoS 1 and resolve immediately on successful broker delivery
   */
  static async publishCommand(homeId: string, boardId: string, command: any): Promise<boolean> {
    if (!this.client?.connected) return false;

    const formattedBoardId = getBoardId(null, boardId);
    const messageId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    command.messageId = messageId;
    command.targetBoardId = formattedBoardId;
    command.boardId = formattedBoardId;
    
    const topic = `mosa/${homeId}/device/${formattedBoardId}/command`;

    return new Promise((resolve) => {
      this.client.publish(topic, JSON.stringify(command), { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT] Failed to publish command to ${topic}:`, err);
          resolve(false);
        } else {
          console.log(`[MQTT] Command published strictly to ${topic}`);
          resolve(true);
        }
      });
    });
  }

  /**
   * Send an audio control command over tenant-isolated topic: mosa/{homeId}/audio/{nodeId}/set
   */
  static async publishAudioCommand(homeId: string, boardId: string, command: any): Promise<boolean> {
    if (!this.client?.connected) return false;

    const formattedBoardId = getBoardId(null, boardId);
    const messageId = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const payload = {
      ...command,
      messageId,
      boardId: formattedBoardId,
      nodeId: formattedBoardId,
      timestamp: Date.now()
    };
    
    const topic = `mosa/${homeId}/audio/${formattedBoardId}/set`;

    return new Promise((resolve) => {
      this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT Audio] Failed to publish command to ${topic}:`, err);
          resolve(false);
        } else {
          console.log(`[MQTT Audio 🔊] Command published strictly to ${topic}:`, command.action || command.command);
          resolve(true);
        }
      });
    });
  }

  /**
   * Register a new device with Mosquitto Dynamic Security
   */
  static async registerDevice(boardId: string, secret: string) {
    if (!this.client?.connected) return;
    
    // Command format for Mosquitto Dynamic Security Plugin v1
    // 1. Create Client
    const createClientPayload = {
      command: "createClient",
      clientname: boardId,
      password: secret
    };
    this.client.publish(`$CONTROL/dynamic-security/v1`, JSON.stringify(createClientPayload));

    // 2. Assign Client to Role (e.g. 'device-role' which allows them to publish/subscribe)
    setTimeout(() => {
      const assignRolePayload = {
        command: "addClientRole",
        clientname: boardId,
        rolename: "device-role"
      };
      this.client.publish(`$CONTROL/dynamic-security/v1`, JSON.stringify(assignRolePayload));
    }, 500); // Slight delay to ensure client was created
  }
}
