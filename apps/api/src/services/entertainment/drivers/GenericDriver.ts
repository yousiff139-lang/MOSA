import { BaseEntertainmentDriver } from './BaseEntertainmentDriver';
import { Result } from '@mosa/core/dist/errors/Result';
import { BaseError } from '@mosa/core/dist/errors/BaseError';
import { DeviceState } from '@mosa/core/dist/types/DeviceState';
import { EntertainmentCapabilities, AppMetadata, InputMetadata } from '@mosa/core/dist/types/Capabilities';

export class GenericDriver extends BaseEntertainmentDriver {
  
  async connect(): Promise<Result<void, BaseError>> {
    this.isConnected = true;
    return Result.ok();
  }

  async disconnect(): Promise<Result<void, BaseError>> {
    this.isConnected = false;
    return Result.ok();
  }

  getCapabilities(): EntertainmentCapabilities {
    return {
      power: true, volume: true, mute: true, apps: true, 
      inputs: true, mediaControls: true, keyboard: false, 
      mouse: false, wakeOnLan: false, screenshot: false
    };
  }

  async getState(): Promise<Result<DeviceState, BaseError>> {
    return Result.ok({
      status: 'ONLINE',
      isOn: true,
      volume: 30,
      isMuted: false,
      lastUpdate: new Date()
    });
  }

  async power(on: boolean): Promise<Result<void, BaseError>> {
    return Result.ok();
  }

  async volumeUp(): Promise<Result<void, BaseError>> { return Result.ok(); }
  async volumeDown(): Promise<Result<void, BaseError>> { return Result.ok(); }
  async setVolume(level: number): Promise<Result<void, BaseError>> { return Result.ok(); }
  async setMute(mute: boolean): Promise<Result<void, BaseError>> { return Result.ok(); }
  
  async getApps(): Promise<Result<AppMetadata[], BaseError>> {
    return Result.ok([]);
  }

  async launchApp(appId: string): Promise<Result<void, BaseError>> {
    return Result.ok();
  }
  
  async getInputs(): Promise<Result<InputMetadata[], BaseError>> {
    return Result.ok([]);
  }

  async setInput(inputId: string): Promise<Result<void, BaseError>> {
    return Result.ok();
  }

  async sendKey(key: string): Promise<Result<void, BaseError>> {
    return Result.ok();
  }

  async sendText(text: string): Promise<Result<void, BaseError>> {
    return Result.ok();
  }
}
