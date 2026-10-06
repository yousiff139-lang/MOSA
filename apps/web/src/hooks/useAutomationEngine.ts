"use client";
/* eslint-disable */
// @ts-nocheck

import { useEffect } from 'react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

export function useAutomationEngine(sendCommand: (boardId: string, payload: any) => void) {
  useEffect(() => {
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

          if (rule.triggerSensorType === 'temperature') sensorValue = globalData.currentTemp;
          if (rule.triggerSensorType === 'humidity') sensorValue = globalData.currentHum;
          if (rule.triggerSensorType === 'power') sensorValue = globalData.currentPower;
          if ((rule.triggerSensorType as any) === 'motion') sensorValue = state.motionAlert;

          if (sensorValue !== undefined && rule.triggerCondition && rule.triggerValue !== undefined) {
             if (rule.triggerCondition === '>') shouldTrigger = (sensorValue as any) > rule.triggerValue;
             if (rule.triggerCondition === '<') shouldTrigger = (sensorValue as any) < rule.triggerValue;
             if (rule.triggerCondition === '==') shouldTrigger = sensorValue === rule.triggerValue;
          }
        }

        if (shouldTrigger) {
          const targetDevice = devices.find(d => d.id === rule.actionDeviceId && d.boardId === rule.actionBoardId);
          if (targetDevice && targetDevice.state !== rule.actionState) {
             sendCommand(rule.actionBoardId, { type: "toggle", id: targetDevice.id });
             
             if (state.updateDeviceState) state.updateDeviceState(String(targetDevice.id), String(rule.actionState));
             if (state.addActivityLog) state.addActivityLog(`تم تنفيذ قاعدة الأتمتة: ${rule.name}`);
          }
        }
      });
    }, 30000); 

    return () => clearInterval(interval);
  }, [sendCommand]);
}
