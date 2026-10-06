"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Volume2, Music } from 'lucide-react';
import { useSmartHome } from '@/hooks/useSmartHome';

export function MediaControlCard() {
  const { sendCommand } = useSmartHome();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    sendCommand('media', { type: 'media_control', action: isPlaying ? 'pause' : 'play' });
  };

  const handleVolume = (e: any) => {
    const val = parseInt(e.target.value);
    setVolume(val);
    sendCommand('media', { type: 'media_control', action: 'volume', value: val });
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="relative overflow-hidden rounded-[2.5rem] p-6 h-full min-h-[220px] flex flex-col justify-between shadow-2xl transition-all duration-500 bg-white/5 border border-white/10 backdrop-blur-xl"
    >
      <div className="flex justify-between items-start z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
            <Music size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg leading-tight">مكبر الصوت الذكي</h3>
            <p className="text-white/60 text-sm">الصالة الرئيسية</p>
          </div>
        </div>
      </div>

      <div className="z-10 mt-4">
        <div className="flex justify-center items-center gap-6 mb-6">
          <button className="text-white/60 hover:text-white transition-colors">
            <SkipBack size={24} />
          </button>
          <button 
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
          </button>
          <button className="text-white/60 hover:text-white transition-colors">
            <SkipForward size={24} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Volume2 size={16} className="text-white/40" />
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={volume}
            onChange={handleVolume}
            className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

      {/* Decorative Blob */}
      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
    </motion.div>
  );
}
