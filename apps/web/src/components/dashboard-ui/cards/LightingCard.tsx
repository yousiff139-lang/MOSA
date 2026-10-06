"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, MoreHorizontal } from 'lucide-react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { useTranslation } from '@/hooks/useTranslation';

export function LightingCard({ device }: { device: any }) {
  const toggleDevice = useSmartHomeStore(s => s.toggleDevice);
  const { t } = useTranslation();
  
  const [brightness, setBrightness] = useState(device?.state?.brightness || 80);
  
  // Provide safe fallbacks if device is undefined
  if (!device) return null;

  const isOn = device.state === 'ON' || device.currentState === 'ON' || (device.state as any)?.isOn === true || device.state?.on === true;

  const handleDim = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const level = parseInt(e.target.value, 10);
    setBrightness(level);
  };

  const handleDimEnd = async (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/devices/${device.id}/dim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ level: brightness })
      });
    } catch(err) { console.error(err); }
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={`relative overflow-hidden rounded-[2.5rem] p-6 h-[220px] flex flex-col justify-between shadow-2xl transition-all duration-500 ${
        isOn 
          ? 'bg-gradient-to-br from-amber-200/90 to-orange-400/90' 
          : 'bg-white/5 border border-white/10'
      } backdrop-blur-xl`}
    >
      <div 
        className="absolute inset-0 cursor-pointer z-0" 
        onClick={() => toggleDevice(device.id)}
      ></div>

      <div className="flex justify-between items-start z-10 pointer-events-none">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
          isOn ? 'bg-white/30 text-amber-900 shadow-[0_0_20px_rgba(255,255,255,0.5)]' : 'bg-white/10 text-white'
        }`}>
          <Lightbulb size={24} />
        </div>
        <div className={`w-3 h-3 rounded-full ${isOn ? 'bg-white shadow-[0_0_10px_white]' : 'bg-white/20'}`}></div>
      </div>

      <div className="z-10">
        <h3 className={`font-bold text-xl mb-1 ${isOn ? 'text-amber-950' : 'text-white'}`}>{device.name}</h3>
        <div className="flex items-center gap-2">
          <p className={`text-xs font-bold ${isOn ? 'text-white/80' : 'text-gray-500'} mt-1`}>
            {isOn ? t('device.on') : t('device.off')}
          </p>
          {isOn && (
            <div className="bg-black/10 px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-950/70">
              {brightness}%
            </div>
          )}
        </div>
        
        {isOn && (
          <input 
            type="range" 
            min="0" max="100" 
            value={brightness}
            onChange={handleDim}
            onMouseUp={handleDimEnd}
            onTouchEnd={handleDimEnd}
            className="w-full mt-3 h-1.5 bg-black/10 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, rgba(0,0,0,0.5) ${brightness}%, rgba(0,0,0,0.1) ${brightness}%)`
            }}
          />
        )}
      </div>

      {/* Decorative Glow */}
      {isOn && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/40 rounded-full blur-3xl pointer-events-none"></div>
      )}
    </motion.div>
  );
}
