export interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export interface DeviceState {
  isOn: boolean;
  brightness?: number;
  color?: string;
}

export interface MQTTMessage {
  action: string;
  payload: any;
}
