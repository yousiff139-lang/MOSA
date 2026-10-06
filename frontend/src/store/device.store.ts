import { create } from 'zustand';
import { Device, Room } from '../types';

interface DeviceState {
  devices: Device[];
  rooms: Room[];
  mqttConnected: boolean;
  setDevices: (devices: Device[]) => void;
  setRooms: (rooms: Room[]) => void;
  updateDeviceState: (deviceId: string, state: string) => void;
  setMqttStatus: (connected: boolean) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  rooms: [],
  mqttConnected: false,
  setDevices: (devices) => set({ devices }),
  setRooms: (rooms) => set({ rooms }),
  updateDeviceState: (deviceId, state) =>
    set((prev) => ({
      devices: prev.devices.map((d) =>
        d.id === deviceId ? { ...d, currentState: state } : d
      ),
    })),
  setMqttStatus: (connected) => set({ mqttConnected: connected }),
}));
