'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Power, Volume2, VolumeX, Volume1, ChevronUp, ChevronDown, 
  ChevronLeft, ChevronRight, Home, Menu, ArrowLeft, Tv, 
  Play, Pause, RotateCcw, RotateCw, Square, Radio, 
  Layers, Settings, Sparkles, Wifi, Check, X,
  MonitorPlay, Film, Cast, Info, Sliders, Smartphone
} from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';

export interface TVBrandConfig {
  id: string;
  name: string;
  nameAr: string;
  logo: string;
  protocol: string;
  color: string;
  gradient: string;
  apps: { id: string; name: string; icon: string; bg: string }[];
  inputs: { id: string; name: string }[];
}

export const SUPPORTED_TV_BRANDS: TVBrandConfig[] = [
  {
    id: 'tcl',
    name: 'TCL Smart TV',
    nameAr: 'تي سي إل (TCL Google TV / Android)',
    logo: '🔴 TCL Smart TV',
    protocol: 'TCL Android ADB / Google Cast',
    color: '#e10600',
    gradient: 'from-red-600 via-rose-700 to-slate-900',
    apps: [
      { id: 'netflix', name: 'Netflix', icon: '🎬', bg: 'bg-red-600' },
      { id: 'youtube', name: 'YouTube', icon: '▶️', bg: 'bg-red-500' },
      { id: 'shahid', name: 'Shahid VIP', icon: '🌟', bg: 'bg-emerald-600' },
      { id: 'prime', name: 'Prime Video', icon: '📦', bg: 'bg-blue-600' },
      { id: 'tclchannel', name: 'TCL Home', icon: '📺', bg: 'bg-rose-700' },
      { id: 'playstore', name: 'Google Play', icon: '🛍️', bg: 'bg-cyan-600' }
    ],
    inputs: [
      { id: 'HDMI1', name: 'HDMI 1 (eARC)' },
      { id: 'HDMI2', name: 'HDMI 2 (Game Mode)' },
      { id: 'HDMI3', name: 'HDMI 3' },
      { id: 'AV', name: 'AV In' },
      { id: 'TV', name: 'Live TV' }
    ]
  },
  {
    id: 'samsung',
    name: 'Samsung Smart TV',
    nameAr: 'سامسونج (Tizen OS)',
    logo: '📺 SAMSUNG',
    protocol: 'SmartThings / WebSocket API',
    color: '#1428a0',
    gradient: 'from-blue-600 to-indigo-900',
    apps: [
      { id: 'netflix', name: 'Netflix', icon: '🎬', bg: 'bg-red-600' },
      { id: 'youtube', name: 'YouTube', icon: '▶️', bg: 'bg-red-500' },
      { id: 'shahid', name: 'Shahid VIP', icon: '🌟', bg: 'bg-emerald-600' },
      { id: 'prime', name: 'Prime Video', icon: '📦', bg: 'bg-blue-600' },
      { id: 'appletv', name: 'Apple TV+', icon: '🍏', bg: 'bg-zinc-800' },
      { id: 'spotify', name: 'Spotify', icon: '🎵', bg: 'bg-green-600' }
    ],
    inputs: [
      { id: 'HDMI1', name: 'HDMI 1 (Receiver)' },
      { id: 'HDMI2', name: 'HDMI 2 (PlayStation)' },
      { id: 'HDMI3', name: 'HDMI 3 (eARC)' },
      { id: 'TV', name: 'Live TV / Satellite' }
    ]
  },
  {
    id: 'lg',
    name: 'LG Smart TV',
    nameAr: 'إل جي (LG webOS)',
    logo: '🔴 LG webOS',
    protocol: 'LG webOS ThinQ IP',
    color: '#a50034',
    gradient: 'from-rose-600 to-pink-900',
    apps: [
      { id: 'netflix', name: 'Netflix', icon: '🎬', bg: 'bg-red-600' },
      { id: 'youtube', name: 'YouTube', icon: '▶️', bg: 'bg-red-500' },
      { id: 'shahid', name: 'Shahid VIP', icon: '🌟', bg: 'bg-emerald-600' },
      { id: 'disney', name: 'Disney+', icon: '✨', bg: 'bg-blue-700' },
      { id: 'osn', name: 'OSN+', icon: '🎭', bg: 'bg-purple-700' },
      { id: 'browser', name: 'Web Browser', icon: '🌐', bg: 'bg-slate-700' }
    ],
    inputs: [
      { id: 'HDMI1', name: 'HDMI 1 (4K 120Hz)' },
      { id: 'HDMI2', name: 'HDMI 2 (eARC/Soundbar)' },
      { id: 'HDMI3', name: 'HDMI 3 (Apple TV)' },
      { id: 'AV', name: 'AV Component' }
    ]
  },
  {
    id: 'sony',
    name: 'Sony Bravia / Google TV',
    nameAr: 'سوني (Google TV / Android)',
    logo: '⚡ SONY Bravia',
    protocol: 'Sony Bravia REST / Android ADB',
    color: '#1a1a1a',
    gradient: 'from-zinc-700 to-slate-900',
    apps: [
      { id: 'youtube', name: 'YouTube', icon: '▶️', bg: 'bg-red-500' },
      { id: 'netflix', name: 'Netflix', icon: '🎬', bg: 'bg-red-600' },
      { id: 'shahid', name: 'Shahid VIP', icon: '🌟', bg: 'bg-emerald-600' },
      { id: 'playstore', name: 'Google Play', icon: '🛍️', bg: 'bg-blue-600' },
      { id: 'kodi', name: 'Kodi Media', icon: '🍿', bg: 'bg-cyan-600' },
      { id: 'twitch', name: 'Twitch', icon: '🎮', bg: 'bg-purple-600' }
    ],
    inputs: [
      { id: 'HDMI1', name: 'HDMI 1 (Standard)' },
      { id: 'HDMI2', name: 'HDMI 2' },
      { id: 'HDMI3', name: 'HDMI 3 (eARC)' },
      { id: 'HDMI4', name: 'HDMI 4 (4K Gaming)' }
    ]
  },
  {
    id: 'appletv',
    name: 'Apple TV 4K',
    nameAr: 'أبل تي في (tvOS / AirPlay)',
    logo: '🍏 Apple TV 4K',
    protocol: 'Apple Media Remote / AirPlay 2',
    color: '#333333',
    gradient: 'from-slate-700 to-zinc-950',
    apps: [
      { id: 'appletv', name: 'Apple TV', icon: '🍏', bg: 'bg-zinc-800' },
      { id: 'netflix', name: 'Netflix', icon: '🎬', bg: 'bg-red-600' },
      { id: 'youtube', name: 'YouTube', icon: '▶️', bg: 'bg-red-500' },
      { id: 'shahid', name: 'Shahid VIP', icon: '🌟', bg: 'bg-emerald-600' },
      { id: 'applemusic', name: 'Apple Music', icon: '🎧', bg: 'bg-pink-600' },
      { id: 'arcade', name: 'Apple Arcade', icon: '🕹️', bg: 'bg-orange-600' }
    ],
    inputs: [
      { id: 'AIRPLAY', name: 'AirPlay Screen Mirror' },
      { id: 'HOMEKIT', name: 'HomeKit Hub' }
    ]
  },
  {
    id: 'roku',
    name: 'Roku TV / Hisense',
    nameAr: 'روكو / هايسنس (Roku OS)',
    logo: '🟣 Roku TV',
    protocol: 'Roku ECP / VIDAA OS',
    color: '#662d91',
    gradient: 'from-purple-700 to-indigo-950',
    apps: [
      { id: 'netflix', name: 'Netflix', icon: '🎬', bg: 'bg-red-600' },
      { id: 'youtube', name: 'YouTube', icon: '▶️', bg: 'bg-red-500' },
      { id: 'shahid', name: 'Shahid VIP', icon: '🌟', bg: 'bg-emerald-600' },
      { id: 'roku_channel', name: 'Roku Channel', icon: '📺', bg: 'bg-purple-600' },
      { id: 'starzplay', name: 'STARZPLAY', icon: '⭐', bg: 'bg-amber-600' },
      { id: 'browser', name: 'Web Browser', icon: '🌐', bg: 'bg-slate-700' }
    ],
    inputs: [
      { id: 'HDMI1', name: 'HDMI 1 (ARC)' },
      { id: 'HDMI2', name: 'HDMI 2' },
      { id: 'AV', name: 'Composite AV' },
      { id: 'ANTENNA', name: 'Antenna TV' }
    ]
  },
  {
    id: 'universal_ir',
    name: 'Universal Smart IR Blaster',
    nameAr: 'ريموت الأشعة تحت الحمراء (ESP32 IR)',
    logo: '📡 Universal IR',
    protocol: 'ESP32 MQTT IR Blaster / Raw Codes',
    color: '#0d9488',
    gradient: 'from-teal-600 to-slate-900',
    apps: [
      { id: 'tv_guide', name: 'دليل القنوات', icon: '📋', bg: 'bg-slate-700' },
      { id: 'sat_menu', name: 'قائمة الرسيفر', icon: '🛰️', bg: 'bg-indigo-700' },
      { id: 'sound_mode', name: 'نمط الصوت', icon: '🔊', bg: 'bg-cyan-700' },
      { id: 'aspect_ratio', name: 'أبعاد الشاشة', icon: '📐', bg: 'bg-emerald-700' }
    ],
    inputs: [
      { id: 'INPUT_TV', name: 'TV' },
      { id: 'INPUT_HDMI1', name: 'HDMI 1' },
      { id: 'INPUT_HDMI2', name: 'HDMI 2' },
      { id: 'INPUT_AV', name: 'AV' }
    ]
  }
];

interface UniversalSmartTvRemoteProps {
  deviceId?: string;
  deviceName?: string;
  roomName?: string;
  initialBrand?: string;
  ipAddress?: string;
  onClose?: () => void;
}

export const UniversalSmartTvRemote: React.FC<UniversalSmartTvRemoteProps> = ({
  deviceId = 'tv-master',
  deviceName = 'الشاشة الذكية الرئيسية',
  roomName = 'الصالة الرئيسية',
  initialBrand = 'samsung',
  ipAddress,
  onClose
}) => {
  const [selectedBrandId, setSelectedBrandId] = useState<string>(initialBrand);
  const [isOn, setIsOn] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(25);
  const [currentChannel, setCurrentChannel] = useState(1);
  const [activeInput, setActiveInput] = useState('HDMI1');
  const [activeTab, setActiveTab] = useState<'remote' | 'numpad' | 'apps' | 'inputs'>('remote');
  const [lastActionToast, setLastActionToast] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [isPairingAdb, setIsPairingAdb] = useState(false);

  const selectedBrand = SUPPORTED_TV_BRANDS.find(b => b.id === selectedBrandId) || SUPPORTED_TV_BRANDS[0];
  const toastTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string, duration = 1500) => {
    setLastActionToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setLastActionToast(''), duration);
  };

  const handlePairAdb = async () => {
    setIsPairingAdb(true);
    showToast('جاري إرسال طلب تصريح الاتصال إلى التلفاز... ⏳');
    try {
      const res = await fetchAuth('/api/entertainment/pair-adb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          deviceId: deviceId !== 'master-tv' ? deviceId : undefined,
          ipAddress: ipAddress || undefined 
        })
      });
      const data = await res.json();
      if (data.message) {
        showToast(data.message);
        alert(data.message);
      }
    } catch {
      showToast('تعذر إرسال طلب الاقتران');
    } finally {
      setIsPairingAdb(false);
    }
  };

  const sendTvCommand = async (command: string, value?: any) => {
    setIsSending(true);
    showToast(`تم إرسال: ${command} (${selectedBrand.name}) ⚡`);

    // Hardware sound simulation if enabled
    try {
      if (typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.05);
        }
      }
    } catch (e) {}

    // Send to backend entertainment / MQTT dispatcher (Optimistic & Non-blocking for zero latency)
    try {
      fetchAuth(`/api/entertainment/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: selectedBrand.id,
          action: command,
          value: value,
          ipAddress: ipAddress || undefined
        })
      }).catch((err) => {
        console.warn('TV Command background dispatch warning:', err);
      });
    } catch (err) {
      console.warn('TV Command dispatch error:', err);
    } finally {
      setTimeout(() => setIsSending(false), 40);
    }
  };

  const handlePower = () => {
    const nextState = !isOn;
    setIsOn(nextState);
    sendTvCommand(nextState ? 'POWER_ON' : 'POWER_OFF');
    showToast(nextState ? 'تم تشغيل الشاشة 📺' : 'تم إطفاء الشاشة 🛑');
  };

  const handleVolumeChange = (delta: number) => {
    const newVol = Math.max(0, Math.min(100, volume + delta));
    setVolume(newVol);
    setIsMuted(false);
    sendTvCommand(delta > 0 ? 'VOL_UP' : 'VOL_DOWN', { level: newVol });
  };

  const handleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    sendTvCommand(nextMute ? 'MUTE' : 'UNMUTE');
    showToast(nextMute ? 'تم كتم الصوت 🔇' : 'تم إلغاء الكتم 🔊');
  };

  const handleChannelChange = (delta: number) => {
    const nextCh = Math.max(1, currentChannel + delta);
    setCurrentChannel(nextCh);
    sendTvCommand(delta > 0 ? 'CH_UP' : 'CH_DOWN', { channel: nextCh });
  };

  const handleNumClick = (num: number) => {
    sendTvCommand('NUM_KEY', { num });
    showToast(`رقم القناة: ${num}`);
  };

  return (
    <div className="bg-[#0b101d] border border-cyan-500/20 rounded-3xl p-5 sm:p-7 shadow-[0_15px_50px_rgba(0,0,0,0.6)] text-white font-sans max-w-lg mx-auto relative overflow-hidden backdrop-blur-2xl" dir="rtl">
      
      {/* Dynamic Ambient Background Glow based on Selected Brand */}
      <div 
        className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-[100px] opacity-25 pointer-events-none transition-all duration-700" 
        style={{ backgroundColor: selectedBrand.color }}
      />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header & Brand Switcher */}
      <div className="relative z-10 flex justify-between items-start pb-4 border-b border-white/10 mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Tv size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                {deviceName}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {roomName} • {selectedBrand.nameAr}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Brand Selector Ribbon */}
      <div className="relative z-10 mb-5">
        <label className="text-[11px] font-bold text-slate-400 block mb-2">
          اختر نوع ونظام تشغيل الشاشة (TV Brand & OS):
        </label>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 custom-scrollbar">
          {SUPPORTED_TV_BRANDS.map(brand => {
            const isSelected = brand.id === selectedBrandId;
            return (
              <button
                key={brand.id}
                onClick={() => {
                  setSelectedBrandId(brand.id);
                  showToast(`تم التبديل إلى ريموت: ${brand.name}`);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border cursor-pointer ${
                  isSelected 
                    ? 'bg-white/15 text-white border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] scale-[1.03]' 
                    : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{brand.logo}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TCL Google TV Pairing Action Button */}
      {selectedBrandId === 'tcl' && (
        <div className="relative z-10 mb-4 p-3 rounded-2xl bg-gradient-to-r from-red-950/60 to-slate-900 border border-red-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5 text-right">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping shrink-0" />
            <div>
              <h4 className="text-xs font-black text-white">إقران وتفعيل تحكم TCL (Google TV)</h4>
              <p className="text-[10px] text-slate-400">إرسال إذن التحكم لشاشة التلفاز لتفعيل كافة الأزرار</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePairAdb}
            disabled={isPairingAdb}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isPairingAdb ? 'جاري الاتصال...' : 'إرسال إذن التحكم للتلفاز 📲'}
          </button>
        </div>
      )}

      {/* TV HUD Status Display */}
      <div className="relative z-10 bg-black/50 border border-white/10 rounded-2xl p-3.5 mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isOn ? 'bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse' : 'bg-red-500'}`} />
          <div>
            <span className="text-xs font-black text-white block">
              {isOn ? 'الشاشة قيد التشغيل (ON)' : 'في وضع الاستعداد (Standby / OFF)'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              المصدر: <span className="text-cyan-400 font-bold">{activeInput}</span> | الصوت: <span className="text-emerald-400 font-bold">{isMuted ? 'مكتوم (MUTE)' : `${volume}%`}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isOn && (
            <button
              onClick={handlePower}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-black transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer animate-pulse"
              title="إيقاظ الشاشة فورا عبر حزم Wake-on-LAN و ADB"
            >
              <span>⚡</span>
              <span>إيقاظ الشاشة</span>
            </button>
          )}

          <button
            onClick={handlePower}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              isOn 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/40 shadow-red-500/20' 
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/40 shadow-emerald-500/20'
            }`}
            title={isOn ? 'إطفاء الشاشة' : 'تشغيل الشاشة'}
          >
            <Power size={20} />
          </button>
        </div>
      </div>

      {!isOn && (
        <div className="relative z-10 -mt-3 mb-4 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] flex items-center justify-between">
          <span>💡 تأكد من تفعيل (التشغيل السريع Quick Start) و (الاستعداد الشبكي Networked Standby) في إعدادات الشاشة لتقبل أمر التشغيل عن بُعد.</span>
        </div>
      )}

      {/* Tabs Switcher: Remote, Numpad, Apps, Inputs */}
      <div className="relative z-10 grid grid-cols-4 gap-1.5 p-1 bg-black/40 border border-white/10 rounded-2xl mb-5">
        {[
          { id: 'remote', label: 'الريموت', icon: Tv },
          { id: 'apps', label: 'التطبيقات', icon: Film },
          { id: 'inputs', label: 'المداخل', icon: MonitorPlay },
          { id: 'numpad', label: 'الأرقام', icon: Sliders }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isActive 
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Main Virtual Remote Controller */}
      {activeTab === 'remote' && (
        <div className={`space-y-6 transition-all ${isOn ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          
          {/* Top Quick Actions (Back, Home, Menu, Source) */}
          <div className="grid grid-cols-4 gap-2">
            <button 
              onClick={() => sendTvCommand('BACK')}
              className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-1 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span className="text-[10px] font-bold">رجوع</span>
            </button>

            <button 
              onClick={() => sendTvCommand('HOME')}
              className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-1 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <Home size={18} className="text-cyan-400" />
              <span className="text-[10px] font-bold">الرئيسية</span>
            </button>

            <button 
              onClick={() => sendTvCommand('MENU')}
              className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-1 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <Menu size={18} />
              <span className="text-[10px] font-bold">القائمة</span>
            </button>

            <button 
              onClick={() => sendTvCommand('SOURCE')}
              className="py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-1 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <Cast size={18} className="text-purple-400" />
              <span className="text-[10px] font-bold">المصدر</span>
            </button>
          </div>

          {/* Precision Circular D-Pad Controller */}
          <div className="relative w-56 h-56 mx-auto bg-gradient-to-b from-[#141b2d] to-[#0a0f1d] rounded-full p-2 border-2 border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] flex items-center justify-center">
            
            {/* UP Button */}
            <button 
              onClick={() => sendTvCommand('UP')}
              className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-12 rounded-t-full bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="أعلى"
            >
              <ChevronUp size={24} />
            </button>

            {/* DOWN Button */}
            <button 
              onClick={() => sendTvCommand('DOWN')}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-12 rounded-b-full bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="أسفل"
            >
              <ChevronDown size={24} />
            </button>

            {/* LEFT Button */}
            <button 
              onClick={() => sendTvCommand('LEFT')}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-16 w-12 rounded-l-full bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="يسار"
            >
              <ChevronLeft size={24} />
            </button>

            {/* RIGHT Button */}
            <button 
              onClick={() => sendTvCommand('RIGHT')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-16 w-12 rounded-r-full bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="يمين"
            >
              <ChevronRight size={24} />
            </button>

            {/* Center OK / Select Button */}
            <button 
              onClick={() => sendTvCommand('OK')}
              className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer border border-cyan-300/40"
            >
              OK
            </button>
          </div>

          {/* Volume, Mute & Channel Rockers */}
          <div className="grid grid-cols-3 gap-3 bg-black/40 border border-white/10 rounded-2xl p-3">
            
            {/* Volume Column */}
            <div className="flex flex-col items-center bg-white/5 rounded-xl p-2 border border-white/5">
              <button 
                onClick={() => handleVolumeChange(5)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/15 rounded-lg flex items-center justify-center text-white transition-all cursor-pointer active:scale-95"
              >
                <ChevronUp size={18} />
              </button>
              <span className="text-[11px] font-mono font-black text-slate-300 my-2">VOL +</span>
              <button 
                onClick={() => handleVolumeChange(-5)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/15 rounded-lg flex items-center justify-center text-white transition-all cursor-pointer active:scale-95"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            {/* Center Mute & Info */}
            <div className="flex flex-col justify-between items-center py-1">
              <button 
                onClick={handleMute}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer border ${
                  isMuted 
                    ? 'bg-red-500/20 border-red-500/50 text-red-400' 
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
                title="كتم الصوت"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              <button 
                onClick={() => sendTvCommand('INFO')}
                className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
                title="معلومات القناة / البث"
              >
                <Info size={18} />
              </button>
            </div>

            {/* Channel Column */}
            <div className="flex flex-col items-center bg-white/5 rounded-xl p-2 border border-white/5">
              <button 
                onClick={() => handleChannelChange(1)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/15 rounded-lg flex items-center justify-center text-white transition-all cursor-pointer active:scale-95"
              >
                <ChevronUp size={18} />
              </button>
              <span className="text-[11px] font-mono font-black text-slate-300 my-2">CH +</span>
              <button 
                onClick={() => handleChannelChange(-1)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/15 rounded-lg flex items-center justify-center text-white transition-all cursor-pointer active:scale-95"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* Media Playback Controls */}
          <div className="flex items-center justify-between gap-2 bg-white/5 border border-white/5 rounded-2xl p-2.5">
            <button 
              onClick={() => sendTvCommand('REWIND_10')}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all cursor-pointer"
              title="ترجيع 10 ثواني"
            >
              <RotateCcw size={16} />
            </button>

            <button 
              onClick={() => sendTvCommand('PLAY')}
              className="flex-1 py-2.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/30 flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer"
            >
              <Play size={14} /> تشغيل
            </button>

            <button 
              onClick={() => sendTvCommand('PAUSE')}
              className="flex-1 py-2.5 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer"
            >
              <Pause size={14} /> إيقاف مؤقت
            </button>

            <button 
              onClick={() => sendTvCommand('FORWARD_10')}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all cursor-pointer"
              title="تقديم 10 ثواني"
            >
              <RotateCw size={16} />
            </button>
          </div>

          {/* TV Four Color Satellite Keys (Red, Green, Yellow, Blue) */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <button 
              onClick={() => sendTvCommand('COLOR_RED')}
              className="h-4 rounded-full bg-red-600 hover:bg-red-500 shadow-sm cursor-pointer" 
              title="الزر الأحمر" 
            />
            <button 
              onClick={() => sendTvCommand('COLOR_GREEN')}
              className="h-4 rounded-full bg-emerald-600 hover:bg-emerald-500 shadow-sm cursor-pointer" 
              title="الزر الأخضر" 
            />
            <button 
              onClick={() => sendTvCommand('COLOR_YELLOW')}
              className="h-4 rounded-full bg-amber-500 hover:bg-amber-400 shadow-sm cursor-pointer" 
              title="الزر الأصفر" 
            />
            <button 
              onClick={() => sendTvCommand('COLOR_BLUE')}
              className="h-4 rounded-full bg-blue-600 hover:bg-blue-500 shadow-sm cursor-pointer" 
              title="الزر الأزرق" 
            />
          </div>
        </div>
      )}

      {/* TAB 2: Installed Apps Launchers */}
      {activeTab === 'apps' && (
        <div className="space-y-4">
          <span className="text-xs text-slate-400 font-bold block">
            التطبيقات المتوفرة لنظام ({selectedBrand.name}):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {selectedBrand.apps.map(app => (
              <button
                key={app.id}
                onClick={() => {
                  sendTvCommand('LAUNCH_APP', { app: app.id, name: app.name });
                  showToast(`جاري تشغيل تطبيق ${app.name} 🎬`);
                }}
                className="p-3.5 bg-black/40 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 rounded-2xl flex flex-col items-center gap-2.5 transition-all group cursor-pointer hover:scale-105"
              >
                <div className={`w-12 h-12 rounded-2xl ${app.bg} flex items-center justify-center text-xl shadow-lg group-hover:scale-110 transition-transform`}>
                  {app.icon}
                </div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                  {app.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Video Inputs & HDMI Switcher */}
      {activeTab === 'inputs' && (
        <div className="space-y-4">
          <span className="text-xs text-slate-400 font-bold block">
            مداخل ومصادر الفيديو (Inputs & HDMI):
          </span>
          <div className="space-y-2.5">
            {selectedBrand.inputs.map(input => {
              const isCurrent = activeInput === input.id;
              return (
                <button
                  key={input.id}
                  onClick={() => {
                    setActiveInput(input.id);
                    sendTvCommand('SELECT_INPUT', { input: input.id });
                    showToast(`تم التبديل إلى مدخل: ${input.name}`);
                  }}
                  className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                    isCurrent 
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-lg shadow-cyan-500/20' 
                      : 'bg-black/40 border-white/10 text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MonitorPlay size={18} className={isCurrent ? 'text-cyan-400' : 'text-slate-400'} />
                    <span className="text-xs font-bold">{input.name}</span>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] bg-cyan-400 text-black px-2 py-0.5 rounded-full font-black">
                      المصدر الحالي
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Numeric Keypad for Channels */}
      {activeTab === 'numpad' && (
        <div className="space-y-4">
          <span className="text-xs text-slate-400 font-bold block text-center">
            لوحة الأرقام لإدخال رقم القناة المباشر:
          </span>
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button
                key={n}
                onClick={() => handleNumClick(n)}
                className="py-3.5 rounded-2xl bg-white/5 hover:bg-cyan-600/30 border border-white/10 hover:border-cyan-400 text-white font-mono text-lg font-black transition-all cursor-pointer active:scale-90"
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => sendTvCommand('PREV_CH')}
              className="py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              السابقة
            </button>
            <button
              onClick={() => handleNumClick(0)}
              className="py-3.5 rounded-2xl bg-white/5 hover:bg-cyan-600/30 border border-white/10 hover:border-cyan-400 text-white font-mono text-lg font-black transition-all cursor-pointer active:scale-90"
            >
              0
            </button>
            <button
              onClick={() => sendTvCommand('ENTER')}
              className="py-3.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              تأكيد
            </button>
          </div>
        </div>
      )}

      {/* Fixed Floating Action Badge on Right Side of Screen (100% Fixed - No Remote Movement) */}
      <AnimatePresence>
        {lastActionToast && (
          <motion.div 
            key={lastActionToast}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="fixed top-24 right-4 sm:right-8 z-50 pointer-events-none flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-cyan-500/50 text-cyan-300 text-xs font-black shadow-2xl shadow-cyan-950/80"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <span>{lastActionToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
