"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, Sun, Moon, Palette, Power, 
  Blinds, ChevronUp, ChevronDown, Plus, Blinds as BlindsIcon, 
  Sparkles, Search, Sliders, Check, Zap, Eye, Clock, Layers,
  RefreshCw, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { notify } from '@/store/useConfirmStore';
import AddDeviceModal from '@/components/dashboard-ui/AddDeviceModal';

interface DeviceExtraState {
  brightness: number;
  color: string;
  blindsOpen: number;
  timerMinutes?: number | null;
}

export default function LightingBlindsPage() {
  const devices = useSmartHomeStore(state => state.devices);
  const toggleDevice = useSmartHomeStore(state => state.toggleDevice);
  const initBackendConnection = useSmartHomeStore(state => state.initBackendConnection);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'lights' | 'curtains'>('all');
  
  // Persistent extra configs (Brightness, Color, Blind %, Timer)
  const [deviceStates, setDeviceStates] = useState<Record<string, DeviceExtraState>>({});

  // Load cached extra states
  useEffect(() => {
    try {
      const cached = localStorage.getItem('mosa_lighting_states');
      if (cached) {
        setDeviceStates(JSON.parse(cached));
      }
    } catch {}
  }, []);

  const updateLocalState = (id: string, updates: Partial<DeviceExtraState>) => {
    setDeviceStates(prev => {
      const next = {
        ...prev,
        [id]: {
          ...(prev[id] || { brightness: 100, color: '#f59e0b', blindsOpen: 100, timerMinutes: null }),
          ...updates
        }
      };
      try {
        localStorage.setItem('mosa_lighting_states', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Helper: Filter out all sensors strictly
  const isSensor = (d: any) => {
    if (d.isSensor) return true;
    const type = (d.type || '').toLowerCase();
    const name = (d.name || '').toLowerCase();
    return ['sensor', 'dht', 'temperature', 'humidity', 'energy', 'acs712', 'motion', 'pir', 'analog', 'حساس', 'حرارة', 'رطوبة', 'طاقة'].some(k => type.includes(k) || name.includes(k));
  };

  // Filter lighting devices
  const allLightDevices = useMemo(() => {
    return devices.filter(d => {
      if (isSensor(d)) return false;
      const typeLower = (d.type || '').toLowerCase();
      const nameLower = (d.name || '').toLowerCase();
      return typeLower === 'light' || 
             typeLower === 'rgb' || 
             typeLower === 'switch' || 
             typeLower === 'relay' || 
             nameLower.includes('سويج') || 
             nameLower.includes('إنارة') || 
             nameLower.includes('ضوء') || 
             nameLower.includes('مفتاح') || 
             nameLower.includes('لد') ||
             nameLower.includes('مصباح');
    }).sort((a, b) => Number(a.pin ?? 0) - Number(b.pin ?? 0));
  }, [devices]);

  // Filter curtain devices
  const allCurtainDevices = useMemo(() => {
    return devices.filter(d => {
      if (isSensor(d)) return false;
      const typeLower = (d.type || '').toLowerCase();
      const nameLower = (d.name || '').toLowerCase();
      return typeLower === 'curtain' || typeLower === 'blind' || nameLower.includes('ستائر') || nameLower.includes('ستارة') || nameLower.includes('شتر');
    }).sort((a, b) => Number(a.pin ?? 0) - Number(b.pin ?? 0));
  }, [devices]);

  // Extract unique rooms
  const availableRooms = useMemo(() => {
    const set = new Set<string>();
    [...allLightDevices, ...allCurtainDevices].forEach(d => {
      const roomName = (d.room as any)?.name || (typeof d.room === 'string' ? d.room : '') || 'الرئيسية';
      if (roomName) set.add(roomName);
    });
    return Array.from(set);
  }, [allLightDevices, allCurtainDevices]);

  // Apply filters
  const filteredLights = allLightDevices.filter(d => {
    const roomName = (d.room as any)?.name || (typeof d.room === 'string' ? d.room : '') || 'الرئيسية';
    const matchesRoom = selectedRoomFilter === 'all' || roomName === selectedRoomFilter;
    const matchesSearch = !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(d.pin).includes(searchQuery);
    return matchesRoom && matchesSearch;
  });

  const filteredCurtains = allCurtainDevices.filter(d => {
    const roomName = (d.room as any)?.name || (typeof d.room === 'string' ? d.room : '') || 'الرئيسية';
    const matchesRoom = selectedRoomFilter === 'all' || roomName === selectedRoomFilter;
    const matchesSearch = !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(d.pin).includes(searchQuery);
    return matchesRoom && matchesSearch;
  });

  // Global Bulk Actions
  const handleToggleAllLights = async (targetState: boolean) => {
    for (const dev of allLightDevices) {
      const isCurrentlyOn = dev.state === 'ON' || (dev.state as any) === true;
      if (isCurrentlyOn !== targetState) {
        await toggleDevice(dev.id.toString());
      }
    }
    notify({
      type: 'info',
      title: targetState ? 'تشغيل الكل' : 'إطفاء الكل',
      message: targetState ? 'تم إرسال أمر تشغيل كافة الإنارات.' : 'تم إرسال أمر إطفاء كافة الإنارات.'
    });
  };

  const handleBulkCurtains = (percent: number) => {
    allCurtainDevices.forEach(d => {
      updateLocalState(d.id.toString(), { blindsOpen: percent });
    });
    notify({
      type: 'info',
      title: 'ضبط كافة الستائر',
      message: `تم ضبط وضعية جميع الستائر على ${percent}%.`
    });
  };

  // Quick Scene Preset Handler
  const applyLightingPreset = async (presetName: 'relax' | 'cinema' | 'bright' | 'night') => {
    if (presetName === 'relax') {
      // Warm dim light
      allLightDevices.forEach(d => updateLocalState(d.id.toString(), { brightness: 50, color: '#f59e0b' }));
      notify({ type: 'success', title: 'وضع الاسترخاء', message: 'تم تفعيل إضاءة دافئة هادئة 50%.' });
    } else if (presetName === 'cinema') {
      // Dim RGB purple/blue & close blinds
      allLightDevices.forEach(d => updateLocalState(d.id.toString(), { brightness: 20, color: '#8B5CF6' }));
      handleBulkCurtains(0);
      notify({ type: 'success', title: 'وضع السينما', message: 'تم خفض الإضاءة إلى 20% وإغلاق الستائر.' });
    } else if (presetName === 'bright') {
      // Full bright white
      allLightDevices.forEach(d => updateLocalState(d.id.toString(), { brightness: 100, color: '#FFFFFF' }));
      await handleToggleAllLights(true);
      notify({ type: 'success', title: 'وضع السطوع الكامل', message: 'تم تشغيل جميع المصابيح بأعلى سطوع 100%.' });
    } else if (presetName === 'night') {
      // Turn off all except minimal nightlights
      await handleToggleAllLights(false);
      handleBulkCurtains(0);
      notify({ type: 'info', title: 'الوضع الليلي', message: 'تم إطفاء الإنارات وإغلاق الستائر للنوم.' });
    }
  };

  const colorPalette = [
    { name: 'أصفر دافئ (2700K)', hex: '#f59e0b' },
    { name: 'أبيض طبيعي (4000K)', hex: '#FFFFFF' },
    { name: 'أزرق سماوي', hex: '#06b6d4' },
    { name: 'أرجواني هادئ', hex: '#8B5CF6' },
    { name: 'وردي نيون', hex: '#ec4899' },
    { name: 'أخضر زمردي', hex: '#10b981' },
    { name: 'أحمر ليلي', hex: '#ef4444' },
    { name: 'برتقالي غروب', hex: '#f97316' }
  ];

  const activeLightsCount = allLightDevices.filter(d => d.state === 'ON' || (d.state as any) === true).length;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8 pb-32 select-none" dir="rtl">
      
      {/* ── 1. Hero Banner & Stats ── */}
      <header className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-amber-950/30 via-slate-900/90 to-cyan-950/30 border border-white/10 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5 text-center md:text-right">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-[0_0_35px_rgba(245,158,11,0.4)] shrink-0">
              <Lightbulb size={32} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5 justify-center md:justify-start">
                <span>مركز التحكم بالإضاءة والستائر الذكية</span>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Live mTLS Sync
                </span>
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">
                التحكم المباشر بمرحلات الإنارة وقنوات الـ LED وتعتيم السطوع وحركة الستائر عبر الـ ESP32
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-amber-500/30 active:scale-95 text-xs"
            >
              <Plus size={16} />
              <span>إضافة جهاز جديد</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
          <div className="bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-slate-400">الإنارات النشطة:</span>
            <span className="font-mono font-black text-amber-400 text-sm">{activeLightsCount} / {allLightDevices.length}</span>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-slate-400">إجمالي الستائر:</span>
            <span className="font-mono font-black text-cyan-400 text-sm">{allCurtainDevices.length}</span>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-slate-400">العقدة المتصلة:</span>
            <span className="font-mono font-bold text-emerald-400 text-xs truncate">MosaNode</span>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-slate-400">استجابة العتاد:</span>
            <span className="font-mono font-bold text-teal-300 text-xs">Instant MQTT</span>
          </div>
        </div>
      </header>

      {/* ── 2. Atmospheric Scene Presets Bar ── */}
      <div className="p-4 bg-slate-900/80 border border-white/10 rounded-3xl backdrop-blur-xl space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-black text-white flex items-center gap-2">
            <Sparkles size={15} className="text-amber-400" />
            <span>المشاهد والأجواء السريعة المتكاملة:</span>
          </span>
          <span className="text-[11px] text-slate-400">تطبيق على كافة أرجاء المنزل بلمسة واحدة</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => applyLightingPreset('relax')}
            className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-900/10 hover:from-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95"
          >
            <Sun size={18} className="text-amber-400" />
            <div className="text-right">
              <span className="block font-black">أجواء الاسترخاء</span>
              <span className="text-[10px] text-slate-400">إضاءة دافئة 50%</span>
            </div>
          </button>

          <button
            onClick={() => applyLightingPreset('cinema')}
            className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/15 to-purple-900/10 hover:from-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95"
          >
            <Moon size={18} className="text-purple-400" />
            <div className="text-right">
              <span className="block font-black">وضع السينما</span>
              <span className="text-[10px] text-slate-400">خفت + إغلاق ستائر</span>
            </div>
          </button>

          <button
            onClick={() => applyLightingPreset('bright')}
            className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-cyan-900/10 hover:from-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95"
          >
            <Zap size={18} className="text-cyan-400" />
            <div className="text-right">
              <span className="block font-black">سطوع كامل</span>
              <span className="text-[10px] text-slate-400">100% لكافة الغرف</span>
            </div>
          </button>

          <button
            onClick={() => applyLightingPreset('night')}
            className="p-3 rounded-2xl bg-gradient-to-br from-slate-700/30 to-slate-900/40 hover:from-slate-700/40 border border-white/10 text-slate-300 text-xs font-bold flex items-center gap-2.5 transition-all active:scale-95"
          >
            <Moon size={18} className="text-blue-400" />
            <div className="text-right">
              <span className="block font-black">الوضع الليلي</span>
              <span className="text-[10px] text-slate-400">إطفاء شامل للنوم</span>
            </div>
          </button>
        </div>
      </div>

      {/* ── 3. Filters & Search Control Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-black/40 border border-white/10 rounded-3xl backdrop-blur-xl">
        
        {/* Category Tabs */}
        <div className="bg-slate-950 p-1 rounded-2xl border border-white/10 flex items-center gap-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            الكل ({allLightDevices.length + allCurtainDevices.length})
          </button>
          <button
            onClick={() => setActiveTab('lights')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'lights' ? 'bg-amber-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            الإنارة والمفاتيح ({allLightDevices.length})
          </button>
          <button
            onClick={() => setActiveTab('curtains')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'curtains' ? 'bg-cyan-500 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            الستائر ({allCurtainDevices.length})
          </button>
        </div>

        {/* Room Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedRoomFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedRoomFilter === 'all' 
                ? 'bg-white/20 text-white border border-white/30' 
                : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            كافة الغرف
          </button>
          {availableRooms.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRoomFilter(r)}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedRoomFilter === r 
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50' 
                  : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Search Input & Bulk On/Off */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="relative flex-1 md:w-48">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث عن مفتاح أو إنارة..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pr-8 pl-3 py-1.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleToggleAllLights(true)}
              className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold rounded-xl text-xs transition-colors border border-amber-500/30"
              title="تشغيل كافة إنارات المنزل"
            >
              تشغيل الكل
            </button>
            <button
              onClick={() => handleToggleAllLights(false)}
              className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold rounded-xl text-xs transition-colors border border-rose-500/30"
              title="إطفاء كافة إنارات المنزل"
            >
              إطفاء الكل
            </button>
          </div>
        </div>

      </div>

      {/* ── 4. Main Devices Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Lights & Switches Section */}
        {(activeTab === 'all' || activeTab === 'lights') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Lightbulb size={20} className="text-amber-400" />
                <span>أجهزة الإنارة والمفاتيح الذكية ({filteredLights.length})</span>
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                Active: <strong className="text-amber-400">{filteredLights.filter(d => d.state === 'ON' || (d.state as any) === true).length}</strong>
              </span>
            </div>

            <AnimatePresence mode="popLayout">
              {filteredLights.map(d => {
                const isPowerOn = d.state === 'ON' || (d.state as any) === true;
                const config = deviceStates[d.id] || { brightness: 100, color: '#f59e0b', blindsOpen: 100 };
                const isRGB = d.type?.toLowerCase() === 'rgb' || d.name?.toLowerCase().includes('rgb') || d.name?.includes('ملون') || d.name?.includes('شريط');
                const roomName = (d.room as any)?.name || (typeof d.room === 'string' ? d.room : '') || 'غرفة المعيشة';

                return (
                  <motion.div
                    key={d.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className={`relative bg-slate-900/80 backdrop-blur-xl border rounded-3xl p-5 overflow-hidden shadow-2xl transition-all ${
                      isPowerOn ? 'border-amber-500/40 ring-1 ring-amber-500/20' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Ambient Glow matching color */}
                    <div 
                      className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-[100px] pointer-events-none transition-all duration-500"
                      style={{ 
                        backgroundColor: isPowerOn ? (isRGB ? config.color : '#f59e0b') : 'transparent',
                        opacity: isPowerOn ? (config.brightness / 100) * 0.25 : 0 
                      }}
                    />

                    {/* Card Top Row */}
                    <div className="relative flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                            isPowerOn 
                              ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-amber-500/40 scale-105' 
                              : 'bg-black/50 text-slate-500 border border-white/10'
                          }`}
                          style={{
                            backgroundColor: isPowerOn && isRGB ? config.color : undefined
                          }}
                        >
                          <Lightbulb size={24} className={isPowerOn ? 'animate-pulse' : ''} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-white">{d.name}</h3>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                              isPowerOn ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/5 text-slate-400'
                            }`}>
                              {isPowerOn ? 'تشغيل ON' : 'مطفأ OFF'}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs font-medium mt-0.5 flex items-center gap-2">
                            <span>{roomName}</span>
                            <span>•</span>
                            <span className="font-mono text-cyan-400">GPIO {d.pin || 4}</span>
                            <span>•</span>
                            <span className="text-[11px] text-slate-500">{isRGB ? 'قناة RGB' : 'مفتاح ريلاي'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Main Power Button */}
                      <button 
                        onClick={() => toggleDevice(d.id.toString())}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-95 ${
                          isPowerOn 
                            ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 shadow-amber-500/40 border-2 border-white' 
                            : 'bg-slate-950 text-slate-400 border border-white/10 hover:border-amber-400 hover:text-white'
                        }`}
                        title={isPowerOn ? 'إطفاء المفتاح' : 'تشغيل المفتاح'}
                      >
                        <Power size={22} />
                      </button>
                    </div>

                    {/* Controls Container */}
                    <div className={`space-y-4 pt-3 border-t border-white/10 transition-opacity duration-300 ${isPowerOn ? 'opacity-100' : 'opacity-35 pointer-events-none'}`}>
                      
                      {/* Brightness Dimmer */}
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Moon size={13} />
                            <span>مستوى السطوع (Dimmer):</span>
                          </span>
                          <span className="font-mono font-black text-amber-400">{config.brightness}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="100" 
                          value={config.brightness}
                          onChange={(e) => updateLocalState(d.id.toString(), { brightness: parseInt(e.target.value) })}
                          className="w-full h-2 bg-black/60 rounded-lg appearance-none cursor-pointer accent-amber-400 border border-white/5"
                        />
                      </div>

                      {/* Color Palette (for RGB or custom ambiance) */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                            <Palette size={13} className="text-purple-400" />
                            <span>حرارة اللون والـ RGB:</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {colorPalette.map(c => (
                            <button
                              key={c.hex}
                              onClick={() => updateLocalState(d.id.toString(), { color: c.hex })}
                              className={`w-7 h-7 rounded-xl border-2 transition-all hover:scale-110 flex items-center justify-center ${
                                config.color === c.hex ? 'border-white scale-110 shadow-lg' : 'border-black/40'
                              }`}
                              style={{ backgroundColor: c.hex, boxShadow: config.color === c.hex ? `0 0 12px ${c.hex}` : 'none' }}
                              title={c.name}
                            >
                              {config.color === c.hex && <Check size={12} className={c.hex === '#FFFFFF' ? 'text-black' : 'text-white'} />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Quick Auto-Off Timer Preset */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock size={12} />
                          <span>إطفاء تلقائي بعد:</span>
                        </span>
                        <div className="flex gap-1.5">
                          {[15, 30, 60].map(mins => (
                            <button
                              key={mins}
                              onClick={() => {
                                updateLocalState(d.id.toString(), { timerMinutes: mins });
                                notify({ type: 'info', title: 'مؤقت ذكي', message: `سيتم إطفاء ${d.name} تلقائياً بعد ${mins} دقيقة.` });
                              }}
                              className="px-2 py-0.5 bg-black/40 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 rounded-lg border border-white/5 font-mono"
                            >
                              {mins} د
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredLights.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center bg-black/30 border border-dashed border-white/10 rounded-3xl text-center p-6">
                <Lightbulb size={36} className="text-slate-600 mb-2" />
                <p className="text-slate-400 text-sm font-bold">لا توجد أجهزة إنارة مطابقة للبحث أو الغرفة المحددة.</p>
              </div>
            )}
          </div>
        )}

        {/* Curtains & Motors Section */}
        {(activeTab === 'all' || activeTab === 'curtains') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <BlindsIcon size={20} className="text-cyan-400" />
                <span>الستائر والمحركات الميكانيكية ({filteredCurtains.length})</span>
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                Total: <strong className="text-cyan-400">{filteredCurtains.length}</strong>
              </span>
            </div>

            <AnimatePresence mode="popLayout">
              {filteredCurtains.map(d => {
                const config = deviceStates[d.id] || { blindsOpen: 100, brightness: 100, color: '#f59e0b' };
                const roomName = (d.room as any)?.name || (typeof d.room === 'string' ? d.room : '') || 'غرفة النوم';

                return (
                  <motion.div
                    key={d.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                          <Blinds size={24} />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-white">{d.name}</h3>
                          <p className="text-slate-400 text-xs font-medium">
                            {roomName} • ستارة كهربائية • GPIO {d.pin || 23}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-2xl font-black text-cyan-400 font-mono">{config.blindsOpen}%</span>
                        <span className="text-[10px] text-slate-400 block font-bold">
                          {config.blindsOpen === 0 ? 'مغلقة كلياً' : config.blindsOpen === 100 ? 'مفتوحة كلياً' : 'مفتوحة جزئياً'}
                        </span>
                      </div>
                    </div>

                    {/* Interactive Animated Curtain Mockup & Steppers */}
                    <div className="flex gap-6 items-center justify-center p-4 bg-black/40 border border-white/5 rounded-2xl">
                      
                      {/* Visual Window Mockup */}
                      <div className="w-28 h-36 bg-slate-950 border-2 border-cyan-500/30 rounded-2xl relative overflow-hidden flex flex-col items-center shadow-inner">
                        <div className="w-full h-2 bg-slate-700 absolute top-0 z-10 shadow" />
                        <motion.div 
                          className="w-full bg-gradient-to-b from-cyan-600/40 to-cyan-400/20 backdrop-blur-md border-b-2 border-cyan-400 absolute top-0"
                          animate={{ height: `${100 - config.blindsOpen}%` }}
                          transition={{ type: 'spring', bounce: 0.1, duration: 0.4 }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
                          <Sun size={36} className="text-amber-400 animate-spin-slow" />
                        </div>
                      </div>

                      {/* Controls & Percentage Slider */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <button 
                            onClick={() => updateLocalState(d.id.toString(), { blindsOpen: Math.min(100, config.blindsOpen + 10) })}
                            className="p-2 bg-slate-950 hover:bg-cyan-500/20 text-cyan-300 rounded-xl border border-white/10 transition-colors flex-1 flex items-center justify-center gap-1 text-xs font-bold"
                          >
                            <ChevronUp size={16} />
                            <span>رفع 10%</span>
                          </button>
                          <button 
                            onClick={() => updateLocalState(d.id.toString(), { blindsOpen: Math.max(0, config.blindsOpen - 10) })}
                            className="p-2 bg-slate-950 hover:bg-cyan-500/20 text-cyan-300 rounded-xl border border-white/10 transition-colors flex-1 flex items-center justify-center gap-1 text-xs font-bold"
                          >
                            <ChevronDown size={16} />
                            <span>خفض 10%</span>
                          </button>
                        </div>

                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={config.blindsOpen}
                          onChange={(e) => updateLocalState(d.id.toString(), { blindsOpen: parseInt(e.target.value) })}
                          className="w-full h-2 bg-black/60 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-white/5"
                        />

                        {/* Quick Snap Positions */}
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <button 
                            onClick={() => updateLocalState(d.id.toString(), { blindsOpen: 0 })}
                            className={`py-1 rounded-lg text-[11px] font-bold transition-all ${
                              config.blindsOpen === 0 ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            إغلاق 0%
                          </button>
                          <button 
                            onClick={() => updateLocalState(d.id.toString(), { blindsOpen: 50 })}
                            className={`py-1 rounded-lg text-[11px] font-bold transition-all ${
                              config.blindsOpen === 50 ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            نصف 50%
                          </button>
                          <button 
                            onClick={() => updateLocalState(d.id.toString(), { blindsOpen: 100 })}
                            className={`py-1 rounded-lg text-[11px] font-bold transition-all ${
                              config.blindsOpen === 100 ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            فتح 100%
                          </button>
                        </div>
                      </div>

                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredCurtains.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center bg-black/30 border border-dashed border-white/10 rounded-3xl text-center p-6">
                <BlindsIcon size={36} className="text-slate-600 mb-2" />
                <p className="text-slate-400 text-sm font-bold">لا توجد ستائر ذكية مطابقة للبحث أو الغرفة المحددة.</p>
              </div>
            )}
          </div>
        )}

      </div>

      <AddDeviceModal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        onSuccess={() => {
          setIsAddOpen(false);
          initBackendConnection();
        }}
      />
    </div>
  );
}
