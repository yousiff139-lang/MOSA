'use client';

import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import { motion } from 'framer-motion';
import { Sun, Moon, Cloud, Droplets, ShieldCheck, Zap, Leaf, Sparkles, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';

export function WelcomeBanner() {
  const user = useSmartHomeStore(state => state.user);
  const devices = useSmartHomeStore(state => state.devices);
  const globalData = useSmartHomeStore(state => state.globalData);
  const isConnected = useSmartHomeStore(state => state.isConnected);
  const isEdgeMode = useSmartHomeStore(state => state.isEdgeMode);
  const toggleEdgeMode = useSmartHomeStore(state => state.toggleEdgeMode);
  const lang = useRuntimeStore(state => state.lang);
  const isEn = lang === 'en';

  const [greeting, setGreeting] = useState('');
  const [icon, setIcon] = useState(<Sun className="text-amber-400" size={28} />);
  const [date, setDate] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting(isEn ? 'Good Morning' : 'صباح الخير');
      setIcon(<Sun className="text-amber-400 animate-spin-slow" size={28} />);
    } else if (hour < 18) {
      setGreeting(isEn ? 'Good Afternoon' : 'مساء الخير');
      setIcon(<Sun className="text-orange-400" size={28} />);
    } else {
      setGreeting(isEn ? 'Good Evening' : 'مساء الخير');
      setIcon(<Moon className="text-cyan-400" size={28} />);
    }

    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setDate(new Date().toLocaleDateString(isEn ? 'en-US' : 'ar-IQ', options));
  }, [isEn]);

  const activeLightsCount = devices?.filter(d => (d.type || '').toUpperCase() === 'LIGHT' && d.state === 'ON').length || 0;
  const activeSocketsCount = devices?.filter(d => d.state === 'ON').length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] bg-gradient-to-r from-[#0c1324] via-[#0f172a] to-[#0c1324] border border-slate-800 p-4 sm:p-6 md:p-8 shadow-xl"
      dir={isEn ? 'ltr' : 'rtl'}
    >
      {/* Decorative ambient auras */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        
        {/* User Greeting & Status Chips */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2.5 sm:p-3.5 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                  {greeting}، <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{user?.name || 'Mosa'}</span>!
                </h2>
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              </div>
              <p className="text-[11px] sm:text-xs md:text-sm text-slate-400 font-medium mt-0.5">{date}</p>
            </div>
          </div>

          {/* Quick System Status Badges */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 pt-0.5">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck size={13} className="stroke-[2.5]" />
              <span>{isEn ? 'System Protected & Secure' : 'النظام مؤمن ومحمي'}</span>
            </div>

            <div className="bg-white/5 border border-white/10 text-slate-300 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium flex items-center gap-1.5">
              <Zap size={13} className="text-amber-400" />
              <span>
                {isEn 
                  ? <><strong>{activeSocketsCount}</strong> active devices ({activeLightsCount} lights)</>
                  : <><strong>{activeSocketsCount}</strong> أجهزة تعمل ({activeLightsCount} أضواء)</>}
              </span>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium flex items-center gap-1.5">
              <Sparkles size={13} className="text-cyan-400" />
              <span>{isEn ? 'Home Temp: ' : 'حرارة المنزل: '}<strong>{globalData?.currentTemp || 24}°C</strong></span>
            </div>
          </div>
        </div>

        {/* Right Section: Eco Energy Saver Button & Weather Telemetry */}
        <div className="flex items-center gap-3 sm:gap-4 border-t lg:border-t-0 lg:border-r border-white/10 pt-3 sm:pt-4 lg:pt-0 lg:pr-6 justify-between lg:justify-end">
          
          {/* ⚡ AI Eco Energy Saver Switch */}
          <div
            onClick={toggleEdgeMode}
            className={`cursor-pointer px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border transition-all flex items-center gap-2.5 select-none ${
              isEdgeMode
                ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200'
            }`}
            title={isEn ? "Toggle AI Eco Energy Saver" : "تفعيل وضع توفير الطاقة الذكي"}
          >
            <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border shrink-0 ${isEdgeMode ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
              <Leaf size={16} />
            </div>
            <div>
              <div className="text-[11px] sm:text-xs font-bold text-white leading-tight">
                {isEn ? 'Smart Eco Saver' : 'توفير الطاقة الذكي'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {isEdgeMode 
                  ? <span className="text-emerald-400 font-bold">{isEn ? 'Active • Load Protection' : 'مفعّل • حماية الأحمال'}</span> 
                  : (isEn ? 'Disabled • Click to Enable' : 'معطل • اضغط للتفعيل')}
              </div>
            </div>
          </div>

          {/* Weather Widget */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl">
            <div className="flex flex-col items-center">
              <Cloud size={16} className="text-cyan-400 mb-0.5" />
              <span className="text-[11px] sm:text-xs font-bold text-white">{globalData?.currentTemp || 24.3}°C</span>
              <span className="text-[9px] text-slate-400">{isEn ? 'Weather' : 'الطقس'}</span>
            </div>
            <div className="w-[1px] h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <Droplets size={16} className="text-blue-400 mb-0.5" />
              <span className="text-[11px] sm:text-xs font-bold text-white">{(globalData as any)?.humidity || (globalData as any)?.currentHum || 43}%</span>
              <span className="text-[9px] text-slate-400">{isEn ? 'Humidity' : 'الرطوبة'}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
