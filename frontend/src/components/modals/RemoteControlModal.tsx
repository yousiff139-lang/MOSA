import React, { useState } from 'react';
import { Power, Volume2, VolumeX, Volume1, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Circle, Home, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:8080/api';

interface RemoteControlModalProps {
  device: any;
  onClose: () => void;
}

export function RemoteControlModal({ device, onClose }: RemoteControlModalProps) {
  const [loadingCommand, setLoadingCommand] = useState<string | null>(null);

  const sendCommand = async (command: string) => {
    try {
      setLoadingCommand(command);
      await axios.post(`${API_BASE}/devices/${device.id}/remote`, { command }, { withCredentials: true });
    } catch (err) {
      console.error('Failed to send command', err);
    } finally {
      setTimeout(() => setLoadingCommand(null), 200); // Visual feedback delay
    }
  };

  const RemoteButton = ({ 
    command, 
    icon: Icon, 
    label, 
    className = "", 
    size = 24 
  }: { 
    command: string, 
    icon?: any, 
    label?: string, 
    className?: string,
    size?: number
  }) => (
    <button
      onClick={() => sendCommand(command)}
      disabled={loadingCommand !== null}
      className={`
        flex items-center justify-center transition-all duration-200 active:scale-95
        ${loadingCommand === command ? 'bg-primary/50 opacity-70' : 'bg-surface hover:bg-border'}
        text-text-primary rounded-xl shadow-sm border border-border
        ${className}
      `}
    >
      {Icon && <Icon size={size} className={loadingCommand === command ? 'animate-pulse' : ''} />}
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl border border-border p-6 flex flex-col relative overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-bold text-text-primary">{device.name}</h2>
            <p className="text-xs text-text-secondary font-mono">{device.ipAddress} • {device.protocol}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-border text-text-secondary transition-colors">
            <ArrowLeft size={20} />
          </button>
        </div>

        {/* Remote Body */}
        <div className="flex flex-col gap-6 items-center px-4">
          
          {/* Top Row: Power & Mute */}
          <div className="flex justify-between w-full px-4">
            <RemoteButton command="POWER" icon={Power} className="w-14 h-14 rounded-full bg-danger/10 hover:bg-danger/20 text-danger border-danger/20" />
            <RemoteButton command="MUTE" icon={VolumeX} className="w-14 h-14 rounded-full" />
          </div>

          {/* D-PAD (Directional Pad) */}
          <div className="relative w-48 h-48 my-4">
            {/* Background ring */}
            <div className="absolute inset-0 rounded-full border-4 border-border/50 bg-surface"></div>
            
            <RemoteButton command="UP" icon={ChevronUp} className="absolute top-2 left-1/2 -translate-x-1/2 w-14 h-12 bg-transparent border-none shadow-none hover:bg-border/50 rounded-t-full" />
            <RemoteButton command="DOWN" icon={ChevronDown} className="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-12 bg-transparent border-none shadow-none hover:bg-border/50 rounded-b-full" />
            <RemoteButton command="LEFT" icon={ChevronLeft} className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-14 bg-transparent border-none shadow-none hover:bg-border/50 rounded-l-full" />
            <RemoteButton command="RIGHT" icon={ChevronRight} className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-14 bg-transparent border-none shadow-none hover:bg-border/50 rounded-r-full" />
            
            {/* OK Button */}
            <RemoteButton command="ENTER" label="OK" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-primary text-white border-primary-hover shadow-lg shadow-primary/20 hover:bg-primary-hover" />
          </div>

          {/* Action Row: Home & Back */}
          <div className="flex gap-6 w-full justify-center">
            <RemoteButton command="BACK" icon={ArrowLeft} className="w-14 h-10 rounded-full" />
            <RemoteButton command="HOME" icon={Home} className="w-14 h-10 rounded-full" />
          </div>

          {/* Volume & Channel Rockers */}
          <div className="flex justify-between w-full mt-4 bg-surface p-2 rounded-3xl border border-border">
            
            {/* Volume */}
            <div className="flex flex-col gap-2 items-center w-16">
              <RemoteButton command="VOL_UP" icon={Volume2} size={18} className="w-full h-12 rounded-t-2xl border-none shadow-none bg-background hover:bg-border" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">VOL</span>
              <RemoteButton command="VOL_DOWN" icon={Volume1} size={18} className="w-full h-12 rounded-b-2xl border-none shadow-none bg-background hover:bg-border" />
            </div>

            {/* Channel */}
            <div className="flex flex-col gap-2 items-center w-16">
              <RemoteButton command="CH_UP" icon={ChevronUp} size={18} className="w-full h-12 rounded-t-2xl border-none shadow-none bg-background hover:bg-border" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">CH</span>
              <RemoteButton command="CH_DOWN" icon={ChevronDown} size={18} className="w-full h-12 rounded-b-2xl border-none shadow-none bg-background hover:bg-border" />
            </div>
            
          </div>

        </div>
      </div>
    </div>
  );
}
