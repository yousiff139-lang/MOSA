"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Power, Snowflake, Flame, Fan, Thermometer, Wind, Plus, LayoutGrid, Check, 
  Settings2, Zap, ArrowUpRight, ChevronUp, ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import AddDeviceModal from '@/components/dashboard-ui/AddDeviceModal';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

export default function AppliancesPage() {
  const devices = useSmartHomeStore(state => state.devices);
  const rooms = useSmartHomeStore(state => state.rooms);
  const toggleDevice = useSmartHomeStore(state => state.toggleDevice);
  const initBackendConnection = useSmartHomeStore(state => state.initBackendConnection);

  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Device configs for interactive AC controls
  const [deviceConfigs, setDeviceConfigs] = useState<Record<string, { 
    temp?: number; 
    mode?: string; 
    fanSpeed?: number;
    swing?: boolean;
  }>>({});

  const updateDeviceConfig = (id: string, updates: any) => {
    setDeviceConfigs(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { temp: 22, mode: 'cool', fanSpeed: 2, swing: true }),
        ...updates
      }
    }));
  };

  // Filter clean valid rooms (exclude raw XSS test strings)
  const cleanRooms = rooms.filter(r => r.name && !r.name.includes('<') && !r.name.includes('&lt;') && !r.name.includes('script'));

  // Filter Climate & Electrical Appliances (Separate from TV)
  const filteredDevices = devices.filter(d => {
    const deviceRoom = (d.room as any)?.name || d.room;
    const matchesRoom = selectedRoom === 'ALL' || deviceRoom === selectedRoom;
    const typeLower = (d.type || '').toLowerCase();
    const nameLower = (d.name || '').toLowerCase();

    // Exclude basic sensors like temperature/energy unless actuators
    if (typeLower === 'sensor' || typeLower === 'moisture' || typeLower === 'energy') return false;

    // Separate out TVs (TVs have their own dedicated /tv page!)
    if (typeLower === 'tv' || typeLower === 'smart_tv' || typeLower === 'media_player' || nameLower.includes('تلفاز') || nameLower.includes('شاشة')) {
      return false;
    }

    const matchesType = [
      'climate', 'fan', 'appliance', 'socket', 'heater'
    ].includes(typeLower) || 
    nameLower.includes('سبلت') || 
    nameLower.includes('مكيف') || 
    nameLower.includes('مروحة') || 
    nameLower.includes('سخان') || 
    nameLower.includes('غسالة') || 
    nameLower.includes('براد') ||
    nameLower.includes('مقبس') ||
    nameLower.includes('فيشة');

    return matchesRoom && matchesType;
  }).sort((a, b) => Number(a.pin ?? 0) - Number(b.pin ?? 0) || String(a.id).localeCompare(String(b.id)));

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8 pb-32 font-sans"
      dir="rtl"
    >
      {/* Header Banner */}
      <motion.header variants={itemVariants} className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-blue-950/60 via-cyan-950/40 to-slate-950/80 border border-white/10 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/15 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/15 rounded-full blur-[90px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.4)] shrink-0">
              <Thermometer size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">التكييف والأجهزة الذكية</h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">
                تحكم موحد فائق الدقة بالمكيفات والسبالت، وسرعات المراوح، والمقابس الكهربائية
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Quick Link to TV Remote Page */}
            <Link
              href="/tv"
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-purple-600/25 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 font-black rounded-2xl transition-all shadow-lg text-xs sm:text-sm cursor-pointer"
            >
              <span>صفحة ريموت الشاشات 📺</span>
              <ArrowUpRight size={16} />
            </Link>

            <button
              onClick={() => setIsAddOpen(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg text-xs sm:text-sm hover:scale-105 cursor-pointer"
            >
              <Plus size={18} />
              <span>إضافة جهاز / مكيف</span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Room Selector Bar */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <button
          onClick={() => setSelectedRoom('ALL')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold border transition-all whitespace-nowrap cursor-pointer ${
            selectedRoom === 'ALL'
              ? 'bg-white/15 text-white border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
              : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:bg-white/10'
          }`}
        >
          <LayoutGrid size={16} />
          الكل ({filteredDevices.length})
        </button>

        {cleanRooms.map(room => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room.name)}
            className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold border transition-all whitespace-nowrap cursor-pointer ${
              selectedRoom === room.name
                ? 'bg-white/15 text-white border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                : 'bg-white/5 text-slate-400 border-white/5 hover:text-white hover:bg-white/10'
            }`}
          >
            {room.name}
          </button>
        ))}
      </motion.div>

      {/* Grid of Appliances & ACs */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredDevices.map(d => {
            const isPowerOn = d.state === 'ON';
            const typeLower = (d.type || '').toLowerCase();
            const nameLower = (d.name || '').toLowerCase();
            const config = deviceConfigs[d.id] || { temp: 22, mode: 'cool', fanSpeed: 2, swing: true };
            const isAC = typeLower === 'climate' || nameLower.includes('مكيف') || nameLower.includes('سبلت');

            return (
              <motion.div
                key={d.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0b101d]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 relative overflow-hidden group shadow-2xl hover:border-cyan-500/30 transition-all duration-300"
              >
                {/* Background Dynamic Glow */}
                <div className={`absolute inset-0 opacity-15 pointer-events-none blur-[100px] transition-all duration-700 ${
                  !isPowerOn ? 'bg-transparent' : isAC ? 'bg-cyan-500' : 'bg-emerald-500'
                }`} />

                {/* Device Header */}
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                      isPowerOn
                        ? isAC ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                               : 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                        : 'bg-white/5 border-white/10 text-slate-500'
                    }`}>
                      {isAC ? <Thermometer size={24} /> : <Settings2 size={24} />}
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                        {d.name}
                      </h3>
                      <p className="text-slate-400 text-xs font-medium mt-0.5">
                        {(d.room as any)?.name || d.room || 'الصالة'} • {isAC ? 'مكيف هواء ذكي (AC)' : 'جهاز كهربائي'} • GPIO {d.pin}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleDevice(d.id.toString())}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                      isPowerOn 
                        ? isAC 
                          ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                          : 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                        : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-white border border-white/5'
                    }`}
                    title={isPowerOn ? 'إطفاء الجهاز' : 'تشغيل الجهاز'}
                  >
                    <Power size={22} />
                  </button>
                </div>

                {/* CLIMATE / AC CONTROLLER */}
                {isAC && (
                  <div className={`space-y-5 relative z-10 transition-all ${isPowerOn ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                    {/* AC Temperature Dial Display */}
                    <div className="flex flex-col items-center justify-center p-5 bg-black/40 border border-white/10 rounded-2xl relative overflow-hidden">
                      <div className="text-5xl font-black text-white font-mono tracking-tight flex items-baseline">
                        {config.temp}
                        <span className="text-2xl text-cyan-400 ml-1">°C</span>
                      </div>
                      <span className="text-xs text-slate-400 mt-1 font-bold">درجة التبريد / التدفئة المطلوبة</span>
                      
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-full font-bold border border-cyan-500/30">
                          النمط: {config.mode === 'cool' ? '❄️ تبريد' : config.mode === 'heat' ? '🔥 تدفئة' : '🌀 مروحة'}
                        </span>
                        <span className="text-[10px] bg-white/10 text-slate-300 px-3 py-1 rounded-full font-bold">
                          سرعة المروحة: {config.fanSpeed || 2}/3
                        </span>
                      </div>
                    </div>

                    {/* Temp Adjust Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => updateDeviceConfig(d.id.toString(), { temp: Math.min(30, (config.temp || 22) + 1) })}
                        className="bg-white/5 hover:bg-cyan-600/20 border border-white/10 hover:border-cyan-400/40 rounded-2xl py-3 flex items-center justify-center gap-2 text-white font-bold text-xs transition-all cursor-pointer"
                      >
                        <ChevronUp size={18} className="text-cyan-400" />
                        رفع الحرارة (+1°C)
                      </button>
                      <button 
                        onClick={() => updateDeviceConfig(d.id.toString(), { temp: Math.max(16, (config.temp || 22) - 1) })}
                        className="bg-white/5 hover:bg-cyan-600/20 border border-white/10 hover:border-cyan-400/40 rounded-2xl py-3 flex items-center justify-center gap-2 text-white font-bold text-xs transition-all cursor-pointer"
                      >
                        <ChevronDown size={18} className="text-cyan-400" />
                        خفض الحرارة (-1°C)
                      </button>
                    </div>

                    {/* Mode Selector */}
                    <div className="bg-black/40 border border-white/10 p-1.5 rounded-2xl flex justify-between gap-1">
                      {[
                        { id: 'cool', icon: Snowflake, label: 'تبريد', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
                        { id: 'heat', icon: Flame, label: 'تدفئة', color: 'text-orange-400', bg: 'bg-orange-500/20' },
                        { id: 'fan', icon: Fan, label: 'مروحة', color: 'text-teal-400', bg: 'bg-teal-500/20' }
                      ].map(mode => {
                        const Icon = mode.icon;
                        const isActive = (config.mode || 'cool') === mode.id;
                        return (
                          <button
                            key={mode.id}
                            onClick={() => updateDeviceConfig(d.id.toString(), { mode: mode.id })}
                            className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                              isActive ? `${mode.bg} ${mode.color} border border-white/10 font-bold` : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <Icon size={16} />
                            <span className="text-[11px] font-bold">{mode.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* GENERAL ELECTRICAL APPLIANCE */}
                {!isAC && (
                  <div className={`p-4 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-between relative z-10 ${isPowerOn ? 'opacity-100' : 'opacity-40'}`}>
                    <div>
                      <span className="text-xs text-slate-300 block font-bold">حالة التغذية الكهربائية</span>
                      <span className="text-[10px] text-slate-400 font-mono">حمل التشغيل: {d.powerUsage ? `${d.powerUsage}W` : '220V Relay'}</span>
                    </div>
                    <span className={`text-xs font-black px-3.5 py-1.5 rounded-full border ${isPowerOn ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-white/5'}`}>
                      {isPowerOn ? '⚡ يعمل (ON)' : '🛑 متوقف (OFF)'}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredDevices.length === 0 && (
          <div className="col-span-2 py-16 flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
            <Thermometer size={48} className="text-white/20 mb-4" />
            <p className="text-white/60 font-bold text-sm">لا توجد مكيفات أو أجهزة مضافة في هذه المساحة.</p>
            <p className="text-white/30 text-xs mt-1">اضغط على "إضافة جهاز" بالأعلى لربط ريلاي جديد لمكيف أو جهاز كهربائي.</p>
          </div>
        )}
      </motion.div>

      <AddDeviceModal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        onSuccess={() => {
          setIsAddOpen(false);
          initBackendConnection();
        }}
      />
    </motion.div>
  );
}
