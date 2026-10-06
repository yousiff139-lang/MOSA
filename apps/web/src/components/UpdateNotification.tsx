'use client';

import { useEffect, useState } from 'react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';

interface UpdateInfo {
  currentVersion: string;
  newVersion: string;
  changelog: { ar: string[]; en: string[] };
  size: number;
  estimatedTime: number;
}

export function UpdateNotification() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [updateState, setUpdateState] = useState<string>('idle');
  const [progress, setProgress] = useState(0);
  const socket = useSmartHomeStore((state) => state.socket);
  const lang = useRuntimeStore((state) => state.lang);
  const isEn = lang === 'en';

  useEffect(() => {
    if (!socket) return;
    
    socket.on('update_available', (data: UpdateInfo) => {
      setUpdate(data);
    });
    
    socket.on('update_started', () => {
      setUpdateState('updating');
      setProgress(10);
    });
    
    socket.on('update_progress', (data: { percent: number }) => {
      setProgress(data.percent);
    });
    
    socket.on('update_complete', () => {
      setUpdateState('complete');
      setTimeout(() => window.location.reload(), 3000);
    });
    
    socket.on('update_rolled_back', () => {
      setUpdateState('failed');
      setTimeout(() => setUpdateState('idle'), 5000);
    });
    
    return () => {
      socket.off('update_available');
      socket.off('update_started');
      socket.off('update_progress');
      socket.off('update_complete');
      socket.off('update_rolled_back');
    };
  }, []);
  
  if (!update && updateState === 'idle') return null;
  
  if (updateState === 'updating') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center">
        <div className="text-center max-w-sm p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
          <div className="text-6xl mb-4 animate-bounce">⚡</div>
          <h2 className="text-2xl font-bold mb-2 text-white">
            {isEn ? 'Updating MOSA OS System...' : 'جاري تحديث نظام MOSA...'}
          </h2>
          <p className="text-slate-400 mb-6">
            {isEn ? 'Please do not close this window or disconnect power.' : 'يرجى عدم إغلاق الصفحة أو فصل الطاقة عن لوحة التحكم'}
          </p>
          
          <div className="w-full bg-slate-800 rounded-full h-3 mb-4 overflow-hidden">
            <div 
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm font-semibold text-blue-400">
            {progress}% {isEn ? 'Completed' : 'مكتمل'}
          </p>
        </div>
      </div>
    );
  }
  
  if (updateState === 'complete') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center">
        <div className="text-center max-w-sm p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2 text-green-400">
            {isEn ? 'Update Installed Successfully!' : 'اكتمل التحديث بنجاح!'}
          </h2>
          <p className="text-slate-300">
            {isEn ? 'Rebooting MOSA Platform...' : 'جاري إعادة تشغيل منصة MOSA...'}
          </p>
        </div>
      </div>
    );
  }
  
  if (!update) return null;

  const changelogList = isEn ? (update.changelog.en || update.changelog.ar) : (update.changelog.ar || update.changelog.en);
  
  return (
    <div className={`fixed bottom-20 ${isEn ? 'left-4 md:left-6' : 'right-4 md:right-6'} md:bottom-6 z-40 max-w-sm bg-slate-900/95 backdrop-blur-lg border border-slate-800 rounded-2xl p-6 shadow-2xl animate-fade-in text-slate-200`} dir={isEn ? 'ltr' : 'rtl'}>
      <div className="flex items-start gap-4 mb-4">
        <div className="text-4xl">🚀</div>
        <div>
          <h3 className="font-bold text-lg text-white">
            {isEn ? 'MOSA OS Update Available' : 'تحديث نظام MOSA متاح'}
          </h3>
          <p className="text-sm text-slate-400">
            v{update.currentVersion} → v{update.newVersion}
          </p>
        </div>
      </div>
      
      {/* Changelog */}
      <div className="mb-4 space-y-2 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
        {changelogList.map((item, i) => (
          <div key={i} className="text-sm text-slate-300 flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
      
      <div className="text-xs text-slate-500 mb-6 flex justify-between">
        <span>{isEn ? 'Size' : 'الحجم'}: {(update.size / 1024 / 1024).toFixed(1)} MB</span>
        <span>{isEn ? 'Est. Time' : 'الوقت المتوقع'}: {update.estimatedTime}s</span>
      </div>
      
      <div className="flex gap-3">
        <button
          onClick={() => setUpdate(null)}
          className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-755 transition-colors text-sm text-slate-300 font-medium"
        >
          {isEn ? 'Later' : 'لاحقاً'}
        </button>
        <button
          onClick={() => {
            setUpdateState('updating');
            fetch('/api/system/apply', { method: 'POST' }).catch(err => console.error(err));
          }}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-500/20"
        >
        </button>
      </div>
    </div>
  );
}
export default UpdateNotification;
