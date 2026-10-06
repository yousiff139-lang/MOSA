"use client";
import React, { useEffect, useState } from 'react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { Cpu, X, Plus } from 'lucide-react';
export function SmartPairingPopup({ onPair }: { onPair: () => void }) {
  const discoveryAlert = useSmartHomeStore(state => state.discoveryAlert);
  const dismissDiscoveryAlert = useSmartHomeStore(state => state.dismissDiscoveryAlert);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (discoveryAlert) {
      // Auto-hide after 15 seconds if ignored
      const timer = setTimeout(() => {
        dismissDiscoveryAlert(discoveryAlert.name || discoveryAlert.boardId);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [discoveryAlert, dismissDiscoveryAlert]);

  if (!isMounted || !discoveryAlert) return null;

  const handleDismiss = () => {
    dismissDiscoveryAlert(discoveryAlert.name || discoveryAlert.boardId);
  };

  const handlePair = () => {
    dismissDiscoveryAlert(discoveryAlert.name || discoveryAlert.boardId);
    onPair();
  };

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 animate-fade-up" style={{ animationDuration: '0.4s' }}>
      <div className="glass-panel w-full max-w-sm rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 backdrop-blur-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-primary/30 rounded-full blur-3xl pointer-events-none"></div>
        
        <button 
          onClick={handleDismiss}
          className="absolute top-3 left-3 p-2 bg-black/10 dark:bg-white/10 rounded-full hover:bg-black/20 dark:hover:bg-white/20 transition-colors z-20"
        >
          <X size={16} className="text-gray-600 dark:text-gray-300" />
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-4 border border-white/10 shadow-inner relative">
            <Cpu size={40} className="text-primary drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
            <div className="absolute inset-0 rounded-full border-2 border-primary/50 animate-ping" style={{ animationDuration: '2s' }}></div>
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">لوحة جديدة مكتشفة</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 px-4">
            تم التعرف على اللوحة <span className="font-bold text-primary">{discoveryAlert.name}</span> في شبكتك. هل تود إعداد الأجهزة المتصلة بها الآن؟
          </p>

          <button 
            onClick={handlePair}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
          >
            إعداد اللوحة <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
