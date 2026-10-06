import { BaseEntertainmentDriver } from './BaseEntertainmentDriver';
import { Result } from '@mosa/core/dist/errors/Result';
import { BaseError } from '@mosa/core/dist/errors/BaseError';
import { DeviceState } from '@mosa/core/dist/types/DeviceState';
import { EntertainmentCapabilities, AppMetadata, InputMetadata } from '@mosa/core/dist/types/Capabilities';
import dgram from 'dgram';

const ROKU_KEYS: Record<string, string> = {
  'POWER': 'Power',
  'POWER_ON': 'PowerOn',
  'POWER_OFF': 'PowerOff',
  'HOME': 'Home',
  'BACK': 'Back',
  'UP': 'Up',
  'DOWN': 'Down',
  'LEFT': 'Left',
  'RIGHT': 'Right',
  'OK': 'Select',
  'ENTER': 'Select',
  'VOL_UP': 'VolumeUp',
  'VOL_DOWN': 'VolumeDown',
  'MUTE': 'VolumeMute',
  'PLAY': 'Play',
  'PAUSE': 'Play',
  'PLAY_PAUSE': 'Play',
  'REWIND_10': 'Rev',
  'FORWARD_10': 'Fwd',
  'INFO': 'Info',
  'CH_UP': 'ChannelUp',
  'CH_DOWN': 'ChannelDown'
};

const ROKU_APPS: Record<string, string> = {
  'netflix': '12',
  'youtube': '837',
  'prime': '13',
  'shahid': '171457',
  'disney': '291097',
  'hulu': '2285',
  'spotify': '22297',
  'apple': '551012'
};

export class RokuDriver extends BaseEntertainmentDriver {
  private port: number = 8060;

  constructor(deviceId: string, ipAddress: string, macAddress?: string) {
    super(deviceId, ipAddress, macAddress);
  }

  async connect(): Promise<Result<void, BaseError>> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 600);
      const res = await fetch(`http://${this.ipAddress}:${this.port}/query/device-info`, {
        signal: controller.signal
      });
      clearTimeout(id);
      this.isConnected = res.ok;
    } catch {
      this.isConnected = false;
    }
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
      volume: 25,
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

  private async postEcp(path: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 800);
      await fetch(`http://${this.ipAddress}:${this.port}${path}`, {
        method: 'POST',
        signal: controller.signal
      });
      clearTimeout(id);
      return true;
    } catch {
      return false;
    }
  }

  async power(on: boolean): Promise<Result<void, BaseError>> {
    if (on) {
      this.sendWol();
      await this.postEcp('/keypress/PowerOn');
    } else {
      await this.postEcp('/keypress/PowerOff');
    }
    return Result.ok();
  }

  async volumeUp(): Promise<Result<void, BaseError>> {
    await this.postEcp('/keypress/VolumeUp');
    return Result.ok();
  }

  async volumeDown(): Promise<Result<void, BaseError>> {
    await this.postEcp('/keypress/VolumeDown');
    return Result.ok();
  }

  async setVolume(level: number): Promise<Result<void, BaseError>> {
    return Result.ok();
  }

  async setMute(mute: boolean): Promise<Result<void, BaseError>> {
    await this.postEcp('/keypress/VolumeMute');
    return Result.ok();
  }

  async getApps(): Promise<Result<AppMetadata[], BaseError>> {
    return Result.ok([
      { id: '12', name: 'Netflix', icon: '' },
      { id: '837', name: 'YouTube', icon: '' },
      { id: '171457', name: 'Shahid VIP', icon: '' },
      { id: '13', name: 'Prime Video', icon: '' }
    ]);
  }

  async launchApp(appId: string): Promise<Result<void, BaseError>> {
    const rokuAppId = ROKU_APPS[appId.toLowerCase()] || appId;
    await this.postEcp(`/launch/${rokuAppId}`);
    return Result.ok();
  }

  async getInputs(): Promise<Result<InputMetadata[], BaseError>> {
    return Result.ok([
      { id: 'InputTuner', name: 'Live TV', type: 'TUNER' },
      { id: 'InputHDMI1', name: 'HDMI 1', type: 'HDMI' },
      { id: 'InputHDMI2', name: 'HDMI 2', type: 'HDMI' },
      { id: 'InputAV1', name: 'AV', type: 'COMPONENT' }
    ]);
  }

  async setInput(inputId: string): Promise<Result<void, BaseError>> {
    await this.postEcp(`/keypress/${inputId}`);
    return Result.ok();
  }

  async sendKey(key: string): Promise<Result<void, BaseError>> {
    const rokuKey = ROKU_KEYS[key.toUpperCase()] || key;
    await this.postEcp(`/keypress/${rokuKey}`);
    return Result.ok();
  }

  async sendText(text: string): Promise<Result<void, BaseError>> {
    for (const char of text) {
      await this.postEcp(`/keypress/Lit_${encodeURIComponent(char)}`);
    }
    return Result.ok();
  }
}
