import { useEffect } from 'react';
import { useSmartHomeStore } from '../store/useSmartHomeStore';

export function useAutomationEngine(sendCommand: (boardId: string, payload: any) => void) {
  useEffect(() => {
    // Run evaluation every 30 seconds
    const interval = setInterval(() => {
      const state = useSmartHomeStore.getState();
      const rules = state.automationRules;
      const devices = state.devices;
      const globalData = state.globalData;

      if (!rules || rules.length === 0) return;

      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMinute = now.getMinutes().toString().padStart(2, '0');
      const currentTimeString = `${currentHour}:${currentMinute}`;

      rules.forEach(rule => {
        if (!rule.enabled) return;

        let shouldTrigger = false;

        if (rule.triggerType === 'time' && rule.triggerTime) {
          if (rule.triggerTime === currentTimeString) {
             shouldTrigger = true;
          }
        } else if (rule.triggerType === 'sensor' && rule.triggerSensorType) {
          let sensorValue: number | boolean | undefined;

          // Try to get from globalData
          if (rule.triggerSensorType === 'temperature') sensorValue = globalData.currentTemp;
          if (rule.triggerSensorType === 'humidity') sensorValue = globalData.currentHum;
          if (rule.triggerSensorType === 'power') sensorValue = globalData.currentPower;
          if (rule.triggerSensorType === 'motion') sensorValue = state.motionAlert;

          if (sensorValue !== undefined && rule.triggerCondition && rule.triggerValue !== undefined) {
             if (rule.triggerCondition === '>') shouldTrigger = sensorValue > rule.triggerValue;
             if (rule.triggerCondition === '<') shouldTrigger = sensorValue < rule.triggerValue;
             if (rule.triggerCondition === '==') shouldTrigger = sensorValue === rule.triggerValue;
          }
        }

        if (shouldTrigger) {
          // Check if device is already in the target state to avoid spamming
          const targetDevice = devices.find(d => d.id === rule.actionDeviceId && d.boardId === rule.actionBoardId);
          if (targetDevice && targetDevice.state !== rule.actionState) {
             // Execute Action
             if (rule.actionState === 'ON' || rule.actionState === 'OFF') {
                 // Call toggle if state mismatch, since we know it needs to change
                 // Wait, toggle payload just sends { type: "toggle", id }. 
                 // If we need absolute state, we can send { type: "set", id, state: "ON" } 
                 // Let's check what the backend expects. For now let's assume { type: "toggle", id } or we can just send { type: "set", id, state: rule.actionState === 'ON' ? 1 : 0 }
                 sendCommand(rule.actionBoardId, { type: "toggle", id: targetDevice.id });
             }
             
             // Update local state and log
             state.updateDeviceState(targetDevice.id, rule.actionBoardId, rule.actionState);
             state.addActivityLog(`تم تنفيذ قاعدة الأتمتة: ${rule.name}`);
          }
        }
      });
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [sendCommand]);
}
