import { BaseDriver } from './Driver';
import { Result } from '../errors/Result';
import { BaseError } from '../errors/BaseError';
import { AppMetadata, InputMetadata } from '../types/Capabilities';

export interface TVDriver extends BaseDriver {
  power(on: boolean): Promise<Result<void, BaseError>>;
  volumeUp(): Promise<Result<void, BaseError>>;
  volumeDown(): Promise<Result<void, BaseError>>;
  setVolume(level: number): Promise<Result<void, BaseError>>;
  setMute(mute: boolean): Promise<Result<void, BaseError>>;
  
  getApps(): Promise<Result<AppMetadata[], BaseError>>;
  launchApp(appId: string): Promise<Result<void, BaseError>>;
  
  getInputs(): Promise<Result<InputMetadata[], BaseError>>;
  setInput(inputId: string): Promise<Result<void, BaseError>>;
  
  sendKey(key: string): Promise<Result<void, BaseError>>;
  sendText(text: string): Promise<Result<void, BaseError>>;
}
