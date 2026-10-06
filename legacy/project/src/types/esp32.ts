// src/types/esp32.ts

export interface Device {
    id: number;
    name: string;
    room: string;
    type: string;
    pin: number;
    inPin: number;
    state: 'ON' | 'OFF';
    pwmValue: number;
    color: string;
    usage: number; // الاستهلاك بالثواني
    scheduleActive: boolean;
    scheduleHourOn: number;
    scheduleMinuteOn: number;
    scheduleHourOff: number;
    scheduleMinuteOff: number;
}

export interface ESP32State {
    boardId: string;
    boardName: string;
    totalKWh: number;
    currentPower: number;
    currentTemp: number;
    currentHum: number;
    devices: Device[];
}