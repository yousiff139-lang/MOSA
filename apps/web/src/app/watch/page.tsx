'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, Power, Shield, Zap, Lock, Unlock, Volume2, 
  Clock, Battery, KeyRound, X, Check, ShieldAlert
} from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';

export default function SmartwatchDashboardPage() {
  const devices = useSmartHomeStore(s => s.devices);
  const toggleDevice = useSmartHomeStore(s => s.toggleDevice);
  const user = useSmartHomeStore(s => s.user);
  const lang = useRuntimeStore(s => s.lang);
  const isEn = lang === 'en';

  const [currentTime, setCurrentTime] = useState('12:00');
  const [pinLockTarget, setPinLockTarget] = useState<any | null>(null);
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState('');
  const [watchToast, setWatchToast] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg: string) => {
    setWatchToast(msg);
    setTimeout(() => setWatchToast(''), 2200);
  };

  // Filter accessible devices respecting RBAC
  const userRole = user?.role || 'MEMBER';
  const isRestricted = userRole === 'RESTRICTED';

  const filteredDevices = devices.filter(d => {
    if (isRestricted && d.type === 'LOCK') return false;
    return true;
  });

  const quickDevices = (filteredDevices.length > 0 ? filteredDevices : [
    { id: 'light-living-1', name: isEn ? 'Living Light' : 'إضاءة المعيشة', type: 'LIGHT', state: 'ON' },
    { id: 'ac-bedroom', name: isEn ? 'Master AC' : 'مكيف النوم', type: 'FAN', state: 'ON' },
    { id: 'socket-tv', name: isEn ? 'TV Socket' : 'مقبس الشاشة', type: 'SOCKET', state: 'OFF' },
    { id: 'door-lock', name: isEn ? 'Front Door' : 'الباب الرئيسي', type: 'LOCK', state: 'ON' },
  ]).slice(0, 4);

  const handleDeviceClick = (d: any) => {
    if (d.type === 'LOCK' && d.state !== 'ON') {
      // Opening lock requires PIN
      setPinLockTarget(d);
      setPinCode('');
      setPinError('');
      return;
    }

    toggleDevice(d.id.toString());
    showToast(d.state === 'ON' ? 'OFF' : 'ON');
  };

  const handleVerifyPin = async () => {
    if (!pinCode) {
      setPinError('أدخل الرمز');
      return;
    }

    try {
      const res = await fetchAuth('/api/security/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCode, deviceId: pinLockTarget?.id, action: 'UNLOCK' })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toggleDevice(pinLockTarget.id.toString());
        showToast('تم الفتح 🔓');
        setPinLockTarget(null);
      } else {
        setPinError('رمز خاطئ');
      }
    } catch {
      setPinError('خطأ اتصال');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-3 select-none" dir={isEn ? 'ltr' : 'rtl'}>
      
      {/* Smartwatch Outer Bezel Frame */}
      <div className="w-[310px] h-[310px] rounded-full border-4 border-cyan-500/40 bg-[#040812] p-4 flex flex-col justify-between items-center relative overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.3)]">
        
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 inset-x-0 h-20 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />

        {/* Header Clock & Status */}
        <div className="text-center pt-1.5 z-10">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-[9px] font-mono text-cyan-400 font-bold tracking-wider">MOSA WATCH OS</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <span className="text-sm font-black text-white tracking-widest">{currentTime}</span>
        </div>

        {/* Toast Notification */}
        {watchToast && (
          <div className="absolute top-14 bg-cyan-500 text-black font-black text-[10px] px-3 py-0.5 rounded-full z-20 shadow-lg">
            {watchToast}
          </div>
        )}

        {/* 2x2 Quick Tap Grid */}
        {!pinLockTarget ? (
          <div className="grid grid-cols-2 gap-2 w-full my-auto px-2 z-10">
            {quickDevices.map((d) => {
              const isOn = d.state === 'ON';
              const isLock = d.type === 'LOCK';
              return (
                <motion.button
                  key={d.id}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleDeviceClick(d)}
                  className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    isOn 
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                      : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {isLock ? (
                    isOn ? <Lock size={16} className="text-rose-400" /> : <Unlock size={16} className="text-emerald-400" />
                  ) : (
                    <Power size={16} className={isOn ? 'text-cyan-300' : 'text-slate-500'} />
                  )}
                  <span className="text-[10px] font-bold mt-1 line-clamp-1 max-w-[80px]">{d.name}</span>
                </motion.button>
              );
            })}
          </div>
        ) : (
          /* Mini Watch PIN Pad */
          <div className="flex flex-col items-center justify-center gap-1.5 w-full my-auto px-4 z-20">
            <span className="text-[10px] font-bold text-rose-300">أدخل PIN القفل:</span>
            <input 
              type="password"
              maxLength={6}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              placeholder="••••"
              className="w-24 bg-black/80 border border-cyan-400 rounded-lg text-center font-mono text-xs py-1 text-white outline-none"
              autoFocus
            />
            {pinError && <span className="text-[8px] text-red-400 font-bold">{pinError}</span>}
            <div className="flex gap-2 mt-1">
              <button 
                onClick={handleVerifyPin} 
                className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[9px] rounded-md cursor-pointer"
              >
                تأكيد
              </button>
              <button 
                onClick={() => setPinLockTarget(null)} 
                className="px-2 py-1 bg-slate-800 text-slate-300 text-[9px] rounded-md cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Footer Quick Status */}
        <div className="pb-2 w-full px-6 z-10 flex justify-between items-center text-[9px] text-slate-400">
          <span>{user?.name || userRole}</span>
          <span className="text-emerald-400 font-mono">100% ⚡</span>
        </div>

      </div>

    </div>
  );
}
