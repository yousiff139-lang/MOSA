'use client';

import React, { useState } from 'react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import { notify } from '@/store/useConfirmStore';
import { GlassCard } from '../ui/GlassCard';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import {
  Lightbulb,
  Zap,
  Fan,
  Tv,
  MapPin,
  X,
  Check,
  Grid,
  Leaf,
  Power,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Settings2,
  Edit3,
  Plug,
  Lock,
  Unlock,
  Snowflake,
  Sprout,
  Camera,
  Droplets,
  Thermometer,
  Flame,
  Bell,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Pin,
  RotateCcw,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '@/lib/api';

const getRoomName = (room: any): string => {
  if (!room) return '';
  if (typeof room === 'object' && room.name) return String(room.name);
  if (typeof room === 'string') return room;
  return '';
};

export function DeviceGrid({ selectedRoomFilter }: { selectedRoomFilter?: string }) {
  const devices = useSmartHomeStore(state => state.devices);
  const storeRooms = useSmartHomeStore(state => state.rooms);
  const toggleDevice = useSmartHomeStore(state => state.toggleDevice);
  const isConnected = useSmartHomeStore(state => state.isConnected);
  const isEdgeMode = useSmartHomeStore(state => state.isEdgeMode);
  const toggleEdgeMode = useSmartHomeStore(state => state.toggleEdgeMode);
  const lang = useRuntimeStore(state => state.lang);
  const isEn = lang === 'en';

  const [activeTab, setActiveTab] = useState<string>('الكل');
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [customDeviceName, setCustomDeviceName] = useState<string>('');
  const [customDeviceType, setCustomDeviceType] = useState<string>('LIGHT');
  const [customRoomName, setCustomRoomName] = useState<string>('');
  const [customPin, setCustomPin] = useState<number | string>('');
  const [customSwitchPin, setCustomSwitchPin] = useState<number | string>('');
  const [customActiveState, setCustomActiveState] = useState<string>('HIGH');
  const [customSwitchMode, setCustomSwitchMode] = useState<string>('GND');

  // Dynamically extract real room names from PostgreSQL store & devices
  const realRoomNames = Array.from(new Set([
    ...((storeRooms || []) as any[]).map(r => r.name),
    ...devices.map(d => getRoomName((d as any).room)).filter(Boolean)
  ])).filter(name => name && name !== 'unassigned');

  const dynamicRoomOptions = ['الكل', ...realRoomNames];
  const currentFilter = selectedRoomFilter || activeTab;

  const getDeviceIcon = (type: string, isOn: boolean) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'RGB':
        return (
          <Sparkles
            className={`transition-all duration-300 ${
              isOn
                ? 'text-fuchsia-300 drop-shadow-[0_0_16px_rgba(217,70,239,0.9)] animate-pulse stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
            size={26}
          />
        );
      case 'CURTAIN':
        return (
          <Sliders
            className={`transition-all duration-300 ${
              isOn
                ? 'text-indigo-300 drop-shadow-[0_0_16px_rgba(99,102,241,0.9)] stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
            size={26}
          />
        );
      case 'LOCK':
        return isOn ? (
          <Unlock className="text-emerald-400 drop-shadow-[0_0_16px_rgba(16,185,129,0.9)] stroke-[2.5]" size={26} />
        ) : (
          <Lock className="text-rose-400 drop-shadow-[0_0_16px_rgba(244,63,94,0.9)] stroke-[2.5]" size={26} />
        );
      case 'CLIMATE':
      case 'AC':
        return (
          <Snowflake
            className={`transition-all duration-300 ${
              isOn
                ? 'text-sky-300 animate-spin drop-shadow-[0_0_16px_rgba(56,189,248,0.9)] stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
            size={26}
          />
        );
      case 'PUMP':
        return (
          <Sprout
            className={`transition-all duration-300 ${
              isOn
                ? 'text-emerald-300 drop-shadow-[0_0_16px_rgba(16,185,129,0.9)] animate-bounce stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
            size={26}
          />
        );
      case 'SOCKET':
        return (
          <Plug
            className={`transition-all duration-300 ${
              isOn
                ? 'text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,0.9)] stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
            size={26}
          />
        );
      case 'FAN':
        return (
          <Fan
            className={`transition-all duration-300 ${
              isOn
                ? 'text-teal-300 animate-spin drop-shadow-[0_0_16px_rgba(45,212,191,0.9)]'
                : 'text-slate-500'
            }`}
            size={26}
          />
        );
      case 'CAMERA':
        return <Camera className="text-blue-400 drop-shadow-[0_0_14px_rgba(59,130,246,0.9)]" size={26} />;
      case 'ENERGY':
        return <Zap className="text-amber-400 drop-shadow-[0_0_14px_rgba(245,158,11,0.9)]" size={26} />;
      case 'MOISTURE':
        return <Droplets className="text-teal-400 drop-shadow-[0_0_14px_rgba(20,184,166,0.9)]" size={26} />;
      case 'TEMPERATURE':
        return <Thermometer className="text-cyan-400 drop-shadow-[0_0_14px_rgba(6,182,212,0.9)]" size={26} />;
      case 'HEATER':
        return <Flame className={`transition-all duration-300 ${isOn ? 'text-orange-400 animate-pulse' : 'text-slate-500'}`} size={26} />;
      case 'SIREN':
        return <Bell className={`transition-all duration-300 ${isOn ? 'text-rose-400 animate-bounce' : 'text-slate-500'}`} size={26} />;
      case 'TV':
        return (
          <Tv
            className={`transition-all duration-300 ${
              isOn ? 'text-purple-300 drop-shadow-[0_0_16px_rgba(192,132,252,0.9)]' : 'text-slate-500'
            }`}
            size={26}
          />
        );
      case 'LIGHT':
      default:
        return (
          <Lightbulb
            className={`transition-all duration-300 ${
              isOn
                ? 'text-cyan-300 drop-shadow-[0_0_16px_rgba(34,211,238,0.9)] stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
            size={26}
          />
        );
    }
  };

  // Exclude telemetry sensors
  const isSensor = (d: any) => {
    const t = (d.type || '').toLowerCase();
    const n = (d.name || '').toLowerCase();
    return (
      t.includes('sensor') ||
      t.includes('energy') ||
      t.includes('power') ||
      t.includes('temp') ||
      t.includes('moisture') ||
      t.includes('humidity') ||
      n.includes('حساس') ||
      n.includes('طاق') ||
      n.includes('تيار') ||
      n.includes('أمبير') ||
      n.includes('فولت') ||
      n.includes('حرار') ||
      n.includes('رطوب')
    );
  };

  const displayDevices = devices.filter(d => !isSensor(d));

  // ── 1. User Custom Order & Hidden Devices (إخفاء وترتيب الأجهزة) ──
  const [customDeviceOrder, setCustomDeviceOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('user_dashboard_device_custom_order') || '[]');
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [hiddenDeviceIds, setHiddenDeviceIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('user_dashboard_hidden_device_ids');
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return [];
  });

  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [customizeSearch, setCustomizeSearch] = useState('');

  // Hide single device from home page
  const hideDeviceFromHome = (devId: string | number, devName?: string) => {
    const idStr = String(devId);
    const next = [...new Set([...hiddenDeviceIds, idStr])];
    setHiddenDeviceIds(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('user_dashboard_hidden_device_ids', JSON.stringify(next));
      } catch (e) {}
    }
    notify(`تم إخفاء "${devName || 'الجهاز'}" من الرئيسية 🙈 (يمكنك استعادته من زر تخصيص الأجهزة)`, 'info');
  };

  // Show single device on home page
  const showDeviceOnHome = (devId: string | number, devName?: string) => {
    const idStr = String(devId);
    const next = hiddenDeviceIds.filter(id => id !== idStr);
    setHiddenDeviceIds(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('user_dashboard_hidden_device_ids', JSON.stringify(next));
      } catch (e) {}
    }
    notify(`تم إظهار "${devName || 'الجهاز'}" في الصفحة الرئيسية 👁️`, 'success');
  };

  // Toggle visibility in customize modal
  const toggleDeviceVisibility = (devId: string | number, devName?: string) => {
    const idStr = String(devId);
    if (hiddenDeviceIds.includes(idStr)) {
      showDeviceOnHome(idStr, devName);
    } else {
      hideDeviceFromHome(idStr, devName);
    }
  };

  const showAllDevices = () => {
    setHiddenDeviceIds([]);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_dashboard_hidden_device_ids', JSON.stringify([]));
    }
    notify('تم إظهار جميع الأجهزة في الصفحة الرئيسية بنجاح! 👁️', 'success');
  };

  const hideAllDevices = () => {
    const allIds = displayDevices.map(d => String(d.id));
    setHiddenDeviceIds(allIds);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_dashboard_hidden_device_ids', JSON.stringify(allIds));
    }
    notify('تم إخفاء جميع الأجهزة من الصفحة الرئيسية', 'info');
  };

  // Reorder single device (move up, down, or pin to top)
  const moveDeviceInOrder = (devId: string | number, direction: 'up' | 'down' | 'top') => {
    const idStr = String(devId);
    const list = [...displayDevices].sort((a, b) => {
      if (customDeviceOrder.length > 0) {
        const idxA = customDeviceOrder.indexOf(String(a.id));
        const idxB = customDeviceOrder.indexOf(String(b.id));
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      const pinA = Number(a.pin ?? (a as any).pinNumber ?? 0);
      const pinB = Number(b.pin ?? (b as any).pinNumber ?? 0);
      if (pinA !== pinB) return pinA - pinB;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

    const index = list.findIndex(d => String(d.id) === idStr);
    if (index === -1) return;

    if (direction === 'top') {
      const [item] = list.splice(index, 1);
      list.unshift(item);
    } else if (direction === 'up') {
      if (index === 0) return;
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
    } else if (direction === 'down') {
      if (index === list.length - 1) return;
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
    }

    const newOrder = list.map(d => String(d.id));
    setCustomDeviceOrder(newOrder);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('user_dashboard_device_custom_order', JSON.stringify(newOrder));
      } catch (e) {}
    }
  };

  const resetDeviceOrder = () => {
    setCustomDeviceOrder([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_dashboard_device_custom_order');
    }
    notify('تمت إعادة ضبط الترتيب التلقائي حسب أرقام المخارج والغرف 🔄', 'info');
  };

  // Devices visible on Home page (not hidden)
  const visibleDevices = displayDevices.filter(d => !hiddenDeviceIds.includes(String(d.id)));

  // Filter and sort devices deterministically
  const filteredDevices = visibleDevices
    .filter(d => {
      if (currentFilter === 'الكل' || currentFilter === 'All') return true;
      const roomName = getRoomName((d as any).room);
      return (
        roomName.toLowerCase().includes(currentFilter.toLowerCase()) ||
        currentFilter.toLowerCase().includes(roomName.toLowerCase())
      );
    })
    .sort((a, b) => {
      if (customDeviceOrder.length > 0) {
        const idxA = customDeviceOrder.indexOf(String(a.id));
        const idxB = customDeviceOrder.indexOf(String(b.id));
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      const pinA = Number(a.pin ?? (a as any).pinNumber ?? 0);
      const pinB = Number(b.pin ?? (b as any).pinNumber ?? 0);
      if (pinA !== pinB) return pinA - pinB;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

  // All devices sorted for the customize modal
  const allModalSortedDevices = [...displayDevices]
    .sort((a, b) => {
      if (customDeviceOrder.length > 0) {
        const idxA = customDeviceOrder.indexOf(String(a.id));
        const idxB = customDeviceOrder.indexOf(String(b.id));
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      const pinA = Number(a.pin ?? (a as any).pinNumber ?? 0);
      const pinB = Number(b.pin ?? (b as any).pinNumber ?? 0);
      if (pinA !== pinB) return pinA - pinB;
      return String(a.id || '').localeCompare(String(b.id || ''));
    })
    .filter(d => {
      if (!customizeSearch.trim()) return true;
      const q = customizeSearch.toLowerCase();
      const r = getRoomName((d as any).room).toLowerCase();
      const n = (d.name || '').toLowerCase();
      return n.includes(q) || r.includes(q);
    });

  // Pagination state for handling 50+ devices smoothly without infinite vertical scrolling
  const [pageSize, setPageSize] = useState<number>(24);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredDevices.length / pageSize) || 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedDevices = pageSize === -1
    ? filteredDevices 
    : filteredDevices.slice((safePage - 1) * pageSize, safePage * pageSize);

  const moveDeviceOrder = (devId: string | number, direction: 'prev' | 'next') => {
    moveDeviceInOrder(devId, direction === 'prev' ? 'up' : 'down');
  };

  const openEditModal = (dev: any) => {
    setEditingDevice(dev);
    setCustomDeviceName(dev.name || '');
    setCustomDeviceType((dev.type || 'LIGHT').toUpperCase());
    setCustomRoomName(getRoomName(dev.room) || 'المطبخ');
    setCustomPin(dev.pin ?? dev.pinNumber ?? 4);
    const swPin = dev.switchPin ?? dev.inPin ?? dev.inpin;
    setCustomSwitchPin(swPin !== undefined && swPin !== null && swPin !== -1 ? swPin : '');
    setCustomActiveState(dev.activeState || dev.stateObj?.activeState || 'HIGH');
    setCustomSwitchMode(dev.switchMode || dev.stateObj?.switchMode || 'GND');
  };

  const handleSaveDeviceEdit = async () => {
    if (!editingDevice) return;
    try {
      const res = await fetchWithAuth(`/api/devices/${editingDevice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customDeviceName.trim() || editingDevice.name,
          type: customDeviceType,
          roomName: customRoomName.trim() || 'المطبخ',
          pinNumber: Number(customPin),
          switchPin: customSwitchPin !== '' ? Number(customSwitchPin) : null,
          inPin: customSwitchPin !== '' ? Number(customSwitchPin) : null,
          activeState: customActiveState,
          switchMode: customSwitchMode
        })
      });
      if (res.ok) {
        useSmartHomeStore.getState().initBackendConnection();
        notify('تم حفظ تعديلات الجهاز بنجاح! ✓', 'success');
      }
    } catch (e) {
      console.error(e);
      notify('حدث خطأ أثناء حفظ الجهاز', 'error');
    } finally {
      setEditingDevice(null);
    }
  };

  const activeCount = filteredDevices.filter(d => d.state === 'ON').length;

  return (
    <div className="w-full flex flex-col gap-5" dir={isEn ? 'ltr' : 'rtl'}>
      {/* ── 1. Top Control Bar: Energy Saver Switch & Room Filter Pills ── */}
      <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950/90 p-3.5 md:p-4 rounded-3xl border border-white/10 backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Left: Room Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 max-w-full">
          {dynamicRoomOptions.map(room => {
            const isSelected = activeTab === room;
            return (
              <button
                key={room}
                onClick={() => setActiveTab(room)}
                className={`px-4 py-2 rounded-2xl font-bold text-xs transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_18px_rgba(6,182,212,0.4)] font-black scale-[1.03]'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                <span>{room === 'الكل' && isEn ? 'All Sockets' : room}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Energy Saver Button + Customize */}
        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 flex-wrap">
          {/* ⚡ Energy Saver (AI Eco Mode) Switch */}
          <div
            onClick={toggleEdgeMode}
            className={`cursor-pointer px-3.5 py-2 rounded-2xl border transition-all flex items-center gap-2.5 select-none ${
              isEdgeMode
                ? 'bg-emerald-500/15 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.25)] text-emerald-300'
                : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200'
            }`}
            title="تفعيل أو إيقاف وضع توفير الطاقة الذكي لتقليل الاستهلاك وحماية الأحمال"
          >
            <div className={`p-1.5 rounded-xl border ${isEdgeMode ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
              <Leaf size={14} className={isEdgeMode ? 'animate-pulse' : ''} />
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black leading-none">
                  {isEn ? 'Eco Saver' : 'توفير الطاقة'}
                </span>
                <span className={`w-2 h-2 rounded-full ${isEdgeMode ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-600'}`} />
              </div>
              <span className="text-[10px] font-mono block text-slate-400 mt-0.5">
                {isEdgeMode ? (isEn ? 'Active (-28%)' : 'نشط ⚡ (توفير 28%)') : (isEn ? 'Disabled' : 'متوقف')}
              </span>
            </div>
          </div>

          {/* Quick Customize Modal Trigger with count badge */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsCustomizeModalOpen(true);
            }}
            className="px-3.5 py-2 bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/50 hover:to-blue-600/50 text-cyan-300 hover:text-white border border-cyan-400/40 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/30 cursor-pointer active:scale-95 select-none relative z-10"
            title="تخصيص وترتيب وإخفاء الأجهزة في الصفحة الرئيسية"
          >
            <Settings2 size={15} className="text-cyan-400 animate-spin-slow" />
            <span>{isEn ? 'Customize & Reorder' : 'تخصيص وترتيب الأجهزة'}</span>
            {hiddenDeviceIds.length > 0 && (
              <span className="bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                {displayDevices.length - hiddenDeviceIds.length}/{displayDevices.length}
              </span>
            )}
          </button>

          {/* Active Counters Badge */}
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 bg-black/40 px-3 py-2 rounded-2xl border border-white/5">
            <Grid size={14} className="text-cyan-400" />
            <span>{filteredDevices.length}</span>
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px]">
              {activeCount} {isEn ? 'ON' : 'شغال'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Responsive Sleek Device & Lamp Cards Grid ── */}
      {filteredDevices.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-slate-900/40 border border-dashed border-white/10 rounded-3xl space-y-3">
          <p className="text-slate-400 text-sm font-bold">
            {isEn 
              ? 'No devices visible on Home. Click "Customize & Reorder" to show devices.' 
              : 'لا توجد أجهزة معروضة حالياً في الرئيسية (قد تكون مخفية).'}
          </p>
          <button
            onClick={() => setIsCustomizeModalOpen(true)}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl transition shadow-lg inline-flex items-center gap-1.5"
          >
            <Eye size={14} />
            <span>{isEn ? 'Open Device Manager' : 'فتح مدير الأجهزة وإظهارها'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {paginatedDevices.map((device, i) => {
            const isOn = device.state === 'ON';
            const isOffline = (device as any).isConnected === false;
            const currentRoomName = getRoomName((device as any).room);

            return (
              <motion.div
                key={device.id}
                layout
                transition={{ duration: 0.2 }}
                className="relative group"
              >
                <div
                  className={`relative p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl min-h-[135px] sm:min-h-[155px] flex flex-col justify-between transition-all duration-300 overflow-hidden border ${
                    isOffline
                      ? 'border-rose-500/20 bg-rose-950/20 opacity-75'
                      : isOn
                      ? 'border-cyan-400/40 bg-[#0d1c33] shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                      : 'border-slate-800 bg-[#0c1324] hover:bg-[#0f1930] shadow-md'
                  }`}
                >
                  {/* Active Neon Ambient Glow Highlight */}
                  {isOn && !isOffline && (
                    <div className="absolute -top-10 -right-10 w-28 h-28 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none animate-pulse" />
                  )}

                  {/* Card Top Section: Interactive Lamp Orb & Power Switch */}
                  <div className="flex items-center justify-between gap-3 relative z-10">
                    
                    {/* Interactive Clickable Lamp Button + Title */}
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        disabled={isOffline}
                        onClick={() => !isOffline && toggleDevice(device.id.toString())}
                        className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center border transition-all duration-300 group-hover:scale-105 active:scale-95 select-none shrink-0 ${
                          isOffline
                            ? 'bg-slate-800/40 border-slate-700/40 text-slate-600 cursor-not-allowed'
                            : isOn
                            ? 'bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)] ring-2 ring-cyan-400/20'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                        }`}
                        title={isOn ? 'اضغط للإطفاء' : 'اضغط للتشغيل'}
                      >
                        {getDeviceIcon(device.type, isOn)}
                        
                        {/* Luminous Core Ring on Lamp */}
                        {isOn && !isOffline && (
                          <span className="absolute inset-0 rounded-xl sm:rounded-2xl border border-cyan-300/40 animate-ping pointer-events-none opacity-40" />
                        )}
                      </button>

                      {/* Device Title & Location */}
                      <div className="min-w-0">
                        <span className="text-white font-bold text-sm block leading-tight truncate">
                          {device.name}
                        </span>
                        <button
                          onClick={() => openEditModal(device)}
                          className="text-[11px] text-cyan-400/90 hover:text-cyan-300 font-medium flex items-center gap-1 mt-0.5 transition-colors group/loc"
                          title={isEn ? 'Edit Location / Room' : 'تعديل مكان وتسمية المقبس'}
                        >
                          <MapPin size={10} className="text-cyan-400 shrink-0" />
                          <span className="truncate">{currentRoomName || (isEn ? 'Unassigned' : 'المطبخ')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Right: Upgraded High-Tech Power Switch */}
                    <ToggleSwitch
                      checked={isOn}
                      onChange={() => !isOffline && toggleDevice(device.id.toString())}
                      disabled={isOffline}
                      className="shrink-0"
                    />
                  </div>

                  {/* Card Bottom Bar: Status Badge & Reordering / Hide Controls */}
                  <div className="border-t border-white/5 pt-2.5 mt-3 flex items-center justify-between text-[11px] relative z-10 flex-wrap gap-2">
                    {/* Status Indicator */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all ${
                          isOffline
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isOn
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_8px_rgba(6,182,212,0.2)] font-black'
                            : 'bg-slate-800/80 text-slate-400 border border-white/5'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOffline ? 'bg-rose-400' : isOn ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'
                          }`}
                        />
                        {isOffline
                          ? isEn ? 'Offline' : 'غير متصل'
                          : isOn
                          ? isEn ? 'ON' : 'شغال'
                          : isEn ? 'OFF' : 'مطفأ'}
                      </span>
                    </div>

                    {/* Quick Card Controls: Hide 🙈 + Move ◀ ▶ + Pin 📌 + Edit ⚙️ */}
                    <div className="flex items-center gap-1">
                      {/* Hide Device From Home Button */}
                      <button
                        onClick={() => hideDeviceFromHome(device.id, device.name)}
                        className="p-1.5 bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-xl border border-white/5 hover:border-rose-500/30 transition-all cursor-pointer"
                        title={isEn ? 'Hide from Home' : 'إخفاء هذا الجهاز من الرئيسية 🙈'}
                      >
                        <EyeOff size={12} />
                      </button>

                      {/* Pin to Top Button */}
                      <button
                        onClick={() => {
                          moveDeviceInOrder(device.id, 'top');
                          notify(`تم تثبيت "${device.name}" في بداية القائمة 📌`, 'success');
                        }}
                        className="p-1.5 bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 rounded-xl border border-white/5 hover:border-amber-500/30 transition-all cursor-pointer"
                        title={isEn ? 'Pin to top' : 'تثبيت في البداية 📌'}
                      >
                        <Pin size={12} />
                      </button>

                      {/* Shift Order Position Buttons */}
                      <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-0.5">
                        <button
                          onClick={() => moveDeviceOrder(device.id, 'prev')}
                          disabled={i === 0 && safePage === 1}
                          className="px-1.5 py-0.5 hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-20 rounded-lg transition-colors text-[10px] cursor-pointer"
                          title="تقديم الترتيب للأول"
                        >
                          ◀
                        </button>
                        <button
                          onClick={() => moveDeviceOrder(device.id, 'next')}
                          disabled={i === paginatedDevices.length - 1 && safePage === totalPages}
                          className="px-1.5 py-0.5 hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-20 rounded-lg transition-colors text-[10px] cursor-pointer"
                          title="تأخير الترتيب للآخر"
                        >
                          ▶
                        </button>
                      </div>

                      {/* Edit Device Button */}
                      <button
                        onClick={() => openEditModal(device)}
                        className="px-2.5 py-1 bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 rounded-xl text-[10px] font-bold border border-white/10 hover:border-cyan-500/30 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={11} className="text-cyan-400" />
                        <span>تعديل</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── 2.5 Sleek Pagination Controls Toolbar (Handles Scale for 50+ Devices) ── */}
      {filteredDevices.length > 12 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-900/60 border border-white/10 rounded-2xl backdrop-blur-xl mt-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
            <span>عرض {paginatedDevices.length} من أصل {filteredDevices.length} جهازاً</span>
            <span>•</span>
            <span>الصفحة {safePage} من {totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Page Size Selector */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value={12}>12 جهاز / صفحة</option>
              <option value={24}>24 جهاز / صفحة</option>
              <option value={48}>48 جهاز / صفحة</option>
              <option value={-1}>عرض الكل دفعة واحدة</option>
            </select>

            {/* Pagination Step Buttons */}
            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1"
                >
                  <ChevronRight size={14} />
                  <span>السابق</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .map((p, idx, arr) => {
                      const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && <span className="text-slate-600 text-xs">...</span>}
                          <button
                            onClick={() => setCurrentPage(p)}
                            className={`w-8 h-8 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              p === safePage
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>التالي</span>
                  <ChevronLeft size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Edit Device Modal ── */}
      <AnimatePresence>
        {editingDevice && (
          <motion.div
            key="edit-device-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-[#0b101d] border-0 sm:border sm:border-white/10 sm:rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 h-full sm:h-auto flex flex-col justify-between overflow-y-auto"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Settings2 size={18} className="text-cyan-400" />
                    <span>تعديل بيانات الجهاز والمخرج</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingDevice(null)}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 text-xs mt-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">اسم الجهاز / المخرج:</label>
                    <input
                      type="text"
                      value={customDeviceName}
                      onChange={e => setCustomDeviceName(e.target.value)}
                      className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">نوع الجهاز والمهمة:</label>
                    <select
                      value={customDeviceType.toUpperCase()}
                      onChange={e => setCustomDeviceType(e.target.value)}
                      className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="LIGHT">💡 إنارة (Light)</option>
                      <option value="RGB">🌈 إضاءة ملونة (RGB Strip)</option>
                      <option value="CURTAIN">🪟 ستائر ذكية (Smart Curtain)</option>
                      <option value="SOCKET">🔌 مقبس / فيشة (Socket/Relay)</option>
                      <option value="LOCK">🔒 قفل باب كهربائي (Electric Lock)</option>
                      <option value="CAMERA">📷 كاميرا مراقبة (IP Camera/DVR)</option>
                      <option value="PUMP">🌱 مضخة ري (Irrigation Pump)</option>
                      <option value="MOISTURE">💧 حساس رطوبة التربة (Soil Moisture)</option>
                      <option value="CLIMATE">❄️ تكييف (AC)</option>
                      <option value="ENERGY">⚡ مقياس كهرباء (Energy Meter)</option>
                      <option value="TEMPERATURE">🌡️ حساس حرارة ورطوبة (Temp & Hum)</option>
                      <option value="FAN">🌀 مروحة / تهوية (Fan)</option>
                      <option value="HEATER">♨️ سخان كهربائي (Water Heater)</option>
                      <option value="SIREN">🚨 صفارة إنذار (Alarm Siren)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">اسم الغرفة / المكان:</label>
                    <input
                      type="text"
                      value={customRoomName}
                      onChange={e => setCustomRoomName(e.target.value)}
                      placeholder="مثلاً: المطبخ، الصالة، غرفة النوم..."
                      className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">طرف الريليه (Relay GPIO):</label>
                      <input
                        type="number"
                        value={customPin}
                        onChange={e => setCustomPin(e.target.value)}
                        className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">طرف المفتاح (Switch InPin):</label>
                      <input
                        type="number"
                        value={customSwitchPin}
                        onChange={e => setCustomSwitchPin(e.target.value)}
                        placeholder="اختياري (-1)"
                        className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3 py-2 text-cyan-400 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={handleSaveDeviceEdit}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-cyan-600/20 cursor-pointer"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 4. Comprehensive Device Customization & Reordering Manager Modal ── */}
      <AnimatePresence>
        {isCustomizeModalOpen && (
          <motion.div
            key="customize-devices-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-[#0b101d] border-0 sm:border sm:border-white/10 sm:rounded-3xl p-4 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 h-full sm:h-[85vh] flex flex-col justify-between"
            >
              <div className="flex flex-col flex-1 min-h-0">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={20} className="text-cyan-400" />
                    <div>
                      <h3 className="text-base font-black text-white">
                        {isEn ? 'Home Devices Customizer & Reorder' : 'تخصيص وترتيب وإخفاء أجهزة الرئيسية'}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        تحكم في الأجهزة المعروضة، ترتيبها، أو إخفائها من لوحة القيادة
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCustomizeModalOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Search & Bulk Action Toolbar */}
                <div className="py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b border-white/5">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={customizeSearch}
                      onChange={e => setCustomizeSearch(e.target.value)}
                      placeholder="بحث عن جهاز أو غرفة..."
                      className="w-full bg-[#070d1a] border border-white/10 rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={showAllDevices}
                      className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>إظهار الكل</span>
                    </button>

                    <button
                      type="button"
                      onClick={hideAllDevices}
                      className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <EyeOff size={12} />
                      <span>إخفاء الكل</span>
                    </button>

                    <button
                      type="button"
                      onClick={resetDeviceOrder}
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="إعادة الترتيب التلقائي حسب المخارج والغرف"
                    >
                      <RotateCcw size={12} />
                      <span>إعادة الترتيب</span>
                    </button>
                  </div>
                </div>

                {/* Devices Interactive List with Reordering and Eye Toggles */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 py-3 pr-1">
                  {allModalSortedDevices.map((d, index) => {
                    const isHidden = hiddenDeviceIds.includes(String(d.id));
                    const currentRoom = getRoomName((d as any).room) || 'غير محدد';

                    return (
                      <div
                        key={d.id}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                          isHidden
                            ? 'bg-slate-950/40 border-slate-800/80 text-slate-500 opacity-70'
                            : 'bg-[#0e1628] border-cyan-500/30 text-white shadow-sm'
                        }`}
                      >
                        {/* Device Info & Type */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-xl border shrink-0 ${!isHidden ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                            {getDeviceIcon(d.type, !isHidden)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black truncate text-white">
                              {d.name}
                            </p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>📍 {currentRoom}</span>
                              <span>•</span>
                              <span className="font-mono text-cyan-400/80">PIN: {d.pin ?? (d as any).pinNumber ?? '-'}</span>
                            </p>
                          </div>
                        </div>

                        {/* Controls: Reorder Up/Down/Pin + Show/Hide Toggle */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Pin to Top Button */}
                          <button
                            type="button"
                            onClick={() => {
                              moveDeviceInOrder(d.id, 'top');
                              notify(`تم تثبيت "${d.name}" في بداية القائمة 📌`, 'success');
                            }}
                            className="p-1.5 bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 rounded-xl border border-white/5 transition-all cursor-pointer"
                            title="تثبيت في البداية 📌"
                          >
                            <Pin size={13} />
                          </button>

                          {/* Move Up */}
                          <button
                            type="button"
                            onClick={() => moveDeviceInOrder(d.id, 'up')}
                            disabled={index === 0}
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-20 rounded-xl border border-white/5 transition-all cursor-pointer"
                            title="تقديم للأعلى"
                          >
                            <ArrowUp size={13} />
                          </button>

                          {/* Move Down */}
                          <button
                            type="button"
                            onClick={() => moveDeviceInOrder(d.id, 'down')}
                            disabled={index === allModalSortedDevices.length - 1}
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-20 rounded-xl border border-white/5 transition-all cursor-pointer"
                            title="تأخير للأسفل"
                          >
                            <ArrowDown size={13} />
                          </button>

                          {/* Toggle Visibility (Show / Hide) */}
                          <button
                            type="button"
                            onClick={() => toggleDeviceVisibility(d.id, d.name)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              !isHidden
                                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                            }`}
                          >
                            {!isHidden ? (
                              <>
                                <Eye size={13} />
                                <span>معروض 👁️</span>
                              </>
                            ) : (
                              <>
                                <EyeOff size={13} />
                                <span>مخفي 🙈</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="text-xs text-slate-300 font-bold">
                  <span>المعروض في الرئيسية: </span>
                  <span className="text-cyan-400 font-mono font-black">{displayDevices.length - hiddenDeviceIds.length}</span>
                  <span className="text-slate-500"> / {displayDevices.length} جهازاً</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCustomizeModalOpen(false)}
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  حفظ وإغلاق ✓
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
