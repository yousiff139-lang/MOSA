'use client';

import React, { useEffect, useState } from 'react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import io from 'socket.io-client';
import { Plus, X, Server } from 'lucide-react';
import { AnimatedButton } from '@/components/ui/AnimatedButton';

interface DiscoveredDevice {
  name: string;
  type: string;
  discoveredAt: number;
}

export function DiscoveryPopup() {
  const [device, setDevice] = useState<DiscoveredDevice | null>(null);
  const user = useSmartHomeStore(state => state.user);

  useEffect(() => {
    if (!user?.activeHomeId) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';
    const socket = io(socketUrl, {
      path: '/socket.io/',
      transports: ['websocket'],
      withCredentials: true
    });

    socket.on('device_discovered', (data: DiscoveredDevice) => {
      // Don't override if already showing one
      setDevice(prev => prev ? prev : data);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  if (!device) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className="bg-blue-900/40 backdrop-blur-xl border border-blue-500/50 p-6 rounded-2xl shadow-[0_10px_40px_rgba(59,130,246,0.3)] w-80 relative overflow-hidden">
        {/* Radar Ping Animation */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl animate-pulse" />
        
        <button 
          onClick={() => setDevice(null)}
          className="absolute top-4 left-4 text-gray-400 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-4 mb-4 relative z-10">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-50" />
            <Server className="text-blue-400" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">جهاز جديد متاح!</h4>
            <p className="text-xs text-blue-200">الرادار اكتشف جهازاً قريباً</p>
          </div>
        </div>

        <div className="bg-black/30 p-3 rounded-xl mb-4 border border-white/5 relative z-10">
          <p className="text-white font-mono text-sm mb-1">{device.name}</p>
          <p className="text-gray-400 text-xs">{device.type}</p>
        </div>

        <AnimatedButton 
          variant="primary" 
          className="w-full flex justify-center py-2.5 bg-blue-600 hover:bg-blue-500 text-sm font-bold relative z-10"
          onClick={() => {
            alert(`تم إضافة ${device.name} بنجاح!`);
            setDevice(null);
          }}
        >
          <Plus size={16} className="mr-2" />
          إضافة الجهاز فوراً
        </AnimatedButton>
      </div>
    </div>
  );
}
