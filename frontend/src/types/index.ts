export type Role = 'ADMIN' | 'RESTRICTED_USER';
export type DeviceType = 'LIGHT' | 'SOCKET' | 'SENSOR_TEMP' | 'SENSOR_MOTION' | 'CLIMATE';
export type PinMode = 'INPUT' | 'OUTPUT';

export interface User {
  id: string;
  username: string;
  role: Role;
}

export interface Room {
  id: string;
  name: string;
  icon?: string;
  createdAt: string;
  devices?: Device[];
}

export interface Controller {
  id: string;
  name: string;
  macAddress: string;
  ipAddress?: string;
  status: string;
  firmwareVersion?: string;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  pinNumber: number;
  pinMode: PinMode;
  mqttTopic: string;
  currentState: string;
  roomId?: string;
  controllerId: string;
}

export interface SocketEvents {
  'device:state': { deviceId: string; mqttTopic: string; state: string; timestamp: string };
  'sensor:temperature': { deviceId: string; value: number; unit: string; timestamp: string };
  'sensor:motion': { deviceId: string; detected: boolean; timestamp: string };
  'controller:status': { controllerId: string; status: string; timestamp: string };
  'mqtt:status': { connected: boolean; timestamp: string };
}
