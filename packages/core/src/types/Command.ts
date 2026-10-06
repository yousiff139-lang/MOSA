export type CommandSource = 'WEB' | 'MOBILE' | 'MQTT' | 'AUTOMATION' | 'AI' | 'VOICE' | 'API';

export interface CommandPayload {
  action: string;
  value?: string | number | boolean | Record<string, any>;
}

export interface Command {
  id: string;
  deviceId: string;
  driver: string;
  payload: CommandPayload;
  priority: number;
  timestamp: Date;
  userId?: string;
  source: CommandSource;
  retryCount: number;
}
