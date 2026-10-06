import { Command } from '@mosa/core/dist/types/Command';
import { Result } from '@mosa/core/dist/errors/Result';
import { BaseError } from '@mosa/core/dist/errors/BaseError';
import { DeviceState } from '@mosa/core/dist/types/DeviceState';
import { EntertainmentCapabilities, AppMetadata, InputMetadata } from '@mosa/core/dist/types/Capabilities';

export abstract class BaseEntertainmentDriver {
  public deviceId: string;
  public ipAddress: string;
  public macAddress?: string;
  protected isConnected: boolean = false;

  constructor(deviceId: string, ipAddress: string, macAddress?: string) {
    this.deviceId = deviceId;
    this.ipAddress = ipAddress;
    this.macAddress = macAddress;
  }

  abstract connect(): Promise<Result<void, BaseError>>;
  abstract disconnect(): Promise<Result<void, BaseError>>;
  abstract getCapabilities(): EntertainmentCapabilities;
  abstract getState(): Promise<Result<DeviceState, BaseError>>;

  abstract power(on: boolean): Promise<Result<void, BaseError>>;
  abstract volumeUp(): Promise<Result<void, BaseError>>;
  abstract volumeDown(): Promise<Result<void, BaseError>>;
  abstract setVolume(level: number): Promise<Result<void, BaseError>>;
  abstract setMute(mute: boolean): Promise<Result<void, BaseError>>;
  
  abstract getApps(): Promise<Result<AppMetadata[], BaseError>>;
  abstract launchApp(appId: string): Promise<Result<void, BaseError>>;
  
  abstract getInputs(): Promise<Result<InputMetadata[], BaseError>>;
  abstract setInput(inputId: string): Promise<Result<void, BaseError>>;

  abstract sendKey(key: string): Promise<Result<void, BaseError>>;
  abstract sendText(text: string): Promise<Result<void, BaseError>>;

  async executeCommand(command: Command): Promise<Result<void, BaseError>> {
    const { action, value } = command.payload;
    try {
      switch (action.toUpperCase()) {
        case 'POWER_ON': return this.power(true);
        case 'POWER_OFF': return this.power(false);
        case 'POWER_TOGGLE': {
          const stateResult = await this.getState();
          if (stateResult.isFailure) return Result.fail(stateResult.error!);
          return this.power(!stateResult.getValue().isOn);
        }
        case 'VOL_UP': return this.volumeUp();
        case 'VOL_DOWN': return this.volumeDown();
        case 'SET_VOL': return this.setVolume(value as number);
        case 'MUTE': return this.setMute(true);
        case 'UNMUTE': return this.setMute(false);
        case 'LAUNCH_APP': return this.launchApp((value as any)?.app || (value as any)?.name || (value as string));
        case 'SET_INPUT': 
        case 'SELECT_INPUT': return this.setInput((value as any)?.input || (value as string));
        case 'SEND_KEY': return this.sendKey(value as string);
        case 'SEND_TEXT': return this.sendText(value as string);
        case 'UP':
        case 'DOWN':
        case 'LEFT':
        case 'RIGHT':
        case 'OK':
        case 'ENTER':
        case 'BACK':
        case 'HOME':
        case 'MENU':
        case 'SOURCE':
        case 'INFO':
        case 'PLAY':
        case 'PAUSE':
        case 'REWIND_10':
        case 'FORWARD_10':
        case 'CH_UP':
        case 'CH_DOWN':
        case 'PREV_CH':
        case 'COLOR_RED':
        case 'COLOR_GREEN':
        case 'COLOR_YELLOW':
        case 'COLOR_BLUE':
          return this.sendKey(action.toUpperCase());
        case 'NUM_KEY': {
          const num = (value as any)?.num !== undefined ? (value as any).num : (value ?? 0);
          return this.sendKey(`NUM_${num}`);
        }
        default:
          // Fallback to sending key for any unrecognized command
          return this.sendKey(action);
      }
    } catch (e: any) {
      return Result.fail({ message: e.message, code: 'DRIVER_EXCEPTION', severity: 'HIGH', isTransient: false } as unknown as BaseError);
    }
  }
}
