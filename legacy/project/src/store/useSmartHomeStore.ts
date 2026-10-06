import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { Device, GlobalData, ActivityLog, PowerDataPoint, BoardConfig, AutomationRule } from '../types';

interface SmartHomeState {
  socket: Socket | null;
  isConnected: boolean; // Backend connection
  isMqttConnected: boolean; // Not strictly needed in UI now, but keeping for compatibility
  isAuthenticated: boolean;
  wsPassword: string;
  boards: Record<string, BoardConfig>;
  boardStatus: Record<string, boolean>;
  devices: Device[];
  globalData: GlobalData;
  activityLogs: ActivityLog[];
  powerHistory: PowerDataPoint[];
  automationRules: AutomationRule[];
  motionAlert: boolean;
  discoveryAlert: { name: string; boardId: string } | null;
  favoriteDeviceIds: string[]; // Format: `${boardId}-${deviceId}`
  energyBudget: number;

  // Actions
  initBackendConnection: () => void;
  setIsConnected: (status: boolean) => void;
  setIsAuthenticated: (status: boolean) => void;
  setWsPassword: (password: string) => void;

  // API Actions
  addOrUpdateBoard: (boardId: string, ip?: string, name?: string) => Promise<void>;
  removeBoard: (boardId: string) => Promise<void>;
  updateDeviceOrder: (items: { id: number; boardId: string; orderIndex: number }[]) => Promise<void>;

  // Automations
  addAutomationRule: (rule: AutomationRule) => Promise<void>;
  updateAutomationRule: (id: string, rule: Partial<AutomationRule>) => Promise<void>;
  removeAutomationRule: (id: string) => Promise<void>;
  toggleAutomationRule: (id: string) => Promise<void>;

  setMotionAlert: (status: boolean) => void;
  setDiscoveryAlert: (alert: { name: string; boardId: string } | null) => void;
  clearActivityLogs: () => Promise<void>;
  toggleFavorite: (boardId: string, deviceId: number) => void;
  setEnergyBudget: (budget: number) => void;
}

const BACKEND_URL = 'http://localhost:3001';

const getStoredWSPass = () => localStorage.getItem('ws_password') || "admin";

export const useSmartHomeStore = create<SmartHomeState>((set, get) => ({
  socket: null,
  isConnected: false,
  isMqttConnected: false,
  isAuthenticated: false,
  wsPassword: getStoredWSPass(),
  boards: {},
  boardStatus: {},
  devices: [],
  globalData: {
    totalKWh: 0,
    currentPower: 0,
    currentTemp: 0,
    currentHum: 0,
  },
  activityLogs: [],
  powerHistory: [],
  automationRules: [],
  motionAlert: false,
  discoveryAlert: null,
  favoriteDeviceIds: JSON.parse(localStorage.getItem('favoriteDeviceIds') || '[]'),
  energyBudget: Number(localStorage.getItem('energyBudget')) || 50,

  initBackendConnection: () => {
    const { socket } = get();
    if (socket) return; // Already initialized

    const newSocket = io(BACKEND_URL);

    newSocket.on('connect', () => {
      set({ isConnected: true, socket: newSocket });

      // Fetch initial data
      fetch(`${BACKEND_URL}/api/boards`).then(r => r.json()).then(data => {
        const boardsObj: Record<string, BoardConfig> = {};
        data.forEach((b: any) => boardsObj[b.id] = b);
        set({ boards: boardsObj });
      });

      fetch(`${BACKEND_URL}/api/devices`).then(r => r.json()).then(data => {
        set({ devices: data });
      });

      fetch(`${BACKEND_URL}/api/telemetry/history`).then(r => r.json()).then(data => {
        if (data.length > 0) {
          const latest = data[data.length - 1];
          set({
            globalData: {
              currentTemp: latest.temperature,
              currentHum: latest.humidity,
              currentPower: latest.powerUsage,
              totalKWh: latest.totalKWh
            }
          });
        }
        // Map to UI power history format
        const history = data.map((d: any) => ({
          time: new Date(d.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          power: d.powerUsage
        }));
        set({ powerHistory: history });
      });

      fetch(`${BACKEND_URL}/api/logs`).then(r => r.json()).then(data => {
        set({ activityLogs: data });
      });

      fetch(`${BACKEND_URL}/api/automations`).then(r => r.json()).then(data => {
        set({ automationRules: data });
      });
    });

    newSocket.on('disconnect', () => {
      set({ isConnected: false });
    });

    // Listen for Real-Time Updates
    newSocket.on('devices_updated', (devices) => {
      set({ devices });
    });

    newSocket.on('boards_updated', (boards) => {
      const boardsObj: Record<string, BoardConfig> = {};
      boards.forEach((b: any) => boardsObj[b.id] = b);
      set({ boards: boardsObj });
    });

    newSocket.on('telemetry_update', (data) => {
      set(state => {
        const now = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const newHistory = [...state.powerHistory, { time: now, power: data.currentPower }].slice(-100);
        return {
          globalData: {
            currentTemp: data.currentTemp,
            currentHum: data.currentHum,
            currentPower: data.currentPower,
            totalKWh: data.totalKWh
          },
          powerHistory: newHistory
        };
      });
    });

    newSocket.on('logs_updated', (logs) => {
      set({ activityLogs: logs });
    });

    newSocket.on('automations_updated', (rules) => {
      set({ automationRules: rules });
    });

    newSocket.on('motion_alert', () => {
      set({ motionAlert: true });
    });

    newSocket.on('device_discovered', (info) => {
      set({ discoveryAlert: info });
      // Play a nice discovery sound if possible, or just the alert
    });

    newSocket.on('new_board_discovered', (info) => {
      set({ discoveryAlert: info });
    });

    newSocket.on('board_status_change', ({ boardId, online }) => {
      set(state => ({
        boardStatus: {
          ...state.boardStatus,
          [boardId]: online
        }
      }));
    });
  },

  setIsConnected: (status) => set({ isConnected: status }),
  setIsAuthenticated: (status) => set({ isAuthenticated: status }),

  setWsPassword: (password) => {
    localStorage.setItem('ws_password', password);
    set({ wsPassword: password });
  },

  // API Actions
  addOrUpdateBoard: async (boardId, ip = '', name) => {
    await fetch(`${BACKEND_URL}/api/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: boardId, name: name || boardId, ip })
    });
  },

  removeBoard: async (boardId) => {
    await fetch(`${BACKEND_URL}/api/boards/${boardId}`, { method: 'DELETE' });
  },

  updateDeviceOrder: async (items) => {
    // Optimistic update
    set(state => {
      const newDevices = [...state.devices];
      items.forEach(item => {
        const d = newDevices.find(dev => dev.id === item.id && dev.boardId === item.boardId);
        if (d) (d as any).orderIndex = item.orderIndex;
      });
      return { devices: newDevices.sort((a, b) => ((a as any).orderIndex || 0) - ((b as any).orderIndex || 0)) };
    });

    await fetch(`${BACKEND_URL}/api/devices/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
  },

  addAutomationRule: async (rule) => {
    await fetch(`${BACKEND_URL}/api/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
  },

  updateAutomationRule: async (id, updatedFields) => {
    const currentRule = get().automationRules.find(r => r.id === id);
    if (!currentRule) return;
    const rule = { ...currentRule, ...updatedFields };
    await fetch(`${BACKEND_URL}/api/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
  },

  removeAutomationRule: async (id) => {
    await fetch(`${BACKEND_URL}/api/automations/${id}`, { method: 'DELETE' });
  },

  toggleAutomationRule: async (id) => {
    const currentRule = get().automationRules.find(r => r.id === id);
    if (!currentRule) return;
    const rule = { ...currentRule, enabled: !currentRule.enabled };
    await fetch(`${BACKEND_URL}/api/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
  },

  setMotionAlert: (status) => set({ motionAlert: status }),
  setDiscoveryAlert: (alert) => set({ discoveryAlert: alert }),

  clearActivityLogs: async () => {
    await fetch(`${BACKEND_URL}/api/logs`, { method: 'DELETE' });
  },

  toggleFavorite: (boardId: string, deviceId: number) => {
    set(state => {
      const globalId = `${boardId}-${deviceId}`;
      const newFavorites = state.favoriteDeviceIds.includes(globalId)
        ? state.favoriteDeviceIds.filter(id => id !== globalId)
        : [...state.favoriteDeviceIds, globalId];
      
      localStorage.setItem('favoriteDeviceIds', JSON.stringify(newFavorites));
      return { favoriteDeviceIds: newFavorites };
    });
  },

  setEnergyBudget: (budget: number) => {
    localStorage.setItem('energyBudget', String(budget));
    set({ energyBudget: budget });
  }
}));
