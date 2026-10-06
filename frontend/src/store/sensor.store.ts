import { create } from 'zustand';

interface SensorState {
  temperature: number | null;
  humidity: number | null;
  lastMotion: string | null;
  setTemperature: (value: number) => void;
  setHumidity: (value: number) => void;
  setLastMotion: (timestamp: string) => void;
}

export const useSensorStore = create<SensorState>((set) => ({
  temperature: null,
  humidity: null,
  lastMotion: null,
  setTemperature: (value) => set({ temperature: value }),
  setHumidity: (value) => set({ humidity: value }),
  setLastMotion: (timestamp) => set({ lastMotion: timestamp }),
}));
