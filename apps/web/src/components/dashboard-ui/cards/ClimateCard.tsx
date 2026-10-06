"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Thermometer, Wind, Power } from 'lucide-react';
import { useSmartHome } from '@/hooks/useSmartHome';

export function ClimateCard() {
  const { devices, sendCommand } = useSmartHome();
  const climateDevice = devices.find(d => d.type === 'climate') || null;

  const [targetTemp, setTargetTemp] = useState(24);
  const [isOn, setIsOn] = useState(false);
  const [currentTemp, setCurrentTemp] = useState(25.5);

  useEffect(() => {
    if (climateDevice) {
      setIsOn(climateDevice.state === 'ON');
      if (climateDevice.targetTemp) setTargetTemp(climateDevice.targetTemp);
      if (climateDevice.currentTemp) setCurrentTemp(climateDevice.currentTemp);
    }
  }, [climateDevice]);

  const handleDrag = (event: any, info: any) => {
    if (!climateDevice) return;
    
    let newTemp = targetTemp;
    if (info.offset.y < -10) newTemp = Math.min(targetTemp + 1, 30);
    if (info.offset.y > 10) newTemp = Math.max(targetTemp - 1, 16);
    
    if (newTemp !== targetTemp) {
      setTargetTemp(newTemp);
      sendCommand(climateDevice.boardId || '', {
        type: 'climate_control',
        id: climateDevice.id,
        targetTemp: newTemp
      });
    }
  };

  const togglePower = () => {
    if (!climateDevice) return;
    const newState = !isOn;
    setIsOn(newState);
    sendCommand(climateDevice.boardId || '', {
      type: 'climate_control',
      id: climateDevice.id,
      state: newState ? 'ON' : 'OFF'
    });
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={`relative overflow-hidden rounded-[2.5rem] p-6 h-[300px] flex flex-col justify-between shadow-2xl transition-all duration-500 ${
        isOn 
          ? targetTemp < 24 ? 'bg-gradient-to-br from-blue-500/80 to-cyan-600/80' : 'bg-gradient-to-br from-orange-500/80 to-red-600/80'
          : 'bg-white/5 border border-white/10'
      } backdrop-blur-xl`}
    >
      <div className="flex justify-between items-start z-10">
        <div>
          <h3 className="text-white font-bold text-xl">مكيف الصالة</h3>
          <p className="text-white/60 text-sm">التبريد السريع</p>
        </div>
        <button 
          onClick={togglePower}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isOn ? 'bg-white text-blue-600 shadow-lg' : 'bg-white/10 text-white'
          }`}
        >
          <Power size={20} />
        </button>
      </div>

      <div className="flex items-end justify-between z-10">
        <div className="text-white">
          <div className="text-sm opacity-60 mb-1 flex items-center gap-1"><Thermometer size={14}/> الحرارة الحالية</div>
          <div className="text-3xl font-light">{currentTemp}°</div>
        </div>

        <motion.div 
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={handleDrag}
          className={`w-32 h-32 rounded-full border-4 flex items-center justify-center cursor-ns-resize shadow-[inset_0_4px_20px_rgba(0,0,0,0.2)] ${
            isOn ? 'border-white/30 bg-white/10' : 'border-white/5 bg-black/20'
          }`}
        >
          <div className="text-center text-white">
            <span className="text-4xl font-black">{targetTemp}°</span>
          </div>
        </motion.div>
      </div>

      {/* Glassy Background Circles */}
      <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
    </motion.div>
  );
}
