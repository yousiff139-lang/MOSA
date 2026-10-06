"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Volume2, VolumeX, Volume1, Play, Pause, 
  Square, ChevronLeft, Disc, Sliders
} from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { getCleanVolumePct } from '@/lib/utils';

export function SidebarSpeakerControl() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(14);
  const [track, setTrack] = useState('جاهز للتشغيل');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetchAuth('/api/audio/status');
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setIsPlaying(Boolean(json.data.isPlaying));
          setIsMuted(Boolean(json.data.isMuted));
          if (typeof json.data.volume === 'number') {
            setVolume(json.data.volume);
          }
          if (json.data.track) {
            setTrack(json.data.track);
          }
        }
      }
    } catch {
      // Fallback gracefully if offline
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Volume Up: Steps volume up (+2, max 21)
  const handleVolumeUp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newVol = Math.min(volume + 2, 21);
    setVolume(newVol);
    setIsMuted(false);
    try {
      await fetchAuth('/api/audio/volume-up', { method: 'POST' });
    } catch (err) {
      console.error('Volume up failed', err);
    }
  };

  // Volume Down: Steps volume down (-2, min 0)
  const handleVolumeDown = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newVol = Math.max(volume - 2, 0);
    setVolume(newVol);
    if (newVol === 0) setIsMuted(true);
    try {
      await fetchAuth('/api/audio/volume-down', { method: 'POST' });
    } catch (err) {
      console.error('Volume down failed', err);
    }
  };

  // Mute Toggle: Mute to 0 or restore previous volume
  const handleToggleMute = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    try {
      const res = await fetchAuth('/api/audio/mute', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (typeof json.volume === 'number') setVolume(json.volume);
        if (typeof json.isMuted === 'boolean') setIsMuted(json.isMuted);
      }
    } catch (err) {
      console.error('Mute toggle failed', err);
    }
  };

  // Play / Stop Toggle
  const handleTogglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating(true);
    try {
      if (isPlaying) {
        const res = await fetchAuth('/api/audio/stop', { method: 'POST' });
        if (res.ok) {
          setIsPlaying(false);
          setTrack('متوقف');
        }
      } else {
        const res = await fetchAuth('/api/audio/play', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}) 
        });
        if (res.ok) {
          setIsPlaying(true);
        }
      }
    } catch (err) {
      console.error('Playback toggle failed', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // Direct Slider Change (0 - 21)
  const handleSliderChange = async (newVal: number) => {
    setVolume(newVal);
    if (newVal > 0) setIsMuted(false);
    else setIsMuted(true);
    try {
      await fetchAuth('/api/audio/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: newVal })
      });
    } catch (err) {
      console.error('Volume slider failed', err);
    }
  };

  const volumePct = getCleanVolumePct(volume);

  return (
    <div 
      className="mx-3 mb-2.5 p-3 rounded-2xl bg-gradient-to-br from-[#0c1427]/90 via-[#0d1629]/95 to-[#070d1a] border border-cyan-500/20 hover:border-cyan-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-300"
      dir="rtl"
    >
      {/* Top Header: Link to Full Audio Page */}
      <Link 
        href="/audio" 
        className="flex items-center justify-between group mb-2.5 cursor-pointer pb-2 border-b border-white/5"
        title="فتح صفحة التحكم الصوتي الشاملة"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
            isPlaying 
              ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)] border border-cyan-400/40' 
              : 'bg-white/5 text-slate-400 border border-white/10'
          }`}>
            {isPlaying ? (
              <Disc size={15} className="animate-spin text-cyan-400" />
            ) : isMuted ? (
              <VolumeX size={15} className="text-rose-400" />
            ) : (
              <Volume2 size={15} className="text-cyan-400" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-white group-hover:text-cyan-300 transition-colors truncate">
              التحكم بالسماعات (Hi-Fi)
            </span>
            <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
              {isMuted ? 'الصوت مكتوم 🔇' : isPlaying ? track : 'وضع الاستعداد'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${
            isPlaying 
              ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse' 
              : 'bg-slate-500'
          }`} />
          <ChevronLeft size={14} className="text-slate-500 group-hover:text-cyan-400 group-hover:-translate-x-0.5 transition-all" />
        </div>
      </Link>

      {/* Volume Level Display & Direct Slider */}
      <div className="space-y-1.5 mb-2.5 px-0.5">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-slate-400 flex items-center gap-1">
            <Sliders size={11} className="text-cyan-400" />
            <span>مستوى الصوت</span>
          </span>
          <span className={`font-mono text-[11px] font-black ${
            isMuted 
              ? 'text-rose-400' 
              : volumePct > 80 
                ? 'text-amber-400' 
                : 'text-cyan-300'
          }`}>
            {isMuted ? 'مكتوم (0%)' : `${volume} / 21 (${volumePct}%)`}
          </span>
        </div>

        {/* Tactile Mini Slider */}
        <input 
          type="range"
          min="0"
          max="21"
          value={isMuted ? 0 : volume}
          onChange={(e) => handleSliderChange(parseInt(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 transition-all hover:h-2"
        />
      </div>

      {/* Tactile Quick Control Buttons: Vol Down (-), Vol Up (+), Mute, Play/Stop */}
      <div className="grid grid-cols-4 gap-1.5 pt-1">
        
        {/* 1. Vol Down (تنصية) */}
        <button
          onClick={handleVolumeDown}
          className="py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 hover:border-cyan-500/30 text-slate-300 hover:text-white transition-all flex flex-col items-center justify-center gap-0.5 shadow-sm"
          title="تنصية الصوت (-2)"
        >
          <span className="text-[12px] font-black leading-none">−</span>
          <span className="text-[9px] font-bold text-slate-400 leading-none">تنصية</span>
        </button>

        {/* 2. Vol Up (تعلية) */}
        <button
          onClick={handleVolumeUp}
          className="py-1.5 px-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 hover:border-cyan-500/30 text-slate-300 hover:text-white transition-all flex flex-col items-center justify-center gap-0.5 shadow-sm"
          title="تعلية الصوت (+2)"
        >
          <span className="text-[12px] font-black leading-none">+</span>
          <span className="text-[9px] font-bold text-slate-400 leading-none">تعلية</span>
        </button>

        {/* 3. Mute / Unmute Toggle */}
        <button
          onClick={handleToggleMute}
          className={`py-1.5 px-2 rounded-xl active:scale-95 border transition-all flex flex-col items-center justify-center gap-0.5 shadow-sm ${
            isMuted 
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.2)]' 
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
          }`}
          title={isMuted ? "إلغاء كتم الصوت" : "كتم الصوت فوراً"}
        >
          {isMuted ? (
            <VolumeX size={13} className="text-rose-400" />
          ) : (
            <Volume1 size={13} className="text-cyan-400" />
          )}
          <span className="text-[9px] font-bold leading-none">
            {isMuted ? 'صامت' : 'كتم'}
          </span>
        </button>

        {/* 4. Play / Stop Toggle */}
        <button
          onClick={handleTogglePlay}
          disabled={isUpdating}
          className={`py-1.5 px-2 rounded-xl active:scale-95 border transition-all flex flex-col items-center justify-center gap-0.5 shadow-sm ${
            isPlaying 
              ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
              : 'bg-gradient-to-r from-blue-600/30 to-cyan-600/30 hover:from-blue-600/40 hover:to-cyan-600/40 border-cyan-500/30 text-white'
          }`}
          title={isPlaying ? "إيقاف التشغيل" : "تشغيل الصوت"}
        >
          {isPlaying ? (
            <Pause size={13} className="text-cyan-300" />
          ) : (
            <Play size={13} className="text-cyan-400" />
          )}
          <span className="text-[9px] font-bold leading-none">
            {isPlaying ? 'إيقاف' : 'تشغيل'}
          </span>
        </button>

      </div>
    </div>
  );
}
