'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { 
  Home, LayoutGrid, Zap, Shield, Settings, Bell, 
  Sun, Droplets, Thermometer, Wind, Tv, Lightbulb, 
  Play, Lock, Camera, Cpu, Mic, Activity, Power, Flame, Snowflake, UserCircle
} from 'lucide-react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

// --- MOCK DATA ---
const rooms = ['الكل', 'الصالة', 'المطبخ', 'غرفة النوم', 'الحديقة', 'المرآب'];

export default function MosaInfinityDashboard() {
  const globalData = useSmartHomeStore(state => state.globalData);
  const devices = useSmartHomeStore(state => state.devices);
  const [activeRoom, setActiveRoom] = useState('الكل');
  
  // Adaptive Theme State (Day/Night)
  const [theme, setTheme] = useState<'day' | 'night'>('night');
  
  // Performance Mode State (Disables heavy blur/mesh gradients)
  const [perfMode, setPerfMode] = useState<boolean>(false);

  // Time-based theme switching (Mock logic for demo, usually tied to actual time)
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 18) {
      setTheme('day');
    } else {
      setTheme('night');
    }
  }, []);

  // Theme Variables
  const themeStyles = {
    day: {
      bg: 'bg-slate-50',
      meshColors: 'from-amber-200/40 via-orange-100/40 to-blue-200/40',
      text: 'text-slate-800',
      textMuted: 'text-slate-500',
      glass: 'bg-white/40 border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)]',
      dock: 'bg-white/60 border-white/80',
      orb: 'from-amber-400 to-orange-500 shadow-[0_0_60px_rgba(251,191,36,0.6)]'
    },
    night: {
      bg: 'bg-[#030712]',
      meshColors: 'from-indigo-900/40 via-purple-900/30 to-cyan-900/40',
      text: 'text-slate-100',
      textMuted: 'text-slate-400',
      glass: 'bg-black/40 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
      dock: 'bg-black/60 border-white/10',
      orb: 'from-cyan-400 to-blue-600 shadow-[0_0_60px_rgba(34,211,238,0.4)]'
    }
  };

  const current = themeStyles[theme];

  return (
    <div dir="rtl" className={`min-h-screen w-full relative overflow-hidden flex flex-col font-sans transition-colors duration-1000 ${current.bg} ${current.text}`}>
      
      {/* 1. Fluid Ambient Background (Mesh Gradient) */}
      {!perfMode && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className={`absolute top-[-20%] right-[-10%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br ${current.meshColors} blur-[120px] opacity-60 mix-blend-screen`}
          />
          <motion.div 
            animate={{ 
              scale: [1.2, 1, 1.2],
              rotate: [90, 0, 90],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className={`absolute bottom-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tr ${current.meshColors} blur-[150px] opacity-60 mix-blend-screen`}
          />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex flex-col h-full overflow-hidden pb-24">
        
        {/* Top Floating Header */}
        <header className="px-8 pt-8 flex justify-between items-start flex-shrink-0">
           <div className="flex flex-col gap-1">
             <motion.h1 
               initial={{ opacity: 0, y: -20 }}
               animate={{ opacity: 1, y: 0 }}
               className="text-4xl font-bold tracking-tight"
             >
               المنزل الذكي
             </motion.h1>
             <motion.p 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.2 }}
               className={`${current.textMuted} flex items-center gap-2`}
             >
               {theme === 'day' ? <Sun size={16} className="text-amber-500" /> : <Shield size={16} className="text-indigo-400" />}
               {theme === 'day' ? 'يوم مشرق، الوضع النهاري مفعل' : 'النظام الآمن مفعل، مساء الخير'}
             </motion.p>
           </div>
           
           <div className="flex items-center gap-4">
             <button 
               onClick={() => setPerfMode(!perfMode)}
               className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${perfMode ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'}`}
             >
               {perfMode ? 'توفير الأداء: مفعل' : 'توفير الأداء: معطل'}
             </button>
             
             <button onClick={() => setTheme(theme === 'day' ? 'night' : 'day')} className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl ${current.glass} hover:scale-105 transition-all`}>
                {theme === 'day' ? <Sun size={20} className="text-amber-500"/> : <Home size={20} className="text-cyan-400"/>}
             </button>
             
             <div className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl ${current.glass} overflow-hidden`}>
                <UserCircle size={28} className={current.textMuted} />
             </div>
           </div>
        </header>

        {/* Spatial Grid Layout */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 mt-8 pb-10">
          <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
            
            {/* The Pulse Core (Center Stage) */}
            <div className="col-span-12 lg:col-span-4 flex items-center justify-center min-h-[400px] relative">
               <PulseCore theme={theme} current={current} perfMode={perfMode} />
            </div>

            {/* Spatial Widgets (Right side on LTR, Left on RTL) */}
            <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
               <SpatialCard current={current} perfMode={perfMode} delay={0.1}>
                 <div className="flex justify-between items-start">
                   <div>
                     <h3 className="font-bold text-lg mb-1">البيئة الداخلية</h3>
                     <p className={`text-sm ${current.textMuted}`}>متوسط غرف المنزل</p>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
                     <Thermometer size={20} />
                   </div>
                 </div>
                 <div className="mt-8 flex justify-between items-end">
                   <div>
                     <span className="text-5xl font-light">{globalData?.currentTemp || 24}</span><span className="text-2xl text-amber-500">°C</span>
                   </div>
                   <div className="text-right">
                     <span className="text-3xl font-light text-blue-400">{globalData?.currentHum || 45}</span><span className="text-xl text-blue-400/60">%</span>
                   </div>
                 </div>
               </SpatialCard>

               <SpatialCard current={current} perfMode={perfMode} delay={0.2}>
                 <div className="flex justify-between items-start">
                   <div>
                     <h3 className="font-bold text-lg mb-1">استهلاك الطاقة</h3>
                     <p className={`text-sm ${current.textMuted}`}>الاستهلاك اللحظي (Live)</p>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                     <Zap size={20} />
                   </div>
                 </div>
                 <div className="mt-8">
                   <span className="text-5xl font-light">{globalData?.currentPower || 0}</span><span className={`text-2xl ${current.textMuted} ml-2`}>W</span>
                 </div>
                 {/* Fake Sparkline */}
                 <div className="mt-4 flex items-end gap-1 h-8 opacity-50">
                    {[20, 30, 25, 40, 50, 45, 60, 55, 70, 65, 80].map((h, i) => (
                      <div key={i} className="flex-1 bg-emerald-400 rounded-t-sm" style={{ height: `${h}%` }}></div>
                    ))}
                 </div>
               </SpatialCard>

               <SpatialCard current={current} perfMode={perfMode} delay={0.3} className="col-span-1 md:col-span-2">
                 <div className="flex justify-between items-center mb-6">
                   <h3 className="font-bold text-lg">الأجهزة السريعة</h3>
                   <div className="flex gap-2">
                     {rooms.map(r => (
                       <button key={r} onClick={() => setActiveRoom(r)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeRoom === r ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : `bg-black/10 ${current.textMuted}`}`}>
                         {r}
                       </button>
                     ))}
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <MiniDevice icon={<Lightbulb/>} name="إضاءة السقف" state={true} current={current} type="light" />
                    <MiniDevice icon={<Wind/>} name="المكيف" state={true} current={current} type="ac" />
                    <MiniDevice icon={<Tv/>} name="شاشة التلفاز" state={false} current={current} type="switch" />
                    <MiniDevice icon={<Lock/>} name="قفل الباب" state={true} current={current} type="security" />
                 </div>
               </SpatialCard>
            </div>
            
          </div>
        </div>
      </main>

      {/* 2. Floating Bottom Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
         <motion.div 
           initial={{ y: 50, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           transition={{ type: 'spring', damping: 20, stiffness: 300, delay: 0.5 }}
           className={`flex items-center gap-2 px-4 py-3 rounded-3xl backdrop-blur-2xl border shadow-2xl ${current.dock}`}
         >
           <DockItem icon={<LayoutGrid size={24}/>} label="الرئيسية" active current={current} />
           <DockItem icon={<Home size={24}/>} label="الغرف" current={current} />
           <DockItem icon={<Mic size={24}/>} label="النداء" current={current} />
           <DockItem icon={<Camera size={24}/>} label="الكاميرات" current={current} />
           <div className={`w-px h-8 mx-2 ${theme === 'day' ? 'bg-slate-300' : 'bg-white/10'}`}></div>
           <DockItem icon={<Settings size={24}/>} label="الإعدادات" current={current} />
         </motion.div>
      </div>

    </div>
  );
}

// --- SUB COMPONENTS ---

// 3D Tilt Spatial Card
function SpatialCard({ children, current, perfMode, delay = 0, className = '' }: any) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7deg", "7deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (perfMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      style={perfMode ? {} : { rotateX, rotateY, transformPerspective: 1000 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-[32px] p-8 backdrop-blur-2xl border ${current.glass} transition-all duration-300 ease-out hover:shadow-2xl ${className}`}
    >
      <div className="relative z-10 h-full">
        {children}
      </div>
      {/* Glossy reflection overlay */}
      {!perfMode && <div className="absolute inset-0 rounded-[32px] bg-gradient-to-tr from-white/0 via-white/5 to-white/20 pointer-events-none"></div>}
    </motion.div>
  );
}

// The Pulse Core Widget
function PulseCore({ theme, current, perfMode }: any) {
  return (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 1, type: 'spring' }}
      className="relative w-72 h-72 flex items-center justify-center group cursor-pointer"
    >
      {/* Outer Rotating Rings */}
      {!perfMode && (
        <>
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className={`absolute inset-0 rounded-full border border-dashed ${theme === 'day' ? 'border-amber-400/30' : 'border-cyan-500/30'} opacity-50`}
          ></motion.div>
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className={`absolute inset-4 rounded-full border-2 ${theme === 'day' ? 'border-orange-500/10' : 'border-indigo-500/10'} opacity-50`}
          ></motion.div>
        </>
      )}

      {/* The Orb */}
      <div className={`relative w-48 h-48 rounded-full bg-gradient-to-tr ${current.orb} flex flex-col items-center justify-center text-white transition-transform duration-500 group-hover:scale-105`}>
        {/* Inner glow */}
        <div className="absolute inset-0 rounded-full bg-white/20 blur-md mix-blend-overlay"></div>
        
        <Activity size={32} className="mb-2 opacity-90" />
        <span className="text-4xl font-bold tracking-tighter">98%</span>
        <span className="text-xs font-medium opacity-80 uppercase tracking-widest mt-1">System Health</span>
      </div>
      
      {/* Orbiting Particles */}
      {!perfMode && [1, 2, 3].map((i) => (
        <motion.div
          key={i}
          animate={{ rotate: 360 }}
          transition={{ duration: 5 + i * 2, repeat: Infinity, ease: 'linear' }}
          className="absolute w-full h-full"
        >
          <div className={`absolute top-0 left-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_10px_white] -translate-x-1/2 -translate-y-1/2`}></div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// Mini Device Card
function MiniDevice({ icon, name, state, current, type }: any) {
  let activeColor = 'text-cyan-500';
  let activeBg = 'bg-cyan-500/10 border-cyan-500/30';
  
  if (type === 'light') {
    activeColor = 'text-amber-400';
    activeBg = 'bg-amber-400/10 border-amber-400/30';
  } else if (type === 'security') {
    activeColor = 'text-rose-500';
    activeBg = 'bg-rose-500/10 border-rose-500/30';
  }

  return (
    <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all cursor-pointer hover:scale-105 ${state ? activeBg : `bg-black/5 ${current.textMuted} border-transparent`}`}>
       <div className={`${state ? activeColor : current.textMuted}`}>
         {icon}
       </div>
       <span className={`text-xs font-bold ${state ? current.text : current.textMuted}`}>{name}</span>
    </div>
  );
}

// Dock Icon Item
function DockItem({ icon, label, active, current }: any) {
  return (
    <motion.button 
      whileHover={{ y: -8, scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={`relative group w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${active ? (current.text === 'text-slate-100' ? 'bg-white/10 text-white' : 'bg-black/10 text-black') : `${current.textMuted} hover:${current.text}`}`}
    >
      {icon}
      {/* Tooltip */}
      <div className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none ${current.text === 'text-slate-100' ? 'bg-white text-black' : 'bg-slate-800 text-white'}`}>
        {label}
      </div>
      {active && <div className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full ${current.text === 'text-slate-100' ? 'bg-white' : 'bg-black'}`}></div>}
    </motion.button>
  );
}
