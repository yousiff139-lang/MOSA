// src/hooks/useSmartHome.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import { ESP32State } from '../types/esp32';

// 🔴 ضع هنا IP اللوحة الخاص بك (أو MosaNode_XXXX.local)
const ESP_IP = '192.168.1.100';
const WS_PASSWORD = 'admin';
const API_KEY = 'changeme123'; // نفس الـ API Key الموجود في الكود C++

export const useSmartHome = () => {
    const [state, setState] = useState<ESP32State | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const ws = useRef<WebSocket | null>(null);

    // 1. الاتصال بالـ WebSocket وتلقي البيانات اللحظية
    useEffect(() => {
        const connectWS = () => {
            ws.current = new WebSocket(`ws://${ESP_IP}:82`);

            ws.current.onopen = () => {
                setIsConnected(true);
                // إرسال كود المصادقة فور فتح الاتصال
                ws.current?.send(JSON.stringify({ type: 'auth', password: WS_PASSWORD }));
            };

            ws.current.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'auth_success') {
                    setIsAuthenticated(true);
                } else if (data.type === 'auth_error') {
                    console.error('WebSocket Auth Failed!');
                    setIsAuthenticated(false);
                } else if (data.type === 'state') {
                    // تحديث حالة الأجهزة والحساسات في الواجهة
                    setState(data);
                } else if (data.type === 'alarm') {
                    alert('⚠️ تحذير: ' + data.message); // حساس الحركة (PIR)
                }
            };

            ws.current.onclose = () => {
                setIsConnected(false);
                setIsAuthenticated(false);
                // إعادة الاتصال التلقائي بعد ثانيتين إذا انقطع
                setTimeout(connectWS, 2000);
            };
        };

        connectWS();

        return () => {
            ws.current?.close();
        };
    }, []);

    // 2. إرسال أوامر التحكم السريعة عبر WebSocket
    const toggleDevice = useCallback((id: number) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'toggle', id }));
        }
    }, []);

    // 3. إضافة جهاز جديد (عبر HTTP API مع الحماية)
    const addDevice = async (name: string, room: string, type: string, pin: number, inPin?: number) => {
        try {
            let url = `http://${ESP_IP}/api/add?name=${encodeURIComponent(name)}&room=${encodeURIComponent(room)}&type=${type}&pin=${pin}`;
            if (inPin !== undefined) url += `&inpin=${inPin}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-API-Key': API_KEY // 🔴 الترويسة الأمنية التي أضفناها للكود
                }
            });
            const result = await response.json();
            return result.status === 'ok';
        } catch (error) {
            console.error('Error adding device:', error);
            return false;
        }
    };

    return {
        state,
        isConnected,
        isAuthenticated,
        toggleDevice,
        addDevice,
    };
};