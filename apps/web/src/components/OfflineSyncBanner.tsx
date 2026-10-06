'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export function OfflineSyncBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setShowRestoredNotice(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowRestoredNotice(true);
      const timer = setTimeout(() => setShowRestoredNotice(false), 5000);
      return () => clearTimeout(timer);
    };

    // Initial check
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !showRestoredNotice) return null;

  return (
    <div dir="rtl" className="fixed bottom-6 right-6 z-[9998] max-w-md w-[90%] font-sans">
      {isOffline ? (
        <div className="bg-gradient-to-r from-amber-950/90 via-amber-900/90 to-yellow-950/90 backdrop-blur-md border border-amber-500/40 rounded-2xl p-4 shadow-2xl text-white flex items-center gap-3 animate-slide-up">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 text-amber-400">
            <WifiOff className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-xs text-amber-200">الوضع المحلي (Offline Mode)</h4>
            <p className="text-[11px] text-amber-300/90 mt-0.5">
              انقطع اتصال الإنترنت. يستمر التحكم بالأجهزة محلياً، وسيتم المزامنة تلقائياً عند عودة النت.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-emerald-950/90 via-emerald-900/90 to-teal-950/90 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-4 shadow-2xl text-white flex items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 text-emerald-400">
            <Wifi className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-xs text-emerald-200">تم استعادة الاتصال بالإنترنت 🟢</h4>
            <p className="text-[11px] text-emerald-300/90 mt-0.5">
              تم تحديث ومزامنة بيانات السيرفر المركزي تلقائياً.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
