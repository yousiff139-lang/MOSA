import { DomainEvent } from './EventBus';
import { DeviceState, DeviceStatus } from '../types/DeviceState';

export class PowerChangedEvent implements DomainEvent {
  public readonly eventName = 'PowerChanged';
  public readonly timestamp = new Date();
  constructor(public deviceId: string, public isOn: boolean) {}
}

export class VolumeChangedEvent implements DomainEvent {
  public readonly eventName = 'VolumeChanged';
  public readonly timestamp = new Date();
  constructor(public deviceId: string, public volume: number, public isMuted: boolean) {}
}

export class AppChangedEvent implements DomainEvent {
  public readonly eventName = 'AppChanged';
  public readonly timestamp = new Date();
  constructor(public deviceId: string, public appId: string, public appName: string) {}
}

export class DeviceStatusChangedEvent implements DomainEvent {
  public readonly eventName = 'DeviceStatusChanged';
  public readonly timestamp = new Date();
  constructor(public deviceId: string, public status: DeviceStatus) {}
}

export class InputChangedEvent implements DomainEvent {
  public readonly eventName = 'InputChanged';
  public readonly timestamp = new Date();
  constructor(public deviceId: string, public inputId: string) {}
}
