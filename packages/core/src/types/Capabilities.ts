export interface EntertainmentCapabilities {
  power: boolean;
  volume: boolean;
  mute: boolean;
  apps: boolean;
  inputs: boolean;
  mediaControls: boolean;
  keyboard: boolean;
  mouse: boolean;
  wakeOnLan: boolean;
  screenshot: boolean;
}

export interface AppMetadata {
  id: string;
  name: string;
  icon?: string;
}

export interface InputMetadata {
  id: string;
  name: string;
  type: 'HDMI' | 'USB' | 'CAST' | 'DLNA' | 'COMPONENT' | 'OTHER' | 'TUNER';
}
