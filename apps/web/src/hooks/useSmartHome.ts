"use client";
/* eslint-disable */
// @ts-nocheck

import { useEffect, useCallback, useRef } from 'react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { playClickSound, playHapticFeedback } from '@/utils/audio';

export function useSmartHome() {
  const store = useSmartHomeStore();
  
  // initBackendConnection is now called globally by SocketManager


  const sendCommand = useCallback(async (boardId: string, payload: object) => {
    try {
      await fetchAuth('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, payload })
      });
    } catch (err) {
      console.error("Failed to send command to backend", err);
    }
  }, []);

  const lastToggleTime = useRef<Record<string, number>>({});

  const toggle = useCallback((id: number, boardId: string, force?: boolean) => {
    // Hardware Debounce: Prevent toggling the same device more than once per 500ms
    const deviceKey = `${boardId}-${id}`;
    const now = Date.now();
    if (lastToggleTime.current[deviceKey] && now - lastToggleTime.current[deviceKey] < 500) {
      console.warn(`Toggle debounced for ${deviceKey}`);
      return;
    }
    lastToggleTime.current[deviceKey] = now;

    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    const hapticsEnabled = localStorage.getItem('hapticsEnabled') !== 'false';
    playClickSound(soundEnabled);
    playHapticFeedback(hapticsEnabled);

    const currentState = useSmartHomeStore.getState();
    const device = currentState.devices.find(d => d.id === id && d.boardId === boardId);
    if (device) {
      const isCurrentlyOn = device.state === 'ON' || (device.state as any) === true || (device.state as any) === 1;
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
      if(((d.state as any) === 'ON' || (d.state as any) === 1) && d.boardId) toggle(d.id, d.boardId);
    });
  }, [store.devices, toggle]);

  const executeScene = useCallback(async (sceneType: string, customDevices?: any[], sceneId?: string) => {
    if (sceneType === 'all_off') {
       turnOffAll();
    } else if (sceneType === 'all_on') {
       store.devices.forEach(d => { if(((d.state as any) === 'OFF' || (d.state as any) === 0) && d.boardId) toggle(d.id, d.boardId); });
    } else if (sceneType === 'custom' && sceneId) {
       try {
         await fetchAuth(`/api/scenes/${sceneId}/execute`, { method: 'POST' });
       } catch(e) {
         console.error('Failed to execute scene via backend', e);
       }
    } else if (sceneType === 'custom' && customDevices) {
       // Fallback
       customDevices.forEach(sceneDev => {
         const d = store.devices.find(x => x.id === sceneDev.id && x.boardId === sceneDev.boardId);
         if (d && d.boardId) {
            const isCurrentlyOn = (d.state as any) === 'ON' || (d.state as any) === 1;
            if ((isCurrentlyOn && !sceneDev.state) || (!isCurrentlyOn && sceneDev.state)) {
               toggle(d.id, d.boardId);
            }
         }
       });
    }
  }, [store.devices, turnOffAll, toggle]);

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
      await fetchAuth(`${targetUrl}/api/add?${params.toString()}&key=changeme123`);
      const formDataObj = Object.fromEntries(formData.entries());
      await fetchAuth('/api/devices', {
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

  const deleteDevice = useCallback(async (id: number | string, boardId: string) => {
    try {
      // 1. Immediate optimistic UI update in Zustand
      useSmartHomeStore.setState(state => ({
        devices: state.devices.filter(d => String(d.id) !== String(id))
      }));

      // 2. Call backend permanent delete endpoint
      await fetchAuth(`/api/devices/${id}`, { method: 'DELETE' });

      // 3. Inform board via MQTT/WebSocket & direct HTTP if available
      const currentState = useSmartHomeStore.getState();
      const board = currentState.boards[boardId];
      if (board) {
        sendCommand(boardId, { type: "delete", id });
        if (board.ip) {
          fetchAuth(`http://${board.ip}/api/delete?id=${id}&key=changeme123`).catch(() => {});
        }
      }

      // 4. Resync backend state
      currentState.initBackendConnection();
    } catch (err) {
      console.error("Failed to delete device permanently", err);
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
      const res = await fetchAuth('/api/discovery/scan');
      const data = await res.json();
      if (data.success) {
        return data.devices;
      }
    } catch (err) {
      console.error("Failed to scan network", err);
    }
    return [];
  }, []);

  const connectWS = useCallback(() => { store.initBackendConnection(); }, [store]);

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
