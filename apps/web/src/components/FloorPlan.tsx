"use client";
import React, { useState, useEffect, memo } from 'react';
import { Device } from '@/types';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import { Thermometer, Fan, Plug, Lightbulb, Map, Eye, Wind } from 'lucide-react';

interface FloorPlanDevice {
  id: string;
  deviceId: string;
  x: number;
  y: number;
}

interface FloorPlanData {
  id: string;
  name: string;
  devices: FloorPlanDevice[];
}

interface FloorPlanProps {
  devices: Device[];
  selectedDeviceId?: string | null;
  onSelectDevice?: (id: string | null) => void;
  onToggle: (id: string, boardId?: string) => void;
}

export const FloorPlan = memo(function FloorPlan({ devices, selectedDeviceId, onSelectDevice, onToggle }: FloorPlanProps) {
  const [floorPlans, setFloorPlans] = useState<FloorPlanData[]>([]);
  const [currentFloorIndex, setCurrentFloorIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const { lang } = useRuntimeStore();

  useEffect(() => {
    fetch('/api/floorplan', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(r => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFloorPlans(data);
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const getDeviceIcon = (device: Device, isOn: boolean) => {
    const type = device.type?.toUpperCase() || '';
    if (type.includes('SENSOR_TEMP')) return <Thermometer size={20} className={isOn ? 'text-cyan-400' : 'text-gray-500'} />;
    if (type.includes('SENSOR_MOTION')) return <Eye size={20} className={isOn ? 'text-red-500' : 'text-gray-500'} />;
    if (type === 'SOCKET') return <Plug size={20} className={isOn ? 'text-emerald-500' : 'text-gray-500'} />;
    if (type === 'CLIMATE') return <Wind size={20} className={isOn ? 'text-cyan-400' : 'text-gray-500'} />;
    return <Lightbulb size={20} className={isOn ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'text-gray-500'} />;
  };

  const handleDragStart = (e: React.DragEvent, deviceId: string, fpDeviceId?: string) => {
    e.dataTransfer.setData('deviceId', deviceId);
    if (fpDeviceId) e.dataTransfer.setData('fpDeviceId', fpDeviceId);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const deviceId = e.dataTransfer.getData('deviceId');
    const fpDeviceId = e.dataTransfer.getData('fpDeviceId');
    
    // Calculate drop coordinates relative to container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!floorPlans.length) return;
    const currentPlan = floorPlans[0];

    // Optimistic update
    let updatedPlans = [...floorPlans];
    if (fpDeviceId) {
      // Move existing
      const dev = updatedPlans[0].devices.find(d => d.id === fpDeviceId);
      if (dev) {
        dev.x = x;
        dev.y = y;
      }
      setFloorPlans(updatedPlans);
      
      try {
        await fetch(`/api/floorplan/devices/${fpDeviceId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ x, y })
        });
      } catch(e) {
        console.error(e);
      }
    } else {
      // Add new
      try {
        const res = await fetch('/api/floorplan/devices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ floorPlanId: currentPlan.id, deviceId, x, y })
        });
        const newFpDevice = await res.json();
        updatedPlans[0].devices.push(newFpDevice);
        setFloorPlans(updatedPlans);
      } catch(e) {
        console.error(e);
      }
    }
  };

  const allowDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (loading) return <div className="w-full h-full min-h-[400px] flex items-center justify-center">Loading...</div>;

  const currentPlan = floorPlans[currentFloorIndex] || floorPlans[0];
  const mappedDeviceIds = currentPlan?.devices.map(d => d.deviceId) || [];
  const stagedDevices = devices.filter(d => !mappedDeviceIds.includes(d.id.toString()));

  return (
    <div className="w-full h-full p-8 flex flex-col gap-4">
      <header className="flex flex-col gap-4 mb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <Map className="text-[#00f0ff]" size={20} />
               {lang === 'ar' ? 'مخطط التوأم الرقمي' : 'The Digital Twin Floor Plan'}
            </h2>
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              Secure ✓
            </span>
          </div>
          
          {/* Floor Selector */}
          {floorPlans.length > 1 ? (
            <select
              value={currentFloorIndex}
              onChange={(e) => setCurrentFloorIndex(Number(e.target.value))}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none cursor-pointer hover:bg-slate-800 transition-colors"
            >
              {floorPlans.map((fp, idx) => (
                <option key={fp.id} value={idx}>{fp.name}</option>
              ))}
            </select>
          ) : (
            <div 
              onClick={() => {
                if (floorPlans.length === 1) {
                  const simulatedFirstFloor = {
                    id: 'first-floor-sim',
                    name: lang === 'ar' ? 'الطابق الأول' : 'First Floor',
                    devices: []
                  };
                  setFloorPlans([...floorPlans, simulatedFirstFloor]);
                  setCurrentFloorIndex(1);
                }
              }}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-1.5 text-xs text-white font-bold flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors"
            >
              <span>{lang === 'ar' ? 'الطابق الأرضي (اضغط لتفعيل الطوابق)' : 'Ground Floor (Click to enable floors)'}</span>
              <span className="text-[10px] opacity-50">▲</span>
            </div>
          )}
        </div>

        {/* Floor Plan Tabs */}
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <div className="flex gap-4 text-xs font-bold text-gray-500">
            {['الرئيسية', 'السيناريو', 'الليل', 'غرفة', 'المبنى'].map((tab) => (
              <button key={tab} className="hover:text-white transition-colors">{tab}</button>
            ))}
          </div>
          
          {/* Filter Tabs */}
          <div className="flex gap-3 text-xs font-bold">
            {['الكل', 'الإضاءة', 'المناخ', 'الأمان', 'الأمبيا', 'المبنى'].map((filter, i) => (
              <button key={filter} className={`px-3 py-1 rounded-lg transition-colors ${i === 0 ? 'bg-white/10 text-white border border-white/10' : 'text-gray-500 hover:text-white'}`}>
                {filter}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* CANVAS */}
      <div 
        className="flex-1 bg-[#0b0e14]/80 border border-white/10 rounded-2xl relative min-h-[500px] overflow-hidden"
        onDrop={handleDrop}
        onDragOver={allowDrop}
      >
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.05] pointer-events-none"></div>
        
        {!currentPlan && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <Map className="text-gray-600 mb-4 animate-pulse" size={48} />
            <p className="text-gray-400 font-bold text-lg">
              {lang === 'ar' ? 'لا توجد غرف أو أجهزة لعرضها على الخريطة' : 'لا توجد غرف أو أجهزة لعرضها على الخريطة'}
            </p>
            <p className="text-gray-600 text-sm mt-2">
              {lang === 'ar' ? 'يرجى تهيئة المخطط وإضافة الأجهزة في لوحة التحكم' : 'Please configure the layout and add devices in the settings.'}
            </p>
          </div>
        )}
        
        {currentPlan?.devices.map(fpd => {
          const device = devices.find(d => d.id.toString() === fpd.deviceId);
          if (!device) return null;
          const isOn = String(device.state) === 'ON' || String(device.state) === '1' || String(device.state) === 'true';
          
          return (
            <div 
              key={fpd.id}
              draggable
              onDragStart={(e) => handleDragStart(e, fpd.deviceId, fpd.id)}
              className="absolute cursor-grab active:cursor-grabbing p-2 rounded-full hover:bg-white/10 transition-colors flex flex-col items-center gap-1 group"
              style={{ left: fpd.x - 20, top: fpd.y - 20 }}
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectDevice) {
                    onSelectDevice(device.id.toString());
                  } else {
                    onToggle(device.id.toString(), device.boardId);
                  }
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                  selectedDeviceId === device.id.toString()
                    ? 'bg-[#b53cff]/20 border-[#b53cff] shadow-[0_0_15px_rgba(181,60,255,0.6)] animate-pulse'
                    : isOn
                      ? 'bg-[#00f0ff]/20 border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                      : 'bg-[#1a2333] border-white/20 hover:border-white/50'
                }`}
              >
                {getDeviceIcon(device, isOn)}
              </button>
              <span className="text-[10px] font-bold text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm pointer-events-none">
                {device.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* STAGING AREA */}
      {stagedDevices.length > 0 && (
        <div className="mt-4 p-4 border border-dashed border-white/20 rounded-xl bg-white/5">
          <h3 className="text-sm font-bold text-white/50 mb-3">{lang === 'ar' ? 'أجهزة بانتظار التعيين (اسحب للإضافة)' : 'Staged Devices (Drag to place)'}</h3>
          <div className="flex flex-wrap gap-4">
            {stagedDevices.map(device => {
              const isOn = String(device.state) === 'ON' || String(device.state) === '1' || String(device.state) === 'true';
              return (
                <div 
                  key={device.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, device.id.toString())}
                  className="flex items-center gap-2 bg-[#1a2333] border border-white/10 px-3 py-2 rounded-lg cursor-grab hover:bg-white/10 transition-colors"
                >
                  {getDeviceIcon(device, isOn)}
                  <span className="text-xs font-bold text-white/80">{device.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
