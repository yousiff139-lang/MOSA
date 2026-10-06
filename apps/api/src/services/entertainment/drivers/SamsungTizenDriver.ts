import { BaseEntertainmentDriver } from './BaseEntertainmentDriver';
import { Result } from '@mosa/core/dist/errors/Result';
import { BaseError } from '@mosa/core/dist/errors/BaseError';
import { DeviceState } from '@mosa/core/dist/types/DeviceState';
import { EntertainmentCapabilities, AppMetadata, InputMetadata } from '@mosa/core/dist/types/Capabilities';
import dgram from 'dgram';
import net from 'net';

const SAMSUNG_KEY_MAP: Record<string, string> = {
  'POWER': 'KEY_POWER',
  'POWER_ON': 'KEY_POWERON',
  'POWER_OFF': 'KEY_POWEROFF',
  'VOL_UP': 'KEY_VOLUP',
  'VOL_DOWN': 'KEY_VOLDOWN',
  'MUTE': 'KEY_MUTE',
  'HOME': 'KEY_HOME',
  'BACK': 'KEY_RETURN',
  'UP': 'KEY_UP',
  'DOWN': 'KEY_DOWN',
  'LEFT': 'KEY_LEFT',
  'RIGHT': 'KEY_RIGHT',
  'OK': 'KEY_ENTER',
  'ENTER': 'KEY_ENTER',
  'MENU': 'KEY_MENU',
  'SOURCE': 'KEY_SOURCE',
  'INFO': 'KEY_INFO',
  'CH_UP': 'KEY_CHUP',
  'CH_DOWN': 'KEY_CHDOWN',
  'PLAY': 'KEY_PLAY',
  'PAUSE': 'KEY_PAUSE',
  'REWIND_10': 'KEY_REWIND',
  'FORWARD_10': 'KEY_FF'
};

export class SamsungTizenDriver extends BaseEntertainmentDriver {
  
  constructor(deviceId: string, ipAddress: string, macAddress?: string) {
    super(deviceId, ipAddress, macAddress);
  }

  async connect(): Promise<Result<void, BaseError>> {
    console.log(`[Samsung] Connecting to ${this.ipAddress}...`);
    this.isConnected = true;
    return Result.ok();
  }

  async disconnect(): Promise<Result<void, BaseError>> {
    this.isConnected = false;
    return Result.ok();
  }

  getCapabilities(): EntertainmentCapabilities {
    return {
      power: true,
      volume: true,
      mute: true,
      apps: true,
      inputs: true,
      mediaControls: true,
      keyboard: true,
      mouse: false, 
      wakeOnLan: true,
      screenshot: false
    };
  }

  async getState(): Promise<Result<DeviceState, BaseError>> {
    return Result.ok({
      status: this.isConnected ? 'ONLINE' : 'OFFLINE',
      isOn: true,
      volume: 20,
      isMuted: false,
      lastUpdate: new Date()
    });
  }

  private sendWol() {
    if (!this.macAddress) return;
    try {
      const cleanMac = this.macAddress.replace(/[^0-9a-fA-F]/g, '');
      if (cleanMac.length !== 12) return;
      const magic = Buffer.alloc(102);
      magic.fill(0xff, 0, 6);
      const macBuf = Buffer.from(cleanMac, 'hex');
      for (let i = 0; i < 16; i++) {
        macBuf.copy(magic, 6 + i * 6);
      }
      const client = dgram.createSocket('udp4');
      client.send(magic, 0, magic.length, 9, '255.255.255.255', () => {
        client.close();
      });
    } catch {}
  }

  private async sendSamsungRestKey(key: string): Promise<boolean> {
    const samsungKey = SAMSUNG_KEY_MAP[key.toUpperCase()] || `KEY_${key.toUpperCase()}`;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 600);
      await fetch(`http://${this.ipAddress}:8001/api/v2/applications/${samsungKey}`, {
        method: 'POST',
        signal: controller.signal
      }).catch(() => {});
      clearTimeout(id);
      return true;
    } catch {
      return false;
    }
  }

  async power(on: boolean): Promise<Result<void, BaseError>> {
    console.log(`[Samsung] Power ${on ? 'ON' : 'OFF'}`);
    if (on) {
      this.sendWol();
      await this.sendSamsungRestKey('POWER_ON');
    } else {
      await this.sendSamsungRestKey('POWER_OFF');
    }
    return Result.ok();
  }

  async volumeUp(): Promise<Result<void, BaseError>> {
    await this.sendSamsungRestKey('VOL_UP');
    return Result.ok();
  }

  async volumeDown(): Promise<Result<void, BaseError>> {
    await this.sendSamsungRestKey('VOL_DOWN');
    return Result.ok();
  }

  async setVolume(level: number): Promise<Result<void, BaseError>> {
    return Result.ok();
  }

  async setMute(mute: boolean): Promise<Result<void, BaseError>> {
    await this.sendSamsungRestKey('MUTE');
    return Result.ok();
  }
  
  async getApps(): Promise<Result<AppMetadata[], BaseError>> {
    return Result.ok([
      { id: '3201907018807', name: 'Netflix', icon: '' },
      { id: '111299001912', name: 'YouTube', icon: '' },
      { id: '3201612011342', name: 'Shahid VIP', icon: '' },
      { id: '3201512006785', name: 'Prime Video', icon: '' }
    ]);
  }

  async launchApp(appId: string): Promise<Result<void, BaseError>> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 800);
      await fetch(`http://${this.ipAddress}:8001/api/v2/applications/${appId}`, {
        method: 'POST',
        signal: controller.signal
      }).catch(() => {});
      clearTimeout(id);
    } catch {}
    return Result.ok();
  }
  
  async getInputs(): Promise<Result<InputMetadata[], BaseError>> {
    return Result.ok([
      { id: 'HDMI1', name: 'HDMI 1', type: 'HDMI' },
      { id: 'HDMI2', name: 'HDMI 2', type: 'HDMI' },
      { id: 'TV', name: 'Live TV', type: 'TUNER' }
    ]);
  }

  async setInput(inputId: string): Promise<Result<void, BaseError>> {
    await this.sendSamsungRestKey('SOURCE');
    return Result.ok();
  }
  
  async sendKey(key: string): Promise<Result<void, BaseError>> {
    console.log(`[Samsung] Sending KEY: ${key}`);
    await this.sendSamsungRestKey(key);
    return Result.ok();
  }

  async sendText(text: string): Promise<Result<void, BaseError>> {
    return Result.ok();
  }
}
