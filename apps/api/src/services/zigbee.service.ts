import { PrismaClient } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { setCache } from '../lib/cache';

const prisma = new PrismaClient();

export class ZigbeeService {
  /**
   * Toggles the Permit Join status on the Zigbee2MQTT coordinator.
   * Enables pairing for 120 seconds.
   */
  static async setPermitJoin(permit: boolean, mqtt: any): Promise<void> {
    mqtt.publish('zigbee2mqtt/bridge/request/permit_join', JSON.stringify({ value: permit, time: 120 }));
  }

  /**
   * Parses incoming Zigbee device discovery messages and registers them in the database.
   */
  static async handleDeviceDiscovery(payloadStr: string): Promise<void> {
    try {
      const payload = JSON.parse(payloadStr);
      // Zigbee2MQTT sends an array of devices in bridge/devices
      if (Array.isArray(payload)) {
        for (const device of payload) {
          if (device.type === 'Coordinator') continue;

          const ieeeAddr = device.ieee_address;
          const name = device.friendly_name || `Zigbee Device ${ieeeAddr.slice(-4)}`;
          const vendor = device.definition?.vendor || 'Unknown Vendor';
          const model = device.definition?.model || 'Unknown Model';

          // Upsert the node into our database
          await prisma.node.upsert({
            where: { mac: ieeeAddr },
            update: {
              status: 'online',
              firmware: `${vendor} ${model}`,
              lastSeen: new Date()
            },
            create: {
              mac: ieeeAddr,
              name: name,
              status: 'pending', // Requires user to assign it to a room
              protocol: 'ZIGBEE',
              firmware: `${vendor} ${model}`
            }
          });
        }
      }
    } catch (error) {
      console.error('[ZigbeeService] Error parsing discovery payload:', error);
    }
  }

  /**
   * Handles Zigbee bridge events such as device_joined, device_leave, device_interview.
   */
  static async handleBridgeEvent(payloadStr: string, server: FastifyInstance): Promise<void> {
    try {
      const event = JSON.parse(payloadStr);
      if (event.type === 'device_leave' || event.type === 'device_removed') {
        const ieeeAddr = event.data?.ieee_address;
        if (ieeeAddr) {
          server.log.warn(`[ZigbeeService] Device left or removed from Zigbee network: ${ieeeAddr}`);
          await prisma.node.updateMany({
            where: { mac: ieeeAddr },
            data: { status: 'offline' }
          });
        }
      }
    } catch (error) {
      server.log.error(error, '[ZigbeeService] Error parsing bridge event');
    }
  }

  /**
   * Ingests real-time state and telemetry reports from individual Zigbee devices (topic: zigbee2mqtt/<device>).
   */
  static async handleDeviceState(topic: string, payloadStr: string, server: FastifyInstance, automationEngine?: any): Promise<void> {
    try {
      const deviceIdentifier = topic.replace(/^zigbee2mqtt\//, '');
      if (!deviceIdentifier || deviceIdentifier.startsWith('bridge')) return;

      const payload = JSON.parse(payloadStr);

      // Find matching Node by MAC (ieeeAddr) or friendly name
      const node = await prisma.node.findFirst({
        where: {
          OR: [
            { mac: deviceIdentifier },
            { name: deviceIdentifier }
          ]
        },
        include: { devices: true }
      });

      if (!node) return;

      // Update Node heartbeat
      await prisma.node.update({
        where: { id: node.id },
        data: { status: 'online', lastSeen: new Date() }
      });

      // Normalize state payload
      const normalizedState: any = {
        raw: payload,
        lastSeen: Date.now()
      };

      if (payload.state !== undefined) {
        normalizedState.isOn = payload.state === 'ON' || payload.state === true || payload.state === 1;
        normalizedState.state = payload.state;
      }
      if (payload.brightness !== undefined) normalizedState.brightness = payload.brightness;
      if (payload.occupancy !== undefined) normalizedState.motion = payload.occupancy;
      if (payload.motion !== undefined) normalizedState.motion = payload.motion;
      if (payload.contact !== undefined) normalizedState.contact = payload.contact;
      if (payload.temperature !== undefined) normalizedState.temperature = payload.temperature;
      if (payload.humidity !== undefined) normalizedState.humidity = payload.humidity;
      if (payload.battery !== undefined) normalizedState.battery = payload.battery;
      if (payload.linkquality !== undefined) normalizedState.lqi = payload.linkquality;

      // Save to Universal Redis Device Shadow for fast sub-millisecond condition queries
      await setCache(`node:shadow:${node.mac}`, normalizedState, 86400);

      for (const device of node.devices) {
        const mergedState = { ...(device.state as object || {}), ...normalizedState };
        
        await prisma.device.update({
          where: { id: device.id },
          data: { state: mergedState }
        });

        await setCache(`device:shadow:${device.id}`, mergedState, 86400);

        // Emit real-time update to tenant room
        if (device.homeId) {
          server.io.to(`home:${device.homeId}`).emit('device_updated', {
            id: device.id,
            state: mergedState,
            nodeId: node.id
          });
        }
      }

      // Forward to Automation Engine
      if (automationEngine) {
        automationEngine.handleMqttMessage(node.mac, { ...payload, ...normalizedState });
      }

    } catch (error) {
      server.log.error({ err: error, topic }, '[ZigbeeService] Failed to process Zigbee device state');
    }
  }
}
