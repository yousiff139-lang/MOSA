import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';
import { useDeviceStore } from '../store/device.store';
import { useSensorStore } from '../store/sensor.store';
import { SocketEvents } from '../types';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const token = useAuthStore((state) => state.accessToken);
  const updateDeviceState = useDeviceStore((state) => state.updateDeviceState);
  const setMqttStatus = useDeviceStore((state) => state.setMqttStatus);
  const setTemperature = useSensorStore((state) => state.setTemperature);
  const setLastMotion = useSensorStore((state) => state.setLastMotion);

  useEffect(() => {
    if (!token) return;

    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
      auth: { token },
    });

    const socket = socketRef.current;

    socket.on('device:state', (data: SocketEvents['device:state']) => {
      updateDeviceState(data.deviceId, data.state);
    });

    socket.on('sensor:temperature', (data: SocketEvents['sensor:temperature']) => {
      setTemperature(data.value);
    });

    socket.on('sensor:motion', (data: SocketEvents['sensor:motion']) => {
      if (data.detected) setLastMotion(data.timestamp);
    });

    socket.on('controller:status', (data: SocketEvents['controller:status']) => {
      console.log(`[Controller] ${data.controllerId} is ${data.status}`);
    });

    socket.on('mqtt:status', (data: SocketEvents['mqtt:status']) => {
      setMqttStatus(data.connected);
    });

    socket.on('scene:executed', (data: any) => {
      // In absence of toast library, we use native alert or standard console/custom UI
      alert(`تم تنفيذ: ${data.sceneName}`);
    });

    socket.on('ota:update', (data: any) => {
      const msg = data.status === 'SUCCESS' ? 'تم تحديث المتحكم بنجاح' : 'فشل تحديث المتحكم';
      alert(msg);
      // We could use window.dispatchEvent to notify local components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ota:status', { detail: data }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, updateDeviceState, setTemperature, setLastMotion, setMqttStatus]);

  const toggleDevice = (deviceId: string, mqttTopic: string, state: 'ON' | 'OFF') => {
    if (socketRef.current) {
      // 1. Publish command but DO NOT optimistic update
      socketRef.current.emit('device:toggle', { deviceId, mqttTopic, state });
      
      // We can set it to a pending state if the store supported it,
      // but for now we wait for 'device:state' from the server to update the UI.

      // 2. Set a 5-second timeout
      const timeoutId = setTimeout(() => {
        // If state hasn't changed to the expected state after 5 seconds
        const currentDevices = useDeviceStore.getState().devices;
        const targetDevice = currentDevices.find(d => d.id === deviceId);
        
        // Assuming current state in store
        const currentState = targetDevice?.currentState;
        
        if (currentState !== state) {
          alert('لم يستجب الجهاز، تحقق من الاتصال');
          // Revert toggle to previous state happens automatically since we didn't optimistic update,
          // but we can enforce a store refresh if needed.
        }
      }, 5000);
      
      // Note: We need to clear this timeout if the state updates successfully.
      // A full implementation would track pending toggles in state and clear on success.
    }
  };

  return { toggleDevice };
};
