/* eslint-disable */
// @ts-nocheck
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';
import { Device, GlobalData, ActivityLog, PowerDataPoint, BoardConfig, AutomationRule } from '../types';
import { useRuntimeStore } from './useRuntimeStore';
import { fetchWithAuth } from '../lib/api';

const toggleTimeouts: Record<string, any> = {};

interface SmartHomeState {
  user: any | null;
  socket: Socket | null;
  isConnected: boolean;
  isMqttConnected: boolean;
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
  dismissedBoardIds: string[];
  notifications: { id: string, title: string, message: string, type: string, timestamp: number, read: boolean }[];
  favoriteDeviceIds: string[];
  energyBudget: number;
  isEdgeMode: boolean;
  rooms: { id: string, name: string, icon: string, _count?: { devices: number } }[];
  offlineQueue: Array<{ id: string, newState: string }>;
  branding: {
    platformName: string;
    logoUrl: string;
    loginBgUrl: string;
    colorPrimary: string;
  };
  setBranding: (branding: any) => void;

  initBackendConnection: () => void;
  refreshStateSilently: () => Promise<void>;
  setUser: (user: any) => void;
  setIsConnected: (status: boolean) => void;
  setIsAuthenticated: (status: boolean) => void;
  setWsPassword: (password: string) => void;

  addOrUpdateBoard: (boardId: string, ip?: string, name?: string) => Promise<void>;
  removeBoard: (boardId: string) => Promise<void>;
  updateDeviceOrder: (items: { id: number; boardId: string; orderIndex: number }[]) => Promise<void>;

  addAutomationRule: (rule: AutomationRule) => Promise<void>;
  updateAutomationRule: (id: string, rule: Partial<AutomationRule>) => Promise<void>;
  removeAutomationRule: (id: string) => Promise<void>;
  toggleAutomationRule: (id: string) => Promise<void>;

  setMotionAlert: (status: boolean) => void;
  dismissDiscoveryAlert: (boardNameOrId?: string) => void;
  setDiscoveryAlert: (alert: { name: string; boardId: string } | null) => void;
  clearActivityLogs: () => Promise<void>;
  markNotificationsRead: () => void;
  toggleFavorite: (boardId: string, deviceId: number) => void;
  setEnergyBudget: (budget: number) => void;
  updateDeviceState: (id: string, state: string) => void;
  toggleDevice: (id: string | number) => Promise<void>;
  toggleEdgeMode: () => void;
  addActivityLog: (message: string) => void;
  performanceMode: 'normal' | 'eco';
  setPerformanceMode: (mode: 'normal' | 'eco') => void;
  uiMode: 'simple' | 'full';
  setUiMode: (mode: 'simple' | 'full') => void;
  toggleUiMode: () => void;
}

const getStoredWSPass = () => {
  if (typeof window !== 'undefined') return localStorage.getItem('ws_password') || "admin";
  return "admin";
};

export const fetchAuth = fetchWithAuth;

export const useSmartHomeStore = create<SmartHomeState>()(
  persist(
    (set, get) => ({
  socket: null,
  isConnected: false,
  isMqttConnected: false,
  isAuthenticated: false,
  wsPassword: getStoredWSPass(),
  boards: {},
  boardStatus: {},
  devices: [],
  user: null,
  globalData: {
    totalKWh: 0,
    currentPower: 0,
    currentTemp: 0,
    currentHum: 0,
  },
  activityLogs: [],
  powerHistory: [],
  branding: {
    platformName: 'MOSA Smart Platform',
    logoUrl: '',
    loginBgUrl: '',
    colorPrimary: '#3b82f6'
  },
  setBranding: (branding) => {
    set({ branding });
    if (branding?.colorPrimary && typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--primary', branding.colorPrimary);
      root.style.setProperty('--color-primary', branding.colorPrimary);
      root.style.setProperty('--primary-glow', branding.colorPrimary + '80');
    }
  },
  automationRules: [],
  motionAlert: false,
  discoveryAlert: null,
  dismissedBoardIds: typeof window !== 'undefined' ? (() => { try { return JSON.parse(localStorage.getItem('dismissedBoardIds') || '[]'); } catch(e) { return []; } })() : [],
  dismissDiscoveryAlert: (boardNameOrId?: string) => {
    const current = get().discoveryAlert;
    const identifier = boardNameOrId || current?.name || current?.boardId;
    const currentDismissed = get().dismissedBoardIds || [];
    const newDismissed = Array.from(new Set([...currentDismissed, identifier, current?.name, current?.boardId].filter(Boolean)));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dismissedBoardIds', JSON.stringify(newDismissed));
      } catch(e) {}
    }
    set({ discoveryAlert: null, dismissedBoardIds: newDismissed });
  },
  notifications: [],
  favoriteDeviceIds: typeof window !== 'undefined' ? (() => { try { return JSON.parse(localStorage.getItem('favoriteDeviceIds') || '[]'); } catch(e) { return []; } })() : [],
  energyBudget: typeof window !== 'undefined' ? Number(localStorage.getItem('energyBudget')) || 50 : 50,
  isEdgeMode: typeof window !== 'undefined' ? localStorage.getItem('isEdgeMode') === 'true' : false,
  rooms: [],
  offlineQueue: [],
  performanceMode: typeof window !== 'undefined' ? (localStorage.getItem('performanceMode') as any) || 'eco' : 'eco',
  uiMode: typeof window !== 'undefined' ? (localStorage.getItem('mosa_ui_mode') as any) || 'full' : 'full',
  setUiMode: (mode: 'simple' | 'full') => {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('mosa_ui_mode', mode); } catch(e) {}
    }
    set({ uiMode: mode });
  },
  toggleUiMode: () => {
    const nextMode = get().uiMode === 'simple' ? 'full' : 'simple';
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('mosa_ui_mode', nextMode); } catch(e) {}
    }
    set({ uiMode: nextMode });
  },

  initBackendConnection: () => {
    const { socket } = get();
    if (socket && socket.connected) {
      get().refreshStateSilently();
      return;
    }

    if (socket) {
      try { socket.disconnect(); } catch (_) {}
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname.startsWith('/auth') || pathname.startsWith('/setup') || !token) {
        return;
      }
    }

    const newSocket = io({
      path: '/socket.io',
      withCredentials: true,
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling']
    });

    useRuntimeStore.getState().fetchRuntimeConfig(fetchAuth);

    const fetchInitialData = () => {
      Promise.allSettled([
        fetchAuth(`/api/controllers`).then(r => r.json()),
        fetchAuth(`/api/devices`).then(r => r.json()),
        fetchAuth(`/api/telemetry/history`).then(r => r.json()),
        fetchAuth(`/api/logs`).then(r => r.json()),
        fetchAuth(`/api/automations`).then(r => r.json()),
        fetchAuth(`/api/rooms`).then(r => r.json()),
        fetchAuth(`/api/branding`).then(r => r.json()).catch(() => ({ platformName: 'MOSA Smart Platform', colorPrimary: '#3b82f6' }))
      ]).then(([boardsRes, devicesRes, telemetryRes, logsRes, automationsRes, roomsRes, brandingRes]) => {
        if (logsRes.status === 'fulfilled') {
          const logsList = Array.isArray(logsRes.value) ? logsRes.value : (Array.isArray(logsRes.value?.data) ? logsRes.value.data : []);
          if (logsList.length > 0) set({ activityLogs: logsList });
        }
        if (devicesRes.status === 'fulfilled') {
          const devList = Array.isArray(devicesRes.value) ? devicesRes.value : (Array.isArray(devicesRes.value?.data) ? devicesRes.value.data : []);
          if (devList.length > 0 || Array.isArray(devicesRes.value)) set({ devices: devList });
        }
        if (roomsRes.status === 'fulfilled') {
          const roomsList = Array.isArray(roomsRes.value) ? roomsRes.value : (Array.isArray(roomsRes.value?.data) ? roomsRes.value.data : []);
          if (roomsList.length > 0 || Array.isArray(roomsRes.value)) set({ rooms: roomsList });
        }
        if (boardsRes.status === 'fulfilled') {
          const boardsList = Array.isArray(boardsRes.value) ? boardsRes.value : (Array.isArray(boardsRes.value?.data) ? boardsRes.value.data : []);
          if (boardsList.length > 0) {
            const statusMap: Record<string, boolean> = {};
            boardsList.forEach((b: any) => { statusMap[b.id] = b.status === 'online'; });
            set({ boardStatus: statusMap });
          }
        }
        if (brandingRes.status === 'fulfilled' && brandingRes.value) {
          const b = brandingRes.value;
          set({
            branding: {
              platformName: b.platformName || 'MOSA Smart Platform',
              logoUrl: b.logoUrl || '',
              loginBgUrl: b.loginBgUrl || '',
              colorPrimary: b.colorPrimary || '#3b82f6'
            }
          });
          const userSavedAccent = typeof window !== 'undefined' ? localStorage.getItem('accentColor') : null;
          if (!userSavedAccent && b.colorPrimary && typeof document !== 'undefined') {
            const root = document.documentElement;
            root.style.setProperty('--primary', b.colorPrimary);
            root.style.setProperty('--color-primary', b.colorPrimary);
            root.style.setProperty('--primary-glow', b.colorPrimary + '80');
          }
        }
      }).catch(console.error);
    };

    // Load initial data immediately via HTTP without waiting for WebSocket connect
    fetchInitialData();

    // Fetch active user profile from /api/auth/me to keep user state synced
    fetchAuth('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(userData => {
        if (userData && userData.id) {
          set({ user: userData });
          if (userData.homeId) {
            newSocket.emit('join_home', userData.homeId);
          }
        }
      })
      .catch(console.error);

    newSocket.on('connect', () => {
      set({ isConnected: true, socket: newSocket });

      const user = get().user;
      if (user && user.homeId) {
        newSocket.emit('join_home', user.homeId);
      }

      fetchInitialData();
    });

    newSocket.on('reconnect', () => {
      set({ isConnected: true });
      const user = get().user;
      if (user && user.homeId) {
        newSocket.emit('join_home', user.homeId);
      }
      get().refreshStateSilently();
    });

    newSocket.on('disconnect', () => {
      set({ isConnected: false });
    });

    // Realtime Activity Logs & Notifications feed over Socket.io
    newSocket.on('activity_log', (logEntry: any) => {
      set(state => ({
        activityLogs: [logEntry, ...state.activityLogs].slice(0, 500)
      }));
    });

    newSocket.on('notification', (logEntry: any) => {
      if (logEntry && (logEntry.message || logEntry.details || logEntry.title || logEntry.action)) {
        const notif = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          message: logEntry.message || logEntry.action || logEntry.title,
          details: logEntry.details,
          type: logEntry.type || 'SYSTEM',
          timestamp: logEntry.timestamp || new Date().toISOString()
        };
        set(state => ({
          activityLogs: [notif, ...state.activityLogs].slice(0, 500)
        }));
      }
    });

    newSocket.on('device_discovered', (dev: any) => {
      const newNotif = {
        id: `dev_${Date.now()}`,
        message: `تم اكتشاف جهاز ذكي جديد بالشبكة: ${dev.name || dev.ip || 'ESP32'} ⚡`,
        type: 'DEVICE',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      set(state => ({
        activityLogs: [newNotif, ...state.activityLogs].slice(0, 500)
      }));
    });

    newSocket.on('board_status_change', ({ boardId, online }: any) => {
      const newNotif = {
        id: `board_${Date.now()}`,
        message: `لوحة التحكم [${boardId}] أصبحت ${online ? 'متصلة بالشبكة 🟢' : 'غير متصلة 🔴'}`,
        type: online ? 'SUCCESS' : 'ALERT',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      set(state => ({
        activityLogs: [newNotif, ...state.activityLogs].slice(0, 500)
      }));
    });



    // Realtime Instant Devices Update over Socket.io (Zero Latency on Physical Switch Toggle)
    newSocket.on('devices_updated', (updatedDevices: any[]) => {
      if (Array.isArray(updatedDevices)) {
        set(state => ({
          devices: state.devices.map(currentDev => {
            if (toggleTimeouts[String(currentDev.id)]) {
              return currentDev;
            }
            const incoming = updatedDevices.find(u => String(u.id) === String(currentDev.id));
            if (incoming) {
              return { ...currentDev, ...incoming, state: incoming.state, currentState: incoming.state };
            }
            return currentDev;
          })
        }));
      }
    });

    // Realtime Single Device State Update (Strict Device & Board ID Isolation + Optimistic Lock Protection)
    newSocket.on('device_state', (payload: any) => {
      if (!payload) return;
      const targetId = payload.id ? String(payload.id) : (payload.deviceId ? String(payload.deviceId) : null);
      const targetPin = payload.pin !== undefined ? Number(payload.pin) : undefined;
      const targetBoardId = payload.boardId || payload.nodeId;
      const newStateStr = payload.state === 'ON' || payload.state === true || payload.isOn === true ? 'ON' : 'OFF';

      set(state => ({
        devices: state.devices.map(d => {
          const devIdStr = String(d.id);
          if (toggleTimeouts[devIdStr]) return d;

          // 1. Strict ID match
          if (targetId && (devIdStr === targetId || devIdStr === `dev-${targetId}`)) {
            return { ...d, state: newStateStr, currentState: newStateStr };
          }
          // 2. Strict Board + Pin match (with MAC / Node ID normalization)
          if (targetBoardId && targetPin !== undefined) {
            const dBoard = (d as any).boardId || (d as any).nodeId || (d as any).node?.id || (d as any).node?.mac || '';
            const cleanD = String(dBoard).replace(/[:_\-]/g, '').toLowerCase();
            const cleanT = String(targetBoardId).replace(/[:_\-]/g, '').toLowerCase();
            if (cleanD.length > 0 && cleanT.length > 0 && (cleanD.includes(cleanT) || cleanT.includes(cleanD))) {
              if (d.pin === targetPin || (d as any).pinNumber === targetPin) {
                return { ...d, state: newStateStr, currentState: newStateStr };
              }
            }
          }
          return d;
        })
      }));
    });

    newSocket.on('device_state_changed', (data: any) => {
      if (!data || !data.id) return;
      const targetId = String(data.id);
      const isOn = data.state?.isOn ?? data.isOn ?? (data.state === 'ON');
      const newStateStr = isOn ? 'ON' : 'OFF';
      set(state => ({
        devices: state.devices.map(d => {
          if (String(d.id) === targetId) {
            if (toggleTimeouts[targetId]) return d;
            return { ...d, state: newStateStr, currentState: newStateStr };
          }
          return d;
        })
      }));
    });

    // Realtime Board Status & Telemetry Updates
    newSocket.on('board_status_change', ({ boardId, online }: { boardId: string, online: boolean }) => {
      set(state => ({
        boardStatus: { ...state.boardStatus, [boardId]: online }
      }));
    });

    newSocket.on('controller:status', ({ id, status }: { id: string, status: string }) => {
      set(state => ({
        boardStatus: { ...state.boardStatus, [id]: status === 'online' }
      }));
    });

    newSocket.on('telemetry_update', (telemetry: any) => {
      if (telemetry) {
        set(state => ({
          globalData: {
            ...state.globalData,
            currentTemp: telemetry.currentTemp ?? state.globalData.currentTemp,
            currentHum: telemetry.currentHum ?? state.globalData.currentHum,
            currentPower: telemetry.currentPower ?? state.globalData.currentPower,
            totalKWh: telemetry.totalKWh ?? state.globalData.totalKWh
          }
        }));
      }
    });

    const { offlineQueue } = get();
    if (offlineQueue && offlineQueue.length > 0) {
      (async () => {
        for (const item of offlineQueue) {
          await fetchAuth(`/api/devices/${item.id}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: item.newState })
          }).catch(console.error);
        }
      })();
      set({ offlineQueue: [] });
    }
  },

  setUser: (user) => {
    set({ user });
    if (user?.home?.energyBudgetKwh) {
      localStorage.setItem('energyBudget', String(user.home.energyBudgetKwh));
      set({ energyBudget: user.home.energyBudgetKwh });
    }
    const role = (user?.role || '').toUpperCase();
    const isOwnerOrAdmin = role === 'SUPER_OWNER' || role === 'ADMIN' || role === 'OWNER';
    if (isOwnerOrAdmin && typeof window !== 'undefined' && !localStorage.getItem('mosa_ui_mode')) {
      localStorage.setItem('mosa_ui_mode', 'full');
      set({ uiMode: 'full' });
    }
  },

  refreshStateSilently: async () => {
    try {
      const [devicesRes, boardsRes, logsRes] = await Promise.allSettled([
        fetchAuth(`/api/devices`).then(r => r.json()),
        fetchAuth(`/api/controllers`).then(r => r.json()),
        fetchAuth(`/api/logs`).then(r => r.json())
      ]);

      if (devicesRes.status === 'fulfilled') {
        const rawList = Array.isArray(devicesRes.value) ? devicesRes.value : (Array.isArray(devicesRes.value?.data) ? devicesRes.value.data : []);
        set(state => ({
          devices: rawList.map((uDev: any) => {
            if (toggleTimeouts[uDev.id]) {
              const currentLocal = state.devices.find(d => String(d.id) === String(uDev.id));
              if (currentLocal) {
                return { ...uDev, state: currentLocal.state, currentState: currentLocal.state };
              }
            }
            return uDev;
          })
        }));
      }
      if (boardsRes.status === 'fulfilled' && Array.isArray(boardsRes.value)) {
        const boardsObj: Record<string, BoardConfig> = {};
        boardsRes.value.forEach((b: any) => boardsObj[b.id] = b);
        set({ boards: boardsObj });
      }
      if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value)) {
        set({ activityLogs: logsRes.value });
      }
    } catch (e) {
      // Silent catch
    }
  },

  setIsConnected: (status) => set({ isConnected: status }),
  setIsAuthenticated: (status) => set({ isAuthenticated: status }),

  setWsPassword: (password) => {
    localStorage.setItem('ws_password', password);
    set({ wsPassword: password });
  },

  addOrUpdateBoard: async (boardId, ip = '', name) => {
    await fetchAuth(`/api/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: boardId, name: name || boardId, ip })
    }).catch(console.error);
  },

  removeBoard: async (boardId) => {
    await fetchAuth(`/api/boards/${boardId}`, { method: 'DELETE' }).catch(console.error);
  },

  updateDeviceOrder: async (items) => {
    set(state => {
      const newDevices = [...state.devices];
      items.forEach(item => {
        const d = newDevices.find(dev => dev.id === item.id && dev.boardId === item.boardId);
        if (d) (d as any).orderIndex = item.orderIndex;
      });
      return { devices: newDevices.sort((a, b) => ((a as any).orderIndex || 0) - ((b as any).orderIndex || 0)) };
    });

    await fetchAuth(`/api/devices/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    }).catch(console.error);
  },

  addAutomationRule: async (rule) => {
    await fetchAuth(`/api/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    }).catch(console.error);
  },

  updateAutomationRule: async (id, updatedFields) => {
    const currentRule = get().automationRules.find(r => r.id === id);
    if (!currentRule) return;
    const rule = { ...currentRule, ...updatedFields };
    await fetchAuth(`/api/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    }).catch(console.error);
  },

  removeAutomationRule: async (id) => {
    await fetchAuth(`/api/automations/${id}`, { method: 'DELETE' }).catch(console.error);
  },

  toggleAutomationRule: async (id) => {
    const currentRule = get().automationRules.find(r => r.id === id);
    if (!currentRule) return;
    
    // Optimistic UI update
    set(state => ({
      automationRules: state.automationRules.map(r => 
        r.id === id ? { ...r, isActive: !r.isActive } : r
      )
    }));
    
    const res = await fetchAuth(`/api/automations/${id}/toggle`, {
      method: 'POST',
    }).catch(console.error);
    
    if (!res || !res.ok) {
      // Revert on failure
      set(state => ({
        automationRules: state.automationRules.map(r => 
          r.id === id ? { ...r, isActive: currentRule.isActive } : r
        )
      }));
    }
  },

  setMotionAlert: (status) => set({ motionAlert: status }),
  setDiscoveryAlert: (alert) => set({ discoveryAlert: alert }),

  clearActivityLogs: async () => {
    await fetchAuth(`/api/logs`, { method: 'DELETE' }).catch(console.error);
  },

  markNotificationsRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true }))
    }));
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
  },

  updateDeviceState: (id: string, state: string) => {
    set((stateStore) => ({
      devices: stateStore.devices.map(d => 
        String(d.id) === String(id) ? { ...d, state: state === 'ON' ? 'ON' : 'OFF' } : d
      )
    }));
  },

  toggleDevice: async (id: string) => {
    const { devices } = get();
    const device = devices.find(d => String(d.id) === String(id));
    if (!device) return;

    // Clear any active timeout for this device to prevent race conditions on rapid clicking!
    if (toggleTimeouts[id]) {
      clearTimeout(toggleTimeouts[id]);
      delete toggleTimeouts[id];
    }

    const isCurrentlyOn = device.state === 'ON';
    const newState = isCurrentlyOn ? 'OFF' : 'ON';

    // 1. Optimistic UI Update - Instant feedback on UI!
    set((stateStore) => ({
      devices: stateStore.devices.map(d => 
        String(d.id) === String(id) ? { ...d, state: newState } : d
      )
    }));

    // 2. Fallback timeout revert (4 seconds)
    toggleTimeouts[id] = setTimeout(() => {
      delete toggleTimeouts[id];
    }, 4000);

    // 3. Send API Request
    try {
      const res = await fetchAuth(`/api/devices/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState })
      });
      
      if (!res.ok) throw new Error('API failed');
      // Keep optimistic lock active for 1.2s so delayed/stale socket broadcasts don't override the clicked state!
      setTimeout(() => {
        if (toggleTimeouts[id]) {
          delete toggleTimeouts[id];
        }
      }, 1200);
    } catch (e) {
      if (toggleTimeouts[id]) {
        clearTimeout(toggleTimeouts[id]);
        delete toggleTimeouts[id];
      }
      // Revert immediately on network error
      set((stateStore) => ({
        devices: stateStore.devices.map(d => 
          String(d.id) === String(id) ? { ...d, state: isCurrentlyOn ? 'ON' : 'OFF' } : d
        )
      }));
    }
  },

  toggleEdgeMode: () => {
    set(state => {
      const newMode = !state.isEdgeMode;
      if (typeof window !== 'undefined') localStorage.setItem('isEdgeMode', String(newMode));
      return { isEdgeMode: newMode };
    });
  },

  addActivityLog: (message: string) => {
    set((s) => ({
      activityLogs: [
        { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), message },
        ...s.activityLogs
      ].slice(0, 500)
    }));
  },
  
  clearPowerHistory: () => {
    set({ powerHistory: [] });
  },
  
  setPerformanceMode: (mode: 'normal' | 'eco') => {
    set({ performanceMode: mode });
  }
}),
{
  name: 'mosa-smarthome-storage',
  storage: createJSONStorage(() => typeof window !== 'undefined' ? window.localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} }),
  partialize: (state) => ({ 
    favoriteDeviceIds: state.favoriteDeviceIds, 
    energyBudget: state.energyBudget,
    isEdgeMode: state.isEdgeMode,
    user: state.user ? {
      id: state.user.id,
      username: state.user.username,
      name: state.user.name,
      role: state.user.role,
      homeId: state.user.homeId,
      home: state.user.home
    } : null,
    isAuthenticated: state.isAuthenticated,
    branding: state.branding,
    devices: state.devices,
    rooms: state.rooms,
    activityLogs: state.activityLogs,
    automationRules: state.automationRules,
    performanceMode: state.performanceMode
  }),
}
));

export const getSocket = () => useSmartHomeStore.getState().socket;
