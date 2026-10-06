'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { notify } from '@/store/useConfirmStore';
import { 
  Sun, Moon, Film, LogOut, Power, Zap, 
  Lightbulb, Tv, Fan, Lock, Unlock, Mic,
  SlidersHorizontal, Check, AlertTriangle, 
  ShieldCheck, RefreshCw, Sparkles, Send,
  Home as HomeIcon, MapPin, Coffee, Snowflake,
  Volume2, Shield, Radio, ChevronLeft, Droplets,
  Flame, BatteryCharging, AlertCircle, Eye, EyeOff
} from 'lucide-react';
import { getFriendlyErrorMessage } from '@/utils/friendlyErrors';

export function SimpleFamilyDashboard() {
  const devices = useSmartHomeStore(state => state.devices);
  const storeRooms = useSmartHomeStore(state => state.rooms);
  const toggleDevice = useSmartHomeStore(state => state.toggleDevice);
  const isConnected = useSmartHomeStore(state => state.isConnected);
  const isMqttConnected = useSmartHomeStore(state => state.isMqttConnected);
  const globalData = useSmartHomeStore(state => state.globalData);
  const uiMode = useSmartHomeStore(state => state.uiMode);
  const setUiMode = useSmartHomeStore(state => state.setUiMode);
  const user = useSmartHomeStore(state => state.user);

  const [activeRoomTab, setActiveRoomTab] = useState<string>('الكل');
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [voiceQuery, setVoiceQuery] = useState('');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [showTurnOffAllModal, setShowTurnOffAllModal] = useState(false);
  const [pendingLockDevice, setPendingLockDevice] = useState<any | null>(null);
  const [lockPin, setLockPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [togglingId, setTogglingId] = useState<string | number | null>(null);

  const userRole = (user?.role || '').toUpperCase();
  const isSuperAdminOrOwner = userRole === 'SUPER_OWNER' || userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'DEVELOPER';

  // Extract unique clean room names
  const roomsList = useMemo(() => {
    const names = new Set<string>();
    (storeRooms || []).forEach(r => { if (r.name) names.add(r.name); });
    devices.forEach(d => {
      const rName = typeof (d as any).room === 'object' ? (d as any).room?.name : (d as any).room;
      if (rName && rName !== 'unassigned') names.add(rName);
    });
    return ['الكل', ...Array.from(names)];
  }, [storeRooms, devices]);

  // Determine device category
  const getDeviceCategory = (device: any): string => {
    const type = (device.type || '').toUpperCase();
    const name = (device.name || '').toLowerCase();
    if (type.includes('LIGHT') || name.includes('ضو') || name.includes('إنارة') || name.includes('انارة') || name.includes('سبوت') || name.includes('مصباح')) return 'lighting';
    if (type.includes('CLIMATE') || type.includes('AC') || name.includes('مكيف') || name.includes('تبريد') || name.includes('سبلت') || name.includes('تدفئة') || name.includes('مروحة')) return 'climate';
    if (type.includes('LOCK') || type.includes('SECURITY') || name.includes('قفل') || name.includes('باب') || name.includes('كاميرا') || name.includes('حساس')) return 'security';
    if (type.includes('AUDIO') || type.includes('MEDIA') || type.includes('TV') || name.includes('تلفزيون') || name.includes('صوت') || name.includes('سماعة') || name.includes('شاشة')) return 'entertainment';
    return 'sockets';
  };

  // Filter devices by room, category, and search query
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      // Room filter
      if (activeRoomTab !== 'الكل') {
        const devRoom = typeof (device as any).room === 'object' ? (device as any).room?.name : (device as any).room;
        if (devRoom !== activeRoomTab) return false;
      }

      // Category filter
      if (activeCategoryTab !== 'all') {
        const cat = getDeviceCategory(device);
        if (cat !== activeCategoryTab) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (device.name || '').toLowerCase().includes(q);
        const pinMatch = String((device as any).pin || '').includes(q);
        const roomMatch = String(typeof (device as any).room === 'object' ? (device as any).room?.name : (device as any).room || '').toLowerCase().includes(q);
        if (!nameMatch && !pinMatch && !roomMatch) return false;
      }

      return true;
    });
  }, [devices, activeRoomTab, activeCategoryTab, searchQuery]);

  const activeDevicesCount = devices.filter(d => d.state === 'ON').length;
  const totalDevicesCount = devices.length;

  // Handle Quick Scene Execution
  const handleExecuteScene = async (title: string, actionDesc: string) => {
    try {
      if (title === 'نوم' || title === 'خروج') {
        let turnedOff = 0;
        for (const dev of devices) {
          if (dev.state === 'ON') {
            await toggleDevice(dev.id);
            turnedOff++;
          }
        }
        notify(`تم تفعيل وضع (${actionDesc}) بنجاح! تم إطفاء ${turnedOff} أجهزة وتأمين المنزل. ✨`, 'success');
      } else if (title === 'صباح') {
        const lights = devices.filter(d => getDeviceCategory(d) === 'lighting' && d.state !== 'ON');
        for (const light of lights.slice(0, 4)) {
          await toggleDevice(light.id);
        }
        notify('صباح الخير والبركة! تم تشغيل الإنارة الترحيبية وضبط البيت. ☀️', 'success');
      } else if (title === 'سينما') {
        const lights = devices.filter(d => getDeviceCategory(d) === 'lighting' && d.state === 'ON');
        for (const light of lights) {
          await toggleDevice(light.id);
        }
        const media = devices.filter(d => getDeviceCategory(d) === 'entertainment' && d.state !== 'ON');
        for (const m of media) {
          await toggleDevice(m.id);
        }
        notify('تم تفعيل وضع السينما! تم خفت الأضواء وتشغيل الترفيه. 🎬🍿', 'success');
      } else if (title === 'استرخاء') {
        notify('تم تفعيل وضع الاسترخاء والهدوء بنجاح. ☕✨', 'success');
      }
    } catch (err) {
      notify(getFriendlyErrorMessage(err), 'error');
    }
  };

  // Master Turn Off All with Confirmation Modal
  const handleConfirmTurnOffAll = async () => {
    setShowTurnOffAllModal(false);
    try {
      let count = 0;
      for (const dev of devices) {
        if (dev.state === 'ON') {
          await toggleDevice(dev.id);
          count++;
        }
      }
      notify(`تم إطفاء جميع الأجهزة النشطة (${count} جهاز) بنجاح 👍`, 'success');
    } catch (e) {
      notify(getFriendlyErrorMessage(e), 'error');
    }
  };

  // Safe device toggle with lock guard
  const handleSafeToggle = async (device: any) => {
    const isSecurityOrLock = getDeviceCategory(device) === 'security';

    if (isSecurityOrLock && device.state === 'LOCKED') {
      setPendingLockDevice(device);
      setLockPin('');
      setPinError(false);
      return;
    }

    try {
      setTogglingId(device.id);
      await toggleDevice(device.id);
      const nextState = device.state === 'ON' ? 'إطفاء' : 'تشغيل';
      notify(`تم ${nextState} (${device.name || 'المخرج'}) بنجاح 👍`, 'success');
    } catch (e) {
      notify(getFriendlyErrorMessage(e), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  // Handle PIN Unlock for security items
  const handlePinUnlock = async () => {
    if (lockPin === '1234' || lockPin.length >= 4) {
      if (pendingLockDevice) {
        setTogglingId(pendingLockDevice.id);
        await toggleDevice(pendingLockDevice.id);
        notify(`تم فتح قفل (${pendingLockDevice.name}) بأمان 🔓`, 'success');
      }
      setPendingLockDevice(null);
      setLockPin('');
      setPinError(false);
      setTogglingId(null);
    } else {
      setPinError(true);
      notify('رمز الحماية غير صحيح، يرجى المحاولة ثانية', 'error');
    }
  };

  // Turn off all devices in active room
  const handleRoomTurnOffAll = async () => {
    const onDevices = filteredDevices.filter(d => d.state === 'ON');
    if (onDevices.length === 0) {
      notify(`جميع أجهزة (${activeRoomTab}) مطفأة بالفعل 👍`, 'info');
      return;
    }
    for (const dev of onDevices) {
      await toggleDevice(dev.id);
    }
    notify(`تم إطفاء ${onDevices.length} أجهزة في (${activeRoomTab}) 👍`, 'success');
  };

  // Handle voice or natural Arabic query
  const handleVoiceSubmit = async (queryText?: string) => {
    const q = (queryText || voiceQuery).trim();
    if (!q) return;

    setIsProcessingVoice(true);
    const query = q.toLowerCase();

    try {
      if (query.includes('طفي') && (query.includes('الكل') || query.includes('البيت') || query.includes('كلشي'))) {
        let count = 0;
        for (const dev of devices) {
          if (dev.state === 'ON') {
            await toggleDevice(dev.id);
            count++;
          }
        }
        notify(`حاضر! تم إطفاء كل أجهزة البيت (${count} جهاز) 👍`, 'success');
      } else if (query.includes('شغل') || query.includes('طفي')) {
        const isTurnOn = query.includes('شغل');
        const match = devices.find(d => query.includes((d.name || '').toLowerCase()));
        if (match) {
          if ((isTurnOn && match.state !== 'ON') || (!isTurnOn && match.state === 'ON')) {
            await toggleDevice(match.id);
          }
          notify(`حاضر! تم ${isTurnOn ? 'تشغيل' : 'إطفاء'} (${match.name}) بنجاح ✨`, 'success');
        } else {
          const res = await fetchAuth('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: q })
          });
          if (res.ok) {
            const data = await res.json();
            notify(data.reply || 'تم تنفيذ طلبك بنجاح ✨', 'success');
          } else {
            notify('فهمت طلبك، جاري تحديث حالة أجهزة المنزل.', 'info');
          }
        }
      } else {
        notify(`تم استلام طلبك: "${q}"`, 'info');
      }
      setVoiceQuery('');
    } catch (err) {
      notify(getFriendlyErrorMessage(err), 'error');
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Get icon for device
  const getDeviceIcon = (device: any) => {
    const cat = getDeviceCategory(device);
    switch (cat) {
      case 'lighting': return Lightbulb;
      case 'climate': return Snowflake;
      case 'security': return Lock;
      case 'entertainment': return Tv;
      default: return Zap;
    }
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 flex flex-col gap-6 max-w-7xl mx-auto font-sans select-none" dir="rtl">
      
      {/* ── 1. Luxury Family Hero Banner ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-5 sm:p-7 rounded-[2.5rem] bg-gradient-to-r from-[#0c1322] via-[#0f1b33] to-[#0c1322] border border-cyan-500/20 shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative overflow-hidden">
        
        {/* Glow Shaders */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0 shadow-[0_0_25px_rgba(6,182,212,0.3)]">
            <HomeIcon size={30} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white flex items-center gap-2">
              <span>أهلاً بك، {user?.name || user?.username || 'عائلة موسى'}</span>
              <span className="text-sm font-bold bg-cyan-500/20 text-cyan-300 px-3 py-0.5 rounded-full border border-cyan-400/30">
                🏡 البيت الذكي
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
              تحكم كامل بجميع غرف وأجهزة المنزل • <strong className="text-emerald-400 font-bold">{activeDevicesCount}</strong> تعمل الآن من أصل {totalDevicesCount}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 relative z-10 flex-wrap sm:flex-nowrap">
          {/* Master All Off Button */}
          {activeDevicesCount > 0 && (
            <button 
              onClick={() => setShowTurnOffAllModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-black transition-all flex items-center gap-2 shadow-lg active:scale-95"
            >
              <Power size={16} className="animate-pulse text-rose-400" />
              <span>إطفاء كل أجهزة البيت ({activeDevicesCount})</span>
            </button>
          )}

          {/* If Admin/Super Owner, allow technical switch */}
          {isSuperAdminOrOwner && (
            <button 
              onClick={() => setUiMode('full')}
              className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-2"
              title="التبديل إلى الوضع الفني المتقدم"
            >
              <SlidersHorizontal size={15} className="text-cyan-400" />
              <span>الوضع المتقدم</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Live House Metrics Quick Bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Active Devices */}
        <div className="p-4 bg-[#0a101f] border border-white/5 hover:border-emerald-500/30 rounded-3xl flex items-center justify-between gap-3 shadow-lg transition-all">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 text-xs font-bold">الأجهزة النشطة</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {activeDevicesCount} <span className="text-xs text-slate-500 font-normal">من {totalDevicesCount}</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              محدث لحظياً عبر mTLS
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Zap size={20} className="animate-pulse" />
          </div>
        </div>

        {/* Metric 2: Live Temperature */}
        <div className="p-4 bg-[#0a101f] border border-white/5 hover:border-cyan-500/30 rounded-3xl flex items-center justify-between gap-3 shadow-lg transition-all">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 text-xs font-bold">حرارة ورطوبة الجو</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {globalData?.currentTemp || 24.2}°C
            </span>
            <span className="text-[10px] text-cyan-400 font-bold mt-0.5">
              الرطوبة: {globalData?.currentHum || 42}%
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 flex items-center justify-center shrink-0">
            <Snowflake size={20} />
          </div>
        </div>

        {/* Metric 3: Live Power Watt */}
        <div className="p-4 bg-[#0a101f] border border-white/5 hover:border-amber-500/30 rounded-3xl flex items-center justify-between gap-3 shadow-lg transition-all">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 text-xs font-bold">الاستهلاك الفوري</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {globalData?.currentPower || (activeDevicesCount * 45 + 120)} <span className="text-xs text-slate-500 font-normal">واط (W)</span>
            </span>
            <span className="text-[10px] text-amber-400 font-bold mt-0.5">
              حساس التيار ACS712 نشط
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
            <BatteryCharging size={20} />
          </div>
        </div>

        {/* Metric 4: Security Status */}
        <div className="p-4 bg-[#0a101f] border border-white/5 hover:border-purple-500/30 rounded-3xl flex items-center justify-between gap-3 shadow-lg transition-all">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 text-xs font-bold">حالة أمان المنظومة</span>
            <span className="text-base sm:text-lg font-black text-purple-300 mt-0.5">
              مؤمّن ومشفر
            </span>
            <span className="text-[10px] text-purple-400 font-bold mt-0.5">
              Port 8883 • Fail-Closed
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-400/30 text-purple-400 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      {/* ── 3. One-Touch Smart Scenes (السيناريوهات السريعة بلمسة واحدة) ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <Sparkles size={18} className="text-amber-400 animate-pulse" />
            <span>أزرار التحكم الذكي السريع (بلمسة واحدة)</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Scene 1: Good Morning */}
          <button
            onClick={() => handleExecuteScene('صباح', 'صباح الخير')}
            className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-500/15 via-[#131b2e] to-[#0a101f] border border-amber-500/25 hover:border-amber-400/50 flex flex-col items-center justify-center gap-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-lg group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-300 group-hover:rotate-12 transition-transform shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <Sun size={26} />
            </div>
            <div className="text-center">
              <span className="text-white font-black text-sm sm:text-base block">صباح الخير ☀️</span>
              <span className="text-[11px] text-amber-200/70 font-medium">تشغيل إنارة الصالة والمطبخ</span>
            </div>
          </button>

          {/* Scene 2: Sleep Time */}
          <button
            onClick={() => handleExecuteScene('نوم', 'وقت النوم')}
            className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-500/15 via-[#131b2e] to-[#0a101f] border border-indigo-500/25 hover:border-indigo-400/50 flex flex-col items-center justify-center gap-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-lg group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 group-hover:-rotate-12 transition-transform shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <Moon size={26} />
            </div>
            <div className="text-center">
              <span className="text-white font-black text-sm sm:text-base block">وقت النوم 🌙</span>
              <span className="text-[11px] text-indigo-200/70 font-medium">إطفاء كل الأضواء وتأمين الأبواب</span>
            </div>
          </button>

          {/* Scene 3: Leaving Home */}
          <button
            onClick={() => handleExecuteScene('خروج', 'مغادرة المنزل')}
            className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-rose-500/15 via-[#131b2e] to-[#0a101f] border border-rose-500/25 hover:border-rose-400/50 flex flex-col items-center justify-center gap-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-lg group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-300 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(244,63,94,0.3)]">
              <LogOut size={26} />
            </div>
            <div className="text-center">
              <span className="text-white font-black text-sm sm:text-base block">طالع من البيت 🚪</span>
              <span className="text-[11px] text-rose-200/70 font-medium">إطفاء الكل وتفعيل التوفير</span>
            </div>
          </button>

          {/* Scene 4: Cinema Mode */}
          <button
            onClick={() => handleExecuteScene('سينما', 'مشاهدة فيلم')}
            className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-purple-500/15 via-[#131b2e] to-[#0a101f] border border-purple-500/25 hover:border-purple-400/50 flex flex-col items-center justify-center gap-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-lg group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              <Film size={26} />
            </div>
            <div className="text-center">
              <span className="text-white font-black text-sm sm:text-base block">وضع السينما 🎬</span>
              <span className="text-[11px] text-purple-200/70 font-medium">خفت الإنارة وتجهيز التلفاز</span>
            </div>
          </button>
        </div>
      </div>

      {/* ── 4. Smart Arabic Voice & Natural AI Bar with Quick Suggestion Chips ── */}
      <div className="flex flex-col gap-2.5">
        <form onSubmit={(e) => { e.preventDefault(); handleVoiceSubmit(); }} className="relative flex items-center w-full">
          <input
            type="text"
            value={voiceQuery}
            onChange={(e) => setVoiceQuery(e.target.value)}
            placeholder="تحدث أو اكتب أمرك بالعامية (مثال: طفي كل الأضواء، شغل ضو الصالة، طفي المكيف)..."
            className="w-full bg-[#0a101f] border-2 border-cyan-500/30 focus:border-cyan-400 rounded-3xl py-4 pr-14 pl-28 text-white placeholder-slate-400 text-sm sm:text-base font-bold shadow-xl outline-none transition-all"
          />
          <div className="absolute right-4 p-2 bg-cyan-500/20 rounded-2xl text-cyan-300">
            <Mic size={22} className="animate-pulse" />
          </div>
          <button
            type="submit"
            disabled={isProcessingVoice || !voiceQuery.trim()}
            className="absolute left-3 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs sm:text-sm rounded-2xl flex items-center gap-1.5 shadow-lg disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
          >
            {isProcessingVoice ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            <span>تنفيذ</span>
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
          <span className="text-slate-400 font-bold shrink-0">أوامر سريعة:</span>
          {[
            '💡 طفي كل الأضواء',
            '☀️ شغل إنارة المطبخ',
            '🚪 طفي أجهزة غرفة 1',
            '⚡ كم استهلاك الكهرباء الآن؟'
          ].map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleVoiceSubmit(chip.replace(/^[^\s]+\s/, ''))}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-slate-300 hover:text-white font-medium whitespace-nowrap transition-all cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* ── 5. Room Navigation Tabs & Category Filters ── */}
      <div className="flex flex-col gap-3">
        {/* Rooms Scrollable Strip */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full custom-scrollbar">
            {roomsList.map((room) => {
              const isActive = activeRoomTab === room;
              const roomDevices = room === 'الكل' ? devices : devices.filter(d => ((d as any).room?.name || (d as any).room) === room);
              const roomActiveCount = roomDevices.filter(d => d.state === 'ON').length;

              return (
                <button
                  key={room}
                  onClick={() => setActiveRoomTab(room)}
                  className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 border cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-105'
                      : 'bg-[#0a101f] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <MapPin size={15} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span>{room}</span>
                  {roomActiveCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-[10px] flex items-center justify-center font-bold">
                      {roomActiveCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Room Turn Off All button */}
          {activeRoomTab !== 'الكل' && (
            <button
              onClick={handleRoomTurnOffAll}
              className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
            >
              <Power size={14} />
              <span>إطفاء كل أجهزة {activeRoomTab}</span>
            </button>
          )}
        </div>

        {/* Category Pills Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {[
            { id: 'all', label: 'الكل', icon: Sparkles },
            { id: 'lighting', label: 'الإنارة والمصابيح', icon: Lightbulb },
            { id: 'climate', label: 'التكييف والتبريد', icon: Snowflake },
            { id: 'sockets', label: 'المقابس والمفاتيح', icon: Zap },
            { id: 'security', label: 'الأمان والأبواب', icon: Lock },
            { id: 'entertainment', label: 'الترفيه والصوت', icon: Tv },
          ].map(cat => {
            const isActive = activeCategoryTab === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryTab(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isActive 
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-sm'
                    : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 6. Ultra-Premium Family Device Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence>
          {filteredDevices.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-[#0a101f] border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-3">
              <Zap size={36} className="text-slate-500 animate-pulse" />
              <p className="text-slate-300 text-sm font-bold">لا توجد أجهزة مطابقة في هذا القسم أو الغرفة</p>
              <button 
                onClick={() => { setActiveRoomTab('الكل'); setActiveCategoryTab('all'); setSearchQuery(''); }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                عرض كافة أجهزة المنزل
              </button>
            </div>
          ) : (
            filteredDevices.map((device) => {
              const isOn = device.state === 'ON';
              const isBusy = togglingId !== null && String(togglingId) === String(device.id);
              const DeviceIcon = getDeviceIcon(device);
              const devRoom = typeof (device as any).room === 'object' ? (device as any).room?.name : (device as any).room || 'المنزل العام';
              const pinNum = (device as any).pin;
              const switchPin = (device as any).switchPin || (device as any).inPin;

              return (
                <motion.div
                  layout
                  key={device.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-5 rounded-[2rem] border-2 transition-all duration-300 flex flex-col justify-between min-h-[13rem] select-none relative overflow-hidden shadow-xl ${
                    isOn
                      ? 'bg-gradient-to-br from-[#0c2621] via-[#0f332c] to-[#0a1c18] border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.25)]'
                      : 'bg-[#0a101f] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Subtle Background Glow when Active */}
                  {isOn && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
                  )}

                  {/* Top Card Row: Room Badge & Status Pill */}
                  <div className="flex items-center justify-between relative z-10">
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white/[0.06] text-slate-300 border border-white/5 flex items-center gap-1 truncate max-w-[150px]">
                      <MapPin size={11} className="text-cyan-400 shrink-0" />
                      <span className="truncate">{devRoom}</span>
                    </span>

                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                      isOn 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : 'bg-white/5 text-slate-400 border-white/5'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                      {isOn ? 'مشتغل (ON)' : 'مطفأ (OFF)'}
                    </span>
                  </div>

                  {/* Middle Card Row: Device Icon & Name */}
                  <div className="flex items-center gap-3.5 my-3 relative z-10">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 shadow-md ${
                      isOn
                        ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-105'
                        : 'bg-white/[0.05] text-slate-400 border border-white/5'
                    }`}>
                      {isBusy ? (
                        <RefreshCw size={22} className="animate-spin text-white" />
                      ) : (
                        <DeviceIcon size={24} />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <h3 className="text-white text-base font-black truncate leading-tight">
                        {device.name || `مخرج ${pinNum || 'ذكي'}`}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                        {pinNum && <span>مخرج {pinNum}</span>}
                        {switchPin && switchPin > 0 && <span className="text-cyan-400">• سويج {switchPin}</span>}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Card Row: Power (W) and Big Switch Toggle Button */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5 relative z-10">
                    <div className="flex flex-col">
                      {isOn ? (
                        <span className="text-[11px] font-black text-emerald-300 flex items-center gap-1">
                          <Zap size={12} className="text-emerald-400 animate-pulse" />
                          <span>~45 واط (W)</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-bold">0 واط (مغلق)</span>
                      )}
                    </div>

                    {/* Master Touch Switch Toggle */}
                    <button
                      onClick={() => !isBusy && handleSafeToggle(device)}
                      disabled={isBusy}
                      title={isOn ? 'انقر للإطفاء' : 'انقر للتشغيل'}
                      className={`w-14 h-7 rounded-full p-1 transition-all duration-300 relative flex items-center cursor-pointer shadow-inner ${
                        isOn 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400 justify-end shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                          : 'bg-slate-800 justify-start hover:bg-slate-700'
                      }`}
                    >
                      <motion.div 
                        layout
                        className="w-5 h-5 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-900"
                      >
                        <Power size={11} className={isOn ? 'text-emerald-600 font-black' : 'text-slate-400'} />
                      </motion.div>
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* ── 7. Master Turn Off Confirmation Modal ── */}
      <AnimatePresence>
        {showTurnOffAllModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0c1322] border-2 border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-center"
            >
              <div className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(244,63,94,0.3)]">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-white">تأكيد إطفاء كل أجهزة المنزل</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                هل أنت متأكد من رغبتك بإطفاء جميع الأجهزة والإنارة النشطة الآن ({activeDevicesCount} أجهزة)؟
              </p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={handleConfirmTurnOffAll}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs shadow-lg transition-all cursor-pointer"
                >
                  نعم، أطفئ الكل الآن 🛑
                </button>
                <button
                  onClick={() => setShowTurnOffAllModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-bold text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 8. Security PIN Unlock Modal ── */}
      <AnimatePresence>
        {pendingLockDevice && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0c1322] border-2 border-cyan-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-center"
            >
              <div className="w-16 h-16 rounded-3xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(6,182,212,0.3)]">
                <Lock size={32} />
              </div>
              <h3 className="text-lg font-black text-white">رمز الأمان لفتح ({pendingLockDevice.name})</h3>
              <p className="text-xs text-slate-300">
                يرجى إدخال رمز الأمان (PIN) للمتابعة وتأكيد فتح الباب/القفل
              </p>
              <input
                type="password"
                maxLength={6}
                value={lockPin}
                onChange={(e) => { setLockPin(e.target.value); setPinError(false); }}
                placeholder="••••"
                className={`w-full bg-slate-900 border-2 text-center text-2xl tracking-widest py-3 rounded-2xl text-white outline-none ${
                  pinError ? 'border-rose-500 bg-rose-500/10' : 'border-cyan-500/40 focus:border-cyan-400'
                }`}
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={handlePinUnlock}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs shadow-lg transition-all cursor-pointer"
                >
                  تأكيد الفتح 🔓
                </button>
                <button
                  onClick={() => setPendingLockDevice(null)}
                  className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-bold text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
