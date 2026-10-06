import { Result } from '../errors/Result';
import { BaseError } from '../errors/BaseError';
import { DeviceState } from '../types/DeviceState';
import { EntertainmentCapabilities } from '../types/Capabilities';
import { Command } from '../types/Command';

export interface BaseDriver {
  /** Initialize connection to the device */
  connect(): Promise<Result<void, BaseError>>;
  
  /** Disconnect from the device */
  disconnect(): Promise<Result<void, BaseError>>;
  
  /** Get device state */
  getState(): Promise<Result<DeviceState, BaseError>>;
  
  /** Get specific driver capabilities */
  getCapabilities(): EntertainmentCapabilities;
  
  /** Execute a generic command */
  executeCommand(command: Command): Promise<Result<void, BaseError>>;
}
