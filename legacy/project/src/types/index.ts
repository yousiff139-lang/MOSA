export interface Device {
  id: number;
  boardId?: string;
  name: string;
  type: 'light' | 'socket' | 'fan' | 'sensor' | string; // Fallback string for unknown types if any
  room: string;
  pin: number | string;
  inPin: number | string;
  state: 'ON' | 'OFF';
  pwmValue?: number; // 0-255
  color?: string; // hex
  timerOffMillis?: number; // When to turn off
  usage?: number; // total usage time in seconds
  temperature?: number;
  humidity?: number;
  powerUsage?: number;
  order?: number; // For drag and drop sorting

  // Schedule Fields
  scheduleActive?: boolean;
  scheduleHourOn?: number;
  scheduleMinuteOn?: number;
  scheduleHourOff?: number;
  scheduleMinuteOff?: number;
}

export interface BoardConfig {
  id: string; // e.g. MosaNode_A1B2
  ip: string; // e.g. 192.168.1.108
  name: string; // User friendly name
}

export interface GlobalData {
  totalKWh: number;
  currentPower: number;
  currentTemp: number;
  currentHum: number;
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  message: string;
}

export interface PowerDataPoint {
  time: string;
  power: number;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: 'time' | 'sensor';
  triggerTime?: string;
  triggerSensorType?: 'temperature' | 'humidity' | 'power';
  triggerCondition?: '>' | '<' | '==';
  triggerValue?: number;
  logicOperator?: 'NONE' | 'AND' | 'OR';
  secondarySensorType?: 'temperature' | 'humidity' | 'power';
  secondaryCondition?: '>' | '<' | '==';
  secondaryValue?: number;
  actionDeviceId: number;
  actionBoardId: string;
  actionState: 'ON' | 'OFF';
}
