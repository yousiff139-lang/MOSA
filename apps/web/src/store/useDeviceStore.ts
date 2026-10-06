import { create } from 'zustand';

interface DeviceState {
  id: string;
  name: string;
  type: string;
  state: any;
  isOn: boolean;
  room?: string;
  brightness?: number;
}

interface DeviceStore {
  devices: DeviceState[];
  baseUrl: string;
  isOfflineMode: boolean;
  setDevices: (devices: DeviceState[]) => void;
  updateDeviceState: (deviceId: string, newState: any) => void;
  determineBaseUrl: () => Promise<void>;
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  devices: [],
  baseUrl: '/api',
  isOfflineMode: false,
  setDevices: (devices) => set({ devices }),
  updateDeviceState: (deviceId, newState) => set((state) => ({
    devices: state.devices.map((device) =>
      device.id === deviceId
        ? { ...device, state: newState, isOn: newState.isOn !== undefined ? newState.isOn : device.isOn }
        : device
    ),
  })),
  determineBaseUrl: async () => {
    try {
      // Attempt to ping local server first (Offline Mode check)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);
      
      const res = await fetch('http://mosa.local/api/ping', { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        set({ baseUrl: 'http://mosa.local', isOfflineMode: true });
        console.log('⚡ Connected to Local Server (Offline Mode)');
        return;
      }
    } catch (e) {
      // Local failed, fallback to cloud
      set({ baseUrl: '/api', isOfflineMode: false });
      console.log('☁️ Connected to Cloud Server');
    }
  }
}));
