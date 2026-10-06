"use client";
/* eslint-disable */
// @ts-nocheck
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export function Cameras() {
  const [camIp, setCamIp] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('cam_ip') || '';
    return '';
  });
  const [tempIp, setTempIp] = useState(camIp);
  const [streamUrl, setStreamUrl] = useState(camIp ? `http://${camIp}:81/stream` : '');
  const [isError, setIsError] = useState(false);

  const saveIp = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('cam_ip', tempIp);
    setCamIp(tempIp);
    setStreamUrl(`http://${tempIp}:81/stream`);
    setIsError(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-up">
      <header className="flex justify-between items-end border-b border-gray-200 dark:border-[#1a2235] pb-6">
        <div>
           <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">كاميرات المراقبة</h2>
           <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">مراقبة مباشرة من خلال لوحة ESP32-CAM</p>
        </div>
      </header>

      <form onSubmit={saveIp} className="flex gap-4">
        <input 
          type="text" 
          value={tempIp}
          onChange={(e) => setTempIp(e.target.value)}
          placeholder="مثال: 192.168.1.109" 
          className="flex-1 p-4 bg-white dark:bg-[#101728] rounded-2xl border border-gray-200 dark:border-[#1a2235] focus:border-primary outline-none text-gray-900 dark:text-white" 
        />
        <button type="submit" className="bg-blue-600 hover:bg-primary py-4 px-6 rounded-2xl font-bold text-white flex items-center gap-2 transition-colors">
           حفظ IP
        </button>
      </form>

      <div className="bg-black/5 dark:bg-[#101728] border border-gray-200 dark:border-[#1a2235] rounded-3xl p-4 overflow-hidden relative min-h-[400px] flex items-center justify-center">
        {!camIp ? (
          <div className="text-center text-gray-500 flex flex-col items-center gap-3">
             <AlertTriangle size={48} />
             <p className="font-bold">قم بإدخال عنوان IP للكاميرا</p>
             <p className="text-sm">لم تقم بإعداد عنوان الكاميرا بعد.</p>
          </div>
        ) : isError ? (
          <div className="text-center text-red-500 flex flex-col items-center gap-3">
             <AlertTriangle size={48} />
             <p className="font-bold">تعذر الاتصال بالكاميرا</p>
             <p className="text-sm text-gray-500">تأكد من أن الـ IP صحيح وأن الكاميرا متصلة بالشبكة.</p>
          </div>
        ) : (
          <>
            <img 
              src={streamUrl} 
              alt="Live Stream" 
              className="w-full h-auto max-h-[70vh] object-contain rounded-2xl"
              onError={() => setIsError(true)}
            />
            <div className="absolute top-8 left-8 flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-white text-xs font-bold">
               <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
               مباشر
            </div>
          </>
        )}
      </div>
    </div>
  );
}
