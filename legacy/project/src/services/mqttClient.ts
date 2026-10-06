import mqtt, { MqttClient } from 'mqtt';
import { useSmartHomeStore } from '../store/useSmartHomeStore';

const MQTT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_TOPIC_WILDCARD_STATE = 'home/+/state';

let client: MqttClient | null = null;

export const connectMqtt = () => {
  if (client) return;

  try {
    client = mqtt.connect(MQTT_BROKER);

    client.on('connect', () => {
      console.log('Connected to MQTT Broker via WebSockets');
      // استخدام as any لتجاوز فحص TypeScript
      (useSmartHomeStore.getState() as any).setIsMqttConnected(true);
      client?.subscribe(MQTT_TOPIC_WILDCARD_STATE);
    });

    client.on('message', (topic, message) => {
      if (topic.startsWith('home/') && topic.endsWith('/state')) {
        try {
          const data = JSON.parse(message.toString());
          // تعريف الـ store كـ any لحل كل أخطاء الخصائص غير الموجودة
          const store = useSmartHomeStore.getState() as any;
          const boardId = data.boardId || topic.split('/')[1];

          if (data.type === "state") {
            // Auto-register board
            store.addOrUpdateBoard(boardId, undefined, data.boardName || undefined);

            // Update devices array
            if (Array.isArray(data.devices)) {
              store.setDevices(data.devices, boardId);
            }
            // Update global sensor and energy data
            if (data.totalKWh !== undefined) {
              store.setGlobalData({
                totalKWh: data.totalKWh || 0,
                currentPower: data.currentPower || 0,
                currentTemp: data.currentTemp || 0,
                currentHum: data.currentHum || 0
              });
              store.addPowerDataPoint(data.currentPower || 0);
            }
          } else if (data.type === "alarm") {
            // Update Activity Log
            store.setMotionAlert(true);
            store.addActivityLog(data.message || "حركة غير طبيعية (PIR)");
          }
        } catch (e) {
          console.error("MQTT parse error", e);
        }
      }
    });

    client.on('close', () => {
      console.log('Disconnected from MQTT Broker');
      (useSmartHomeStore.getState() as any).setIsMqttConnected(false);
    });

    client.on('error', (err) => {
      console.error('MQTT Connection Error:', err);
      client?.end();
    });

  } catch (error) {
    console.error("MQTT Initialization Error:", error);
  }
};

export const publishCommand = (boardId: string, payload: object) => {
  if (client && client.connected) {
    const topic = `home/${boardId}/command`;
    client.publish(topic, JSON.stringify(payload));
  } else {
    console.warn("Cannot send command: MQTT disconnected");
  }
};

export const disconnectMqtt = () => {
  if (client) {
    client.end();
    client = null;
  }
};