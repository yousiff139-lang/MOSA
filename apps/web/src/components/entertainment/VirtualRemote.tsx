'use client';
import React, { useState } from 'react';
import { Power, Volume2, VolumeX, Volume1, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Circle, Home, Menu, ArrowLeft } from 'lucide-react';
import { m } from 'framer-motion';

export const VirtualRemote = ({ deviceId, onCommand }: { deviceId: string, onCommand: (action: string, value?: any) => void }) => {
  const [isMuted, setIsMuted] = useState(false);

  const handleCommand = (action: string, value?: any) => {
    if (action === 'MUTE_TOGGLE') {
      setIsMuted(!isMuted);
      onCommand(isMuted ? 'UNMUTE' : 'MUTE');
    } else {
      onCommand(action, value);
    }
  };

  const DPadButton = ({ icon: Icon, action, className = '' }: any) => (
    <button 
      onClick={() => handleCommand('SEND_KEY', action)}
      className={`p-4 bg-[#1e293b] hover:bg-blue-600 active:scale-95 transition-all text-white rounded-xl flex items-center justify-center shadow-lg border border-[#334155] ${className}`}
    >
      <Icon className="w-6 h-6" />
    </button>
  );

  return (
    <div className="bg-[#0f1523] rounded-3xl p-6 flex flex-col items-center gap-8 w-72 mx-auto border border-[#1e293b] shadow-2xl">
      {/* Top Section */}
      <div className="flex justify-between w-full">
        <button onClick={() => handleCommand('POWER_TOGGLE')} className="p-3 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <Power className="w-6 h-6" />
        </button>
        <button onClick={() => handleCommand('SEND_KEY', 'SOURCE')} className="p-3 rounded-full bg-[#1e293b] text-gray-300 hover:bg-gray-700 transition-all">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* D-Pad Section */}
      <div className="relative w-48 h-48 bg-[#161e2e] rounded-full p-2 border-4 border-[#1e293b] shadow-inner">
        <div className="absolute top-2 left-1/2 -translate-x-1/2">
          <DPadButton icon={ChevronUp} action="UP" className="!bg-transparent border-none hover:!bg-white/10" />
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <DPadButton icon={ChevronDown} action="DOWN" className="!bg-transparent border-none hover:!bg-white/10" />
        </div>
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          <DPadButton icon={ChevronLeft} action="LEFT" className="!bg-transparent border-none hover:!bg-white/10" />
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <DPadButton icon={ChevronRight} action="RIGHT" className="!bg-transparent border-none hover:!bg-white/10" />
        </div>
        
        {/* Center OK Button */}
        <button 
          onClick={() => handleCommand('SEND_KEY', 'OK')}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-500 active:scale-90 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] text-white font-bold"
        >
          OK
        </button>
      </div>

      {/* Nav Section */}
      <div className="flex justify-between w-full px-4">
        <button onClick={() => handleCommand('SEND_KEY', 'BACK')} className="p-3 rounded-full bg-[#1e293b] text-gray-300 hover:bg-gray-700 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button onClick={() => handleCommand('SEND_KEY', 'HOME')} className="p-3 rounded-full bg-[#1e293b] text-gray-300 hover:bg-gray-700 transition-all">
          <Home className="w-5 h-5" />
        </button>
      </div>

      {/* Volume / Channel Section */}
      <div className="flex justify-between w-full bg-[#161e2e] rounded-2xl p-2 border border-[#1e293b]">
        <div className="flex flex-col gap-2">
          <button onClick={() => handleCommand('VOL_UP')} className="p-3 rounded-xl bg-[#1e293b] hover:bg-gray-700 text-white"><ChevronUp className="w-5 h-5" /></button>
          <div className="text-center text-xs text-gray-500 font-bold tracking-widest">VOL</div>
          <button onClick={() => handleCommand('VOL_DOWN')} className="p-3 rounded-xl bg-[#1e293b] hover:bg-gray-700 text-white"><ChevronDown className="w-5 h-5" /></button>
        </div>
        
        <div className="flex items-center">
          <button onClick={() => handleCommand('MUTE_TOGGLE')} className={`p-4 rounded-full transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-[#1e293b] text-gray-300'}`}>
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={() => handleCommand('SEND_KEY', 'CH_UP')} className="p-3 rounded-xl bg-[#1e293b] hover:bg-gray-700 text-white"><ChevronUp className="w-5 h-5" /></button>
          <div className="text-center text-xs text-gray-500 font-bold tracking-widest">CH</div>
          <button onClick={() => handleCommand('SEND_KEY', 'CH_DOWN')} className="p-3 rounded-xl bg-[#1e293b] hover:bg-gray-700 text-white"><ChevronDown className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
};
