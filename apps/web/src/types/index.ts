export interface Device {
  id: number;
  boardId?: string;
  name: string;
  type: 'light' | 'socket' | 'fan' | 'sensor' | string;
  room: string;
  pin: number | string;
  inPin: number | string;
  state: 'ON' | 'OFF';
  currentState?: 'ON' | 'OFF';
  pwmValue?: number;
  color?: string;
  timerOffMillis?: number;
  usage?: number;
  temperature?: number;
  humidity?: number;
  powerUsage?: number;
  order?: number;
  targetTemp?: number;
  currentTemp?: number;
  currentAmps?: number | string;
  soilMoisture?: number | string;
  value?: number | string;
  pinNumber?: number | string;
  switchPin?: number | string;
  switch_pin?: number | string;
  activeState?: string;
  switchMode?: string;
  stateObj?: any;
  nodeId?: string;

  // Schedule Fields
  scheduleActive?: boolean;
  scheduleHourOn?: number;
  scheduleMinuteOn?: number;
  scheduleHourOff?: number;
  scheduleMinuteOff?: number;
}

export interface BoardConfig {
  id: string;
  ip: string;
  name: string;
  status?: 'online' | 'offline' | string;
  rssi?: number;
  mac?: string;
  lastSeen?: number | string | Date;
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
  triggerValue?: number | string;
  logicOperator?: 'NONE' | 'AND' | 'OR';
  secondarySensorType?: 'temperature' | 'humidity' | 'power';
  secondaryCondition?: '>' | '<' | '==';
  secondaryValue?: number;
  actionDeviceId: number | string;
  actionBoardId: string;
  actionState: 'ON' | 'OFF';
}
