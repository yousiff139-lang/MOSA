import { useEffect, useCallback } from 'react';
import { useSmartHomeStore } from '../store/useSmartHomeStore';
import { playClickSound, playHapticFeedback } from '../utils/audio';

export function useSmartHome() {
  const store = useSmartHomeStore();
  
  useEffect(() => {
    // Initialize the real-time connection to our Node.js Backend Server
    store.initBackendConnection();
  }, []); // Run once on mount

  // Unified command sender (now proxies through our Node.js backend)
  const sendCommand = useCallback(async (boardId: string, payload: object) => {
    try {
      await fetch('http://localhost:3001/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, payload })
      });
    } catch (err) {
      console.error("Failed to send command to backend", err);
    }
  }, []);

  // Actions
  const toggle = useCallback((id: number, boardId: string, force?: boolean) => {
    // Play feedback based on local storage settings to avoid context dependency in this hook
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    const hapticsEnabled = localStorage.getItem('hapticsEnabled') !== 'false';
    playClickSound(soundEnabled);
    playHapticFeedback(hapticsEnabled);

    const currentState = useSmartHomeStore.getState();
    const device = currentState.devices.find(d => d.id === id && d.boardId === boardId);
    if (device) {
      const isCurrentlyOn = device.state === 'ON' || (device.state as any) === true || (device.state as any) === 1;
      // Optimistic update for immediate UI response
      useSmartHomeStore.setState(state => ({
        devices: state.devices.map(d => 
          (d.id === id && d.boardId === boardId) 
            ? { ...d, state: isCurrentlyOn ? 'OFF' : 'ON' } 
            : d
        )
      }));
    }
    sendCommand(boardId, { type: "toggle", id, force });
  }, [sendCommand]);

  const updatePWM = useCallback((id: number, boardId: string, value: number) => {
    const hapticsEnabled = localStorage.getItem('hapticsEnabled') !== 'false';
    playHapticFeedback(hapticsEnabled);
    sendCommand(boardId, { type: "pwm", id, value });
  }, [sendCommand]);

  const updateColor = useCallback((id: number, boardId: string, color: string) => {
    sendCommand(boardId, { type: "color", id, color });
  }, [sendCommand]);

  const setTimer = useCallback((id: number, boardId: string, minutes: number) => {
    sendCommand(boardId, { type: "timer", id, minutes });
  }, [sendCommand]);

  const updateSchedule = useCallback((id: number, boardId: string, scheduleActive: boolean, scheduleHourOn: number, scheduleMinuteOn: number, scheduleHourOff: number, scheduleMinuteOff: number) => {
    sendCommand(boardId, { 
      type: "schedule", 
      id, 
      scheduleActive, 
      scheduleHourOn, 
      scheduleMinuteOn, 
      scheduleHourOff, 
      scheduleMinuteOff 
    });
  }, [sendCommand]);

  const turnOffAll = useCallback(() => {
    store.devices.forEach(d => {
      if((d.state === 'ON' || d.state === 1) && d.boardId) toggle(d.id, d.boardId);
    });
  }, [store.devices, toggle]);

  const executeScene = useCallback((sceneType: string, customDevices?: any[]) => {
    if (sceneType === 'all_off') {
       turnOffAll();
    } else if (sceneType === 'all_on') {
       store.devices.forEach(d => { if((d.state === 'OFF' || d.state === 0) && d.boardId) toggle(d.id, d.boardId); });
    } else if (sceneType === 'custom' && customDevices) {
       customDevices.forEach(sceneDev => {
         const d = store.devices.find(x => x.id === sceneDev.id && x.boardId === sceneDev.boardId);
         if (d && d.boardId) {
            const isCurrentlyOn = d.state === 'ON' || d.state === 1;
            if ((isCurrentlyOn && !sceneDev.state) || (!isCurrentlyOn && sceneDev.state)) {
               toggle(d.id, d.boardId);
            }
         }
       });
    }
  }, [store.devices, turnOffAll, toggle]);

  // Devices HTTP config update
  const addDevice = useCallback(async (boardId: string, formData: FormData) => {
    const board = store.boards[boardId];
    if (!board || !board.ip) {
      alert("يرجى التأكد من إدخال الـ IP للوحة في الإعدادات.");
      return;
    }
    const targetUrl = `http://${board.ip}`;
    
    const params = new URLSearchParams();
    formData.forEach((value, key) => params.append(key, value.toString()));

    try {
      // Add directly to ESP32 (Hardware source of truth)
      await fetch(`${targetUrl}/api/add?${params.toString()}&key=changeme123`);
      
      // Update our Backend Database
      const formDataObj = Object.fromEntries(formData.entries());
      await fetch('http://localhost:3001/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formDataObj, boardId })
      });
      
      setTimeout(() => sendCommand(boardId, { type: "refresh" }), 500);
    } catch (err) {
      console.error("Failed to add device", err);
      alert("فشل الاتصال باللوحة عبر الـ IP المدخل.");
    }
  }, [store.boards, sendCommand]);

  const deleteDevice = useCallback(async (id: number, boardId: string) => {
    const currentState = useSmartHomeStore.getState();
    const board = currentState.boards[boardId];
    if (!board) return;

    // Send via Backend MQTT Proxy
    sendCommand(boardId, { type: "delete", id });
    
    const targetUrl = board.ip ? `http://${board.ip}` : '';
    if (targetUrl) {
      try {
        await fetch(`${targetUrl}/api/delete?id=${id}&key=changeme123`);
      } catch (err) {
        console.error("Failed to delete device locally via HTTP", err);
      }
    }
  }, [sendCommand]);

  const resetSystem = useCallback((boardId?: string) => {
    if(window.confirm("تحذير: سيتم حذف جميع الأجهزة من اللوحة. هل أنت متأكد؟")) {
      if (boardId) {
        sendCommand(boardId, { type: "reset" });
      } else {
        Object.keys(store.boards).forEach(id => {
          sendCommand(id, { type: "reset" });
        });
      }
    }
  }, [sendCommand, store.boards]);

  const scanNetwork = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/discovery/scan');
      const data = await res.json();
      if (data.success) {
        return data.devices;
      }
    } catch (err) {
      console.error("Failed to scan network", err);
    }
    return [];
  }, []);

  // Keep compatibility with existing code calling connectWS
  const connectWS = useCallback(() => {}, []);

  return {
    ...store,
    connectWS,
    toggle,
    updatePWM,
    updateColor,
    setTimer,
    updateSchedule,
    executeScene,
    addDevice,
    deleteDevice,
    turnOffAll,
    resetSystem,
    scanNetwork,
    sendCommand,
    toggleFavorite: store.toggleFavorite,
    favoriteDeviceIds: store.favoriteDeviceIds
  };
}
