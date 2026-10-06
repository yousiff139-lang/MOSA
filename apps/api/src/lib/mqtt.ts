import { z } from 'zod';

export const DeviceStateSchema = z.object({
  isOn: z.boolean().optional(),
  state: z.union([z.enum(['ON', 'OFF']), z.boolean()]).optional(),
  type: z.string().optional(),
  boardId: z.string().optional(),
  boardName: z.string().optional(),
  ip: z.string().optional(),
  ipAddress: z.string().optional(),
  totalKWh: z.number().optional(),
  currentPower: z.number().optional(),
  currentTemp: z.number().min(-50).max(100).optional(),
  currentHum: z.number().min(0).max(100).optional(),
  devices: z.array(z.any()).optional(),
  timestamp: z.number().optional(),
  ts: z.number().optional()
});

export const MAX_MQTT_PAYLOAD_SIZE = 64 * 1024; // 64KB Max Payload

export function parseTopic(topic: string) {
  // mosa/{homeId}/device/{deviceId}/state
  // mosa/{homeId}/sensor/{type}/{sensorId}
  // mosa/{homeId}/controller/{mac}/status
  // mosa/{homeId}/audio/{nodeId}/set
  // mosa/{homeId}/audio/{nodeId}/state
  
  const parts = topic.split('/');
  if (parts[0] !== 'mosa' || parts.length < 4) 
    return null;
  
  return {
    homeId: parts[1],
    category: parts[2],   // device|sensor|controller|ota|audio
    entityId: parts[3],   // deviceId|sensorType|mac|nodeId
    action: parts[4],     // state|status|update|result|set
  };
}

export function validateMqttMessage(topic: string, rawPayload: Buffer | string) {
  const payloadStr = typeof rawPayload === 'string' ? rawPayload : rawPayload.toString();
  
  if (Buffer.byteLength(payloadStr) > MAX_MQTT_PAYLOAD_SIZE) {
    console.error(`[MQTT Security] Rejected oversized payload: ${Buffer.byteLength(payloadStr)} bytes on ${topic}`);
    return null;
  }

  let parsedData: any;
  try {
    parsedData = JSON.parse(payloadStr);
  } catch (err) {
    console.error(`[MQTT Security] Rejected malformed JSON on ${topic}`);
    return null;
  }

  const topicInfo = parseTopic(topic);
  if (!topicInfo) {
    console.error(`[MQTT Security] Rejected invalid topic structure: ${topic}`);
    return null;
  }

  return {
    topicInfo,
    data: parsedData
  };
}

/**
 * Format any Node / MAC / ID into the exact boardID string expected by ESP32 firmware ("MosaNode_MACWITHOUTCOLONS")
 */
export function getBoardId(node: any, fallbackId?: string): string {
  const inputStr = node?.mac || node?.id || fallbackId || '';
  if (!inputStr) return 'MosaNode_UNKNOWN';

  // If already starts with MosaNode_
  if (inputStr.startsWith('MosaNode_')) {
    const rawMac = inputStr.replace('MosaNode_', '').replace(/:/g, '').toUpperCase();
    return `MosaNode_${rawMac}`;
  }

  // Strip colons and non-alphanumeric
  const cleanMac = inputStr.replace(/:/g, '').replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
  if (cleanMac.length === 12) {
    return `MosaNode_${cleanMac}`;
  }

  return inputStr;
}

/**
 * Returns all possible MAC string variants (raw, clean hex, colon-formatted, and MosaNode_ prefixed)
 */
export function getMacVariants(rawMac: string): string[] {
  if (!rawMac) return [];
  const clean = rawMac.replace(/^MosaNode_/i, '').replace(/[:-]/g, '').toUpperCase();
  const formatted = clean.length === 12 ? clean.match(/.{1,2}/g)!.join(':') : clean;
  return Array.from(new Set([
    rawMac,
    clean,
    formatted,
    `MosaNode_${clean}`
  ]));
}
