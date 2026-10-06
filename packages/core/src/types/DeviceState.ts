export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'SLEEPING' | 'BOOTING' | 'BUSY' | 'UPDATING' | 'UNKNOWN';

export interface DeviceState {
  status: DeviceStatus;
  isOn: boolean;
  currentApp?: string;
  currentInput?: string;
  volume?: number;
  isMuted?: boolean;
  nowPlaying?: {
    title?: string;
    duration?: number;
    progress?: number;
  };
  lastUpdate: Date;
}
