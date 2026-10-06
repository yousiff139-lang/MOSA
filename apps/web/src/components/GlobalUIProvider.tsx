"use client";

import { useSmartHome } from '@/hooks/useSmartHome';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import dynamic from 'next/dynamic';
const VoiceControl = dynamic(() => import('@/components/VoiceControl').then(mod => mod.VoiceControl), { ssr: false });
import { AlertTriangle, X } from 'lucide-react';
import { useAutomationEngine } from '@/hooks/useAutomationEngine';

import { useRuntimeStore } from '@/store/useRuntimeStore';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function GlobalUIProvider() {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth') || pathname?.startsWith('/setup');
  const { devices, toggle, turnOffAll, motionAlert, setMotionAlert, sendCommand } = useSmartHome();
  const { lang } = useRuntimeStore();
  const [isMounted, setIsMounted] = useState(false);
  const performanceMode = useSmartHomeStore(s => s.performanceMode);
  
  // Mount the global automation engine
  useAutomationEngine(sendCommand);

  useEffect(() => {
    setIsMounted(true);
    // Ensure initial sync of document direction
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (performanceMode === 'eco') {
        document.documentElement.classList.add('performance-eco');
      } else {
        document.documentElement.classList.remove('performance-eco');
      }
    }
  }, [performanceMode]);

  if (isAuthPage) {
    return null;
  }

  return (
    <>
      {isMounted && <VoiceControl devices={devices} onToggle={toggle} onTurnOffAll={turnOffAll} />}
      
      {(isMounted && motionAlert) && (
        <div 
          onClick={() => setMotionAlert(false)}
          className="fixed top-20 sm:top-24 left-1/2 transform -translate-x-1/2 z-[100] bg-red-100 dark:bg-red-900/90 border border-red-500 text-red-700 dark:text-red-300 px-4 py-2 rounded-full shadow-lg flex items-center gap-3 animate-pulse cursor-pointer hover:scale-105 transition-transform"
        >
          <AlertTriangle size={20} className="text-red-600 dark:text-red-400 animate-bounce" />
          <span className="font-bold text-sm">إنذار اختراق! رصد حركة</span>
          <button className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded-full mr-2 transition-colors">
             <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
