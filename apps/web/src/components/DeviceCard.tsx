// @ts-nocheck
"use client";
/* eslint-disable */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Device } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import {
  Lightbulb,
  Zap,
  Plug,
  Lock,
  Unlock,
  Fan,
  Snowflake,
  Wind,
  Droplets,
  Thermometer,
  Camera,
  Sprout,
  Sparkles,
  Palette,
  Sliders,
  Flame,
  Bell,
  Trash2,
  Edit3,
  Info,
  X,
  Check,
  Power,
  ChevronUp,
  ChevronDown,
  Pause,
  Play,
  RotateCw,
  Minus,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';

interface DeviceCardProps {
  device: Device;
  boardName?: string;
  onToggle: (id: number, boardId: string) => void;
  onDelete: (id: number, boardId: string) => void;
  onUpdatePWM?: (id: number, boardId: string, val: number) => void;
  onUpdateColor?: (id: number, boardId: string, color: string) => void;
  onSetTimer?: (id: number, boardId: string, mins: number) => void;
  onUpdateSchedule?: (id: number, boardId: string, active: boolean, hOn: number, mOn: number, hOff: number, mOff: number) => void;
  isEditMode?: boolean;
  dragListeners?: any;
  isFavorite?: boolean;
  onToggleFavorite?: (boardId: string, id: number) => void;
  onMoveForward?: (id: number, boardId: string) => void;
  onMoveBackward?: (id: number, boardId: string) => void;
  onShowInfo?: (device: Device) => void;
  onEdit?: (device: Device) => void;
}

export function DeviceCard({
  device,
  boardName,
  onToggle,
  onDelete,
  onUpdatePWM,
  onUpdateColor,
  isEditMode,
  isFavorite,
  onToggleFavorite,
  onMoveForward,
  onMoveBackward,
  onShowInfo,
  onEdit
}: DeviceCardProps) {
  const { t } = useLanguage();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [targetTemp, setTargetTemp] = useState<number>(22);
  const [curtainState, setCurtainState] = useState<'OPEN' | 'CLOSED' | 'STOPPED'>('STOPPED');
  const [selectedRgbColor, setSelectedRgbColor] = useState<string>('#00f0ff');
  
  const devNameLower = (device.name || '').toLowerCase();
  const rawType = (device.type || '').toUpperCase();

  // Normalize Device Category
  const getDeviceCategory = () => {
    if (rawType === 'RGB' || rawType.includes('RGB') || devNameLower.includes('شريط') || devNameLower.includes('ملون')) return 'RGB';
    if (rawType === 'CURTAIN' || rawType.includes('CURTAIN') || devNameLower.includes('ستار') || devNameLower.includes('بردة')) return 'CURTAIN';
    if (rawType === 'LOCK' || rawType.includes('LOCK') || devNameLower.includes('قفل') || devNameLower.includes('باب') || devNameLower.includes('كالون')) return 'LOCK';
    if (rawType === 'CLIMATE' || rawType === 'AC' || rawType.includes('AC') || rawType.includes('HVAC') || devNameLower.includes('تكييف') || devNameLower.includes('سبلت') || devNameLower.includes('تبريد')) return 'CLIMATE';
    if (rawType === 'PUMP' || rawType.includes('PUMP') || devNameLower.includes('مضخ') || devNameLower.includes('ماطور') || devNameLower.includes('سقي') || devNameLower.includes('ري')) return 'PUMP';
    if (rawType === 'CAMERA' || rawType.includes('CAM') || devNameLower.includes('كامير') || devNameLower.includes('dvr')) return 'CAMERA';
    if (rawType === 'ENERGY' || rawType.includes('ENERGY') || rawType.includes('POWER') || devNameLower.includes('كهربا') || devNameLower.includes('طاق') || devNameLower.includes('تيار') || devNameLower.includes('فولت') || devNameLower.includes('أمبير') || devNameLower.includes('acs712')) return 'ENERGY';
    if (rawType === 'MOISTURE' || rawType.includes('SOIL') || devNameLower.includes('ترب') || devNameLower.includes('زراع')) return 'MOISTURE';
    if (rawType === 'TEMPERATURE' || rawType === 'SENSOR' || rawType.includes('TEMP') || devNameLower.includes('حرار') || devNameLower.includes('طقس') || devNameLower === 'حساس') return 'TEMPERATURE';
    if (rawType === 'FAN' || rawType.includes('FAN') || devNameLower.includes('مروح') || devNameLower.includes('شفاط') || devNameLower.includes('تهوي')) return 'FAN';
    if (rawType === 'HEATER' || rawType.includes('HEATER') || devNameLower.includes('سخان') || devNameLower.includes('بيلر') || devNameLower.includes('تدفئ')) return 'HEATER';
    if (rawType === 'SIREN' || rawType.includes('ALARM') || devNameLower.includes('إنذار') || devNameLower.includes('جرس') || devNameLower.includes('صافرة')) return 'SIREN';
    if (rawType === 'SOCKET' || rawType.includes('SOCKET') || devNameLower.includes('مقبس') || devNameLower.includes('فيشة') || devNameLower.includes('بلاك')) return 'SOCKET';
    return 'LIGHT';
  };

  const category = getDeviceCategory();
  const isOn = device.state === 'ON' || (device.state as any) === true || (device.state as any) === 1;
  const isSensor = ['ENERGY', 'MOISTURE', 'TEMPERATURE', 'CAMERA'].includes(category);

  // Dynamic Theme & Card Glass Styling
  const getCardThemeStyle = () => {
    switch (category) {
      case 'RGB':
        return isOn
          ? 'border-fuchsia-500/50 bg-gradient-to-br from-fuchsia-950/40 via-purple-950/30 to-slate-950 shadow-[0_0_30px_rgba(217,70,239,0.25)] hover:border-fuchsia-400'
          : 'border-white/10 bg-slate-900/60 hover:border-fuchsia-500/30';
      case 'CURTAIN':
        return isOn
          ? 'border-indigo-500/50 bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-950 shadow-[0_0_30px_rgba(99,102,241,0.22)] hover:border-indigo-400'
          : 'border-white/10 bg-slate-900/60 hover:border-indigo-500/30';
      case 'LOCK':
        return isOn
          ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.22)] hover:border-emerald-400'
          : 'border-rose-500/40 bg-gradient-to-br from-rose-950/30 via-slate-900/90 to-slate-950 shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:border-rose-400';
      case 'CLIMATE':
        return isOn
          ? 'border-sky-400/50 bg-gradient-to-br from-sky-950/40 via-blue-950/30 to-slate-950 shadow-[0_0_30px_rgba(56,189,248,0.25)] hover:border-sky-300'
          : 'border-white/10 bg-slate-900/60 hover:border-sky-500/30';
      case 'PUMP':
        return isOn
          ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-950/40 via-teal-950/30 to-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:border-emerald-400'
          : 'border-white/10 bg-slate-900/60 hover:border-emerald-500/30';
      case 'SOCKET':
        return isOn
          ? 'border-amber-400/50 bg-gradient-to-br from-amber-950/40 via-slate-900/90 to-slate-950 shadow-[0_0_30px_rgba(251,191,36,0.2)] hover:border-amber-300'
          : 'border-white/10 bg-slate-900/60 hover:border-amber-500/30';
      case 'ENERGY':
        return 'border-amber-500/50 bg-gradient-to-br from-amber-950/30 via-slate-900/90 to-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.2)] hover:border-amber-400';
      case 'MOISTURE':
        return 'border-teal-500/50 bg-gradient-to-br from-teal-950/30 via-slate-900/90 to-slate-950 shadow-[0_0_25px_rgba(20,184,166,0.2)] hover:border-teal-400';
      case 'TEMPERATURE':
        return 'border-cyan-500/50 bg-gradient-to-br from-cyan-950/30 via-slate-900/90 to-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.2)] hover:border-cyan-400';
      case 'CAMERA':
        return 'border-blue-500/40 bg-gradient-to-br from-blue-950/30 via-slate-900/90 to-slate-950 shadow-[0_0_20px_rgba(59,130,246,0.18)] hover:border-blue-400';
      case 'FAN':
        return isOn
          ? 'border-teal-400/50 bg-gradient-to-br from-teal-950/40 via-slate-900/90 to-slate-950 shadow-[0_0_30px_rgba(45,212,191,0.22)]'
          : 'border-white/10 bg-slate-900/60 hover:border-teal-500/30';
      case 'HEATER':
        return isOn
          ? 'border-orange-500/50 bg-gradient-to-br from-orange-950/40 via-slate-900/90 to-slate-950 shadow-[0_0_30px_rgba(249,115,22,0.25)]'
          : 'border-white/10 bg-slate-900/60 hover:border-orange-500/30';
      case 'SIREN':
        return isOn
          ? 'border-rose-500/60 bg-gradient-to-br from-rose-950/50 via-slate-900/90 to-slate-950 shadow-[0_0_35px_rgba(244,63,94,0.35)] animate-pulse'
          : 'border-white/10 bg-slate-900/60 hover:border-rose-500/30';
      case 'LIGHT':
      default:
        return isOn
          ? 'border-cyan-400/50 bg-gradient-to-br from-cyan-950/40 via-blue-950/30 to-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.25)] hover:border-cyan-300'
          : 'border-white/10 bg-slate-900/60 hover:border-white/20 hover:bg-slate-900/80';
    }
  };

  // Device Dynamic Icon
  const renderDeviceIcon = () => {
    switch (category) {
      case 'RGB':
        return (
          <Sparkles
            size={24}
            className={`transition-all duration-300 ${
              isOn
                ? 'text-fuchsia-300 drop-shadow-[0_0_16px_rgba(217,70,239,0.9)] animate-pulse stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
          />
        );
      case 'CURTAIN':
        return (
          <Sliders
            size={24}
            className={`transition-all duration-300 ${
              isOn
                ? 'text-indigo-300 drop-shadow-[0_0_16px_rgba(99,102,241,0.9)] stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
          />
        );
      case 'LOCK':
        return isOn ? (
          <Unlock size={24} className="text-emerald-400 drop-shadow-[0_0_16px_rgba(16,185,129,0.9)] stroke-[2.5]" />
        ) : (
          <Lock size={24} className="text-rose-400 drop-shadow-[0_0_16px_rgba(244,63,94,0.9)] stroke-[2.5]" />
        );
      case 'CLIMATE':
        return (
          <Snowflake
            size={24}
            className={`transition-all duration-300 ${
              isOn
                ? 'text-sky-300 animate-spin drop-shadow-[0_0_16px_rgba(56,189,248,0.9)] stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
          />
        );
      case 'PUMP':
        return (
          <Sprout
            size={24}
            className={`transition-all duration-300 ${
              isOn
                ? 'text-emerald-300 drop-shadow-[0_0_16px_rgba(16,185,129,0.9)] animate-bounce stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
          />
        );
      case 'SOCKET':
        return (
          <Plug
            size={24}
            className={`transition-all duration-300 ${
              isOn
                ? 'text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,0.9)] stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
          />
        );
      case 'ENERGY':
        return <Zap size={24} className="text-amber-400 drop-shadow-[0_0_14px_rgba(245,158,11,0.9)] stroke-[2.5]" />;
      case 'MOISTURE':
        return <Droplets size={24} className="text-teal-400 drop-shadow-[0_0_14px_rgba(20,184,166,0.9)] stroke-[2.5]" />;
      case 'TEMPERATURE':
        return <Thermometer size={24} className="text-cyan-400 drop-shadow-[0_0_14px_rgba(6,182,212,0.9)] stroke-[2.5]" />;
      case 'CAMERA':
        return <Camera size={24} className="text-blue-400 drop-shadow-[0_0_14px_rgba(59,130,246,0.9)] stroke-[2.5]" />;
      case 'FAN':
        return (
          <Fan
            size={24}
            className={`transition-all duration-300 ${
              isOn
                ? 'text-teal-300 animate-spin drop-shadow-[0_0_16px_rgba(45,212,191,0.9)]'
                : 'text-slate-500'
            }`}
          />
        );
      case 'HEATER':
        return (
          <Flame
            size={24}
            className={`transition-all duration-300 ${
              isOn
                ? 'text-orange-400 drop-shadow-[0_0_16px_rgba(249,115,22,0.9)] animate-pulse stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
          />
        );
      case 'SIREN':
        return (
          <Bell
            size={24}
            className={`transition-all duration-300 ${
              isOn
                ? 'text-rose-400 drop-shadow-[0_0_16px_rgba(244,63,94,0.9)] animate-bounce stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
          />
        );
      case 'LIGHT':
      default:
        return (
          <Lightbulb
            size={24}
            className={`transition-all duration-300 ${
              isOn
                ? 'text-cyan-300 drop-shadow-[0_0_16px_rgba(34,211,238,0.9)] stroke-[2.5]'
                : 'text-slate-500 stroke-[1.8]'
            }`}
          />
        );
    }
  };

  // Type-specific Label Badge
  const getCategoryBadge = () => {
    switch (category) {
      case 'RGB': return { label: '🌈 إضاءة ملونة', color: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' };
      case 'CURTAIN': return { label: '🪟 ستائر ذكية', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
      case 'LOCK': return { label: isOn ? '🔓 قفل مفتوح' : '🔒 قفل مؤمن', color: isOn ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
      case 'CLIMATE': return { label: '❄️ تكييف هوائي', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
      case 'PUMP': return { label: '🌱 مضخة سقي', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'SOCKET': return { label: '🔌 مقبس كهربائي', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'ENERGY': return { label: '⚡ مقياس الطاقة', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case 'MOISTURE': return { label: '💧 رطوبة التربة', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' };
      case 'TEMPERATURE': return { label: '🌡️ طقس الغرفة', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
      case 'CAMERA': return { label: '📹 كاميرا مراقبة', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'FAN': return { label: '🌀 مروحة تهوية', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' };
      case 'HEATER': return { label: '♨️ سخان حراري', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' };
      case 'SIREN': return { label: '🚨 صفارة إنذار', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
      case 'LIGHT':
      default: return { label: '💡 إنارة', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
    }
  };

  const badge = getCategoryBadge();

  return (
    <motion.div
      layout
      transition={{ duration: 0.2 }}
      className={`relative overflow-hidden rounded-2xl sm:rounded-3xl transition-all duration-300 border p-3.5 sm:p-5 flex flex-col justify-between min-h-[145px] sm:min-h-[165px] ${getCardThemeStyle()} ${
        isEditMode ? 'animate-pulse border-dashed border-cyan-400' : ''
      }`}
    >
      {/* Dynamic Background Ambient Glow */}
      {isOn && !isSensor && (
        <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none animate-pulse ${
          category === 'RGB' ? 'bg-fuchsia-500/20' :
          category === 'CURTAIN' ? 'bg-indigo-500/20' :
          category === 'CLIMATE' ? 'bg-sky-500/20' :
          category === 'PUMP' ? 'bg-emerald-500/20' :
          category === 'SOCKET' ? 'bg-amber-500/20' :
          category === 'LOCK' ? 'bg-emerald-500/20' :
          'bg-cyan-500/20'
        }`} />
      )}

      {/* Edit Mode Overlay */}
      {isEditMode && (
        <div className="absolute inset-0 bg-black/75 z-30 flex items-center justify-center gap-2 backdrop-blur-md px-2">
          {showConfirmDelete ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-white text-xs font-bold">تأكيد الحذف؟</span>
              <div className="flex gap-2">
                <button onClick={() => setShowConfirmDelete(false)} className="px-3 py-1 bg-white/20 rounded-xl text-white text-xs font-bold">إلغاء</button>
                <button onClick={() => onDelete(device.id, device.boardId || '')} className="px-3 py-1 bg-rose-600 rounded-xl text-white text-xs font-bold shadow-lg">حذف</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <button 
                onClick={() => onEdit ? onEdit(device) : setShowInfoModal(true)}
                className="px-2.5 py-1.5 bg-cyan-500/30 hover:bg-cyan-500 text-cyan-200 hover:text-white rounded-xl text-xs font-bold transition border border-cyan-400/40 flex items-center gap-1"
              >
                <Edit3 size={13} /> تعديل
              </button>
              <button 
                onClick={() => onMoveForward && onMoveForward(device.id, device.boardId || '')}
                className="px-2.5 py-1.5 bg-blue-500/30 hover:bg-blue-500 text-blue-200 hover:text-white rounded-xl text-xs font-bold transition border border-blue-400/40"
              >
                ◀ تقديم
              </button>
              <button 
                onClick={() => onMoveBackward && onMoveBackward(device.id, device.boardId || '')}
                className="px-2.5 py-1.5 bg-purple-500/30 hover:bg-purple-500 text-purple-200 hover:text-white rounded-xl text-xs font-bold transition border border-purple-400/40"
              >
                تأخير ▶
              </button>
              <button onClick={() => setShowConfirmDelete(true)} className="p-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition border border-rose-500/30">
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Card Top Section: Dynamic Interactive Orb & Device Header */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        
        {/* Clickable Orb / Button */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            disabled={isSensor}
            onClick={() => !isSensor && onToggle(device.id, device.boardId || '')}
            className={`relative w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-300 select-none shrink-0 ${
              isSensor
                ? 'bg-white/5 border-white/10 cursor-default'
                : isOn
                ? 'bg-gradient-to-br from-white/15 to-white/5 border-white/40 shadow-lg scale-105 active:scale-95'
                : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20 hover:bg-white/10 hover:scale-105 active:scale-95'
            }`}
            title={isSensor ? 'مستشعر قياس' : isOn ? 'اضغط للإطفاء' : 'اضغط للتشغيل'}
          >
            {renderDeviceIcon()}
            {isOn && !isSensor && (
              <span className="absolute inset-0 rounded-2xl border border-white/30 animate-ping pointer-events-none opacity-30" />
            )}
          </button>

          {/* Device Title, Subtitle, and Type Chip */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`px-2 py-0.2 rounded-md text-[9px] font-extrabold border ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            <h3 className="font-black text-sm text-white leading-tight truncate max-w-[135px] tracking-wide">
              {device.name}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate max-w-[120px] font-mono">
              {boardName || `GPIO ${device.pin}`}
            </p>
          </div>
        </div>

        {/* Edit & Info Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={() => onEdit ? onEdit(device) : setShowInfoModal(true)}
            className="px-2.5 py-1 bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 rounded-xl text-[10px] font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
            title="تعديل الجهاز ✏️"
          >
            <Edit3 size={11} className="text-cyan-400" />
            <span>تعديل</span>
          </button>
          <button 
            onClick={() => onShowInfo ? onShowInfo(device) : setShowInfoModal(true)}
            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="تفاصيل المنافذ (GPIO)"
          >
            <Info size={14} />
          </button>
        </div>
      </div>

      {/* ── Type-Specific Customized Interactive Body / Control Bar ── */}
      <div className="mt-3.5 pt-2.5 border-t border-white/5 relative z-10">
        
        {/* 1. CLIMATE / AC (Thermostat Stepper + Frost Controls) */}
        {category === 'CLIMATE' && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center bg-black/40 border border-sky-500/30 rounded-xl p-1 gap-1.5">
              <button
                type="button"
                onClick={() => setTargetTemp(Math.max(16, targetTemp - 1))}
                className="w-6 h-6 rounded-lg bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 flex items-center justify-center font-bold text-xs"
              >
                <Minus size={12} />
              </button>
              <span className="font-mono font-black text-xs text-sky-200 px-1">
                {targetTemp}°C
              </span>
              <button
                type="button"
                onClick={() => setTargetTemp(Math.min(30, targetTemp + 1))}
                className="w-6 h-6 rounded-lg bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 flex items-center justify-center font-bold text-xs"
              >
                <Plus size={12} />
              </button>
            </div>

            <ToggleSwitch
              checked={isOn}
              onChange={() => onToggle(device.id, device.boardId || '')}
              size="md"
            />
          </div>
        )}

        {/* 2. RGB STRIP (Color Swatches + Dynamic Glow) */}
        {category === 'RGB' && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-xl border border-fuchsia-500/20">
              {['#00f0ff', '#d946ef', '#fbbf24', '#10b981', '#f43f5e'].map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => {
                    setSelectedRgbColor(col);
                    if (onUpdateColor) onUpdateColor(device.id, device.boardId || '', col);
                  }}
                  style={{ backgroundColor: col }}
                  className={`w-4 h-4 rounded-full transition-transform ${selectedRgbColor === col ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'}`}
                />
              ))}
            </div>

            <ToggleSwitch
              checked={isOn}
              onChange={() => onToggle(device.id, device.boardId || '')}
              size="md"
            />
          </div>
        )}

        {/* 3. SMART CURTAIN (Open / Stop / Close Tri-State Buttons) */}
        {category === 'CURTAIN' && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center bg-black/40 border border-indigo-500/30 rounded-xl p-0.5 gap-1">
              <button
                type="button"
                onClick={() => {
                  setCurtainState('OPEN');
                  onToggle(device.id, device.boardId || '');
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${curtainState === 'OPEN' && isOn ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <ChevronUp size={12} /> فتح
              </button>
              <button
                type="button"
                onClick={() => setCurtainState('STOPPED')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${curtainState === 'STOPPED' ? 'bg-white/10 text-slate-200' : 'text-slate-400 hover:text-white'}`}
              >
                <Pause size={10} /> إيقاف
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurtainState('CLOSED');
                  if (isOn) onToggle(device.id, device.boardId || '');
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${curtainState === 'CLOSED' && !isOn ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <ChevronDown size={12} /> إغلاق
              </button>
            </div>

            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOn ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-400'}`}>
              {curtainState === 'OPEN' ? 'مفتوحة 100%' : curtainState === 'CLOSED' ? 'مغلقة' : 'متوقفة'}
            </span>
          </div>
        )}

        {/* 4. ELECTRIC LOCK (Tactile Safe Lock/Unlock Button) */}
        {category === 'LOCK' && (
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[10px] font-bold flex items-center gap-1.5 ${isOn ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              {isOn ? 'الباب مفتوح (UNLOCKED)' : 'الباب مقفل ومؤمن (LOCKED)'}
            </span>

            <button
              type="button"
              onClick={() => onToggle(device.id, device.boardId || '')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md ${
                isOn
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-white'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500 hover:text-white'
              }`}
            >
              {isOn ? <Unlock size={13} /> : <Lock size={13} />}
              <span>{isOn ? 'قفل الباب' : 'فتح الباب'}</span>
            </button>
          </div>
        )}

        {/* 5. IRRIGATION PUMP (Water Flow Pulse & Auto-Timer) */}
        {category === 'PUMP' && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
              <Droplets size={12} className={isOn ? 'animate-bounce' : ''} />
              <span>{isOn ? 'ضخ المياه نشط' : 'الري متوقف'}</span>
            </div>

            <ToggleSwitch
              checked={isOn}
              onChange={() => onToggle(device.id, device.boardId || '')}
              size="md"
            />
          </div>
        )}

        {/* 6. CAMERA / CCTV (Live Stream Preview Badge) */}
        {category === 'CAMERA' && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>بث مباشر HD (1080p)</span>
            </div>
            <button
              type="button"
              onClick={() => alert(`فتح البث المباشر لكاميرا: ${device.name}`)}
              className="px-2.5 py-1 bg-blue-500/20 hover:bg-blue-500 text-blue-300 hover:text-white rounded-xl text-[10px] font-bold border border-blue-500/30 transition"
            >
              عرض البث 🔴
            </button>
          </div>
        )}

        {/* 7. ENERGY METER (Real-time Watts, Amps, Volts) */}
        {category === 'ENERGY' && (
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1 text-white font-mono">
              <span className="text-2xl font-black text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                {device.powerUsage ? Number(device.powerUsage).toFixed(1) : '0.0'}
              </span>
              <span className="text-xs font-bold text-amber-300">واط (W)</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              ⚡ {device.currentAmps ? Number(device.currentAmps).toFixed(1) : '0.0'} A | 220V
            </span>
          </div>
        )}

        {/* 8. SOIL MOISTURE SENSOR */}
        {category === 'MOISTURE' && (
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1 text-white font-mono">
              <span className="text-2xl font-black text-teal-400 drop-shadow-[0_0_10px_rgba(20,184,166,0.5)]">
                {device.soilMoisture !== undefined && device.soilMoisture !== null ? Number(device.soilMoisture).toFixed(0) : '68'}
              </span>
              <span className="text-xs font-bold text-teal-300">%</span>
            </div>
            <span className="text-[10px] text-teal-400 font-bold bg-teal-500/10 px-2.5 py-0.5 rounded-full border border-teal-500/20">
              🌱 رطوبة ممتازة
            </span>
          </div>
        )}

        {/* 9. TEMPERATURE & HUMIDITY SENSOR */}
        {category === 'TEMPERATURE' && (
          <div className="flex items-center justify-between font-mono">
            <div className="flex items-baseline gap-1 text-cyan-300">
              <span className="text-2xl font-black">{device.temperature ? Number(device.temperature).toFixed(1) : '24.5'}</span>
              <span className="text-xs font-bold">°C</span>
            </div>
            <div className="flex items-baseline gap-1 text-blue-300">
              <span className="text-xl font-bold">{device.humidity ? Number(device.humidity).toFixed(0) : '48'}</span>
              <span className="text-xs font-bold">% رطوبة</span>
            </div>
          </div>
        )}

        {/* 10. STANDARD SWITCH / LIGHT / SOCKET / FAN / HEATER */}
        {!['CLIMATE', 'RGB', 'CURTAIN', 'LOCK', 'PUMP', 'CAMERA', 'ENERGY', 'MOISTURE', 'TEMPERATURE'].includes(category) && (
          <div className="flex items-center justify-between">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all ${
              isOn
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.2)] font-black'
                : 'bg-slate-800/80 text-slate-400 border border-white/5'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
              {isOn ? 'نشط • شغال' : 'متوقف'}
            </span>

            <ToggleSwitch
              checked={isOn}
              onChange={() => onToggle(device.id, device.boardId || '')}
              size="md"
            />
          </div>
        )}
      </div>

      {/* Hardware & GPIO Info Modal */}
      {showInfoModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md text-right" dir="rtl" onClick={(e) => e.stopPropagation()}>
          <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Info className="text-cyan-400" size={20} />
                <span>تفاصيل منافذ الجهاز (GPIO)</span>
              </h2>
              <button onClick={() => setShowInfoModal(false)} className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 font-mono">
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between">
                <span className="text-slate-400 font-sans">اسم الجهاز:</span>
                <span className="text-white font-bold">{device.name}</span>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between">
                <span className="text-slate-400 font-sans">نوع الجهاز الحالي:</span>
                <span className="text-cyan-300 font-bold">{badge.label} ({category})</span>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between">
                <span className="text-slate-400 font-sans">متحكم ESP32 (Board):</span>
                <span className="text-cyan-300">{device.boardId || 'MosaNode_3030F96A1F5C'}</span>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between">
                <span className="text-slate-400 font-sans">منفذ الريليه (Relay Pin):</span>
                <span className="text-amber-300 font-bold">GPIO {device.pin}</span>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between">
                <span className="text-slate-400 font-sans">طرف المفتاح الجداري (Switch Pin):</span>
                <span className="text-purple-300">{device.switchPin ?? device.inPin ?? 'غير محدد (-1)'}</span>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold text-xs shadow-lg cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>,
        document.body
      )}
    </motion.div>
  );
}
