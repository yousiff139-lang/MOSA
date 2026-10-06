import { BaseError } from './BaseError';

export class DriverNotSupportedError extends BaseError {
  constructor(driverName: string) {
    super(
      `Driver '${driverName}' is not supported.`,
      'DRIVER_NOT_SUPPORTED',
      'HIGH',
      false,
      'Check the DriverFactory registry and install the appropriate plugin.'
    );
  }
}

export class DeviceOfflineError extends BaseError {
  constructor(deviceId: string) {
    super(
      `Device ${deviceId} is currently offline.`,
      'DEVICE_OFFLINE',
      'LOW',
      true,
      'Wait for the device to reconnect or wake it up via Wake-on-LAN.'
    );
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication failed.') {
    super(message, 'AUTHENTICATION_FAILED', 'HIGH', true, 'Check pairing token or re-initiate pairing.');
  }
}

export class TimeoutError extends BaseError {
  constructor(operation: string, ms: number) {
    super(
      `Operation '${operation}' timed out after ${ms}ms.`,
      'TIMEOUT',
      'MEDIUM',
      true,
      'Retry the operation or check network latency.'
    );
  }
}

export class CommandRejectedError extends BaseError {
  constructor(command: string, reason: string) {
    super(
      `Command '${command}' was rejected: ${reason}`,
      'COMMAND_REJECTED',
      'MEDIUM',
      false,
      'Ensure the command is supported by the device capabilities.'
    );
  }
}
