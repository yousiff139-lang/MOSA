'use client';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Thermometer, ThermometerSun, ThermometerSnowflake, Wind, Power } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';

export default function ClimatePage() {
  const [devices, setDevices] = useState<any[]>([]);
  useSocket(); // listen to socket

  useEffect(() => {
    api.get('/climate').then(res => setDevices(res.data)).catch(console.error);
    
    // Quick mock for UI when backend fails
    setDevices([
      {
        id: '1',
        name: 'مكيف الصالة',
        room: { name: 'الصالة الرئيسية' },
        state: { isOn: true, temperature: 22, mode: 'COOL', fanSpeed: 'AUTO' }
      },
      {
        id: '2',
        name: 'مكيف غرفة النوم',
        room: { name: 'غرفة النوم' },
        state: { isOn: false, temperature: 24, mode: 'AUTO', fanSpeed: 'LOW' }
      }
    ]);
  }, []);

  const updateClimate = async (id: string, updates: any) => {
    // Optimistic update
    setDevices(prev => prev.map(d => {
      if (d.id === id) {
        return { ...d, state: { ...d.state, ...updates } };
      }
      return d;
    }));

    try {
      const dev = devices.find(d => d.id === id);
      if (!dev) return;
      const payload = { ...dev.state, ...updates };
      await api.post(`/climate/${id}/set`, payload);
    } catch (err) {
      console.error('Failed to update climate', err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <Thermometer className="text-blue-400" size={32} />
          التكييف والحرارة
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map(device => {
          const state = device.state || { isOn: false, temperature: 24, mode: 'COOL', fanSpeed: 'AUTO' };
          
          return (
            <Card key={device.id} className={`border-zinc-800 transition-colors ${state.isOn ? 'bg-zinc-900' : 'bg-zinc-950/50'}`}>
              <CardContent className="p-6 flex flex-col relative">
                {/* Power Toggle */}
                <button 
                  onClick={() => updateClimate(device.id, { power: state.isOn ? 'OFF' : 'ON' })}
                  className={`absolute top-6 left-6 p-3 rounded-full transition-colors ${state.isOn ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}
                >
                  <Power size={20} />
                </button>

                <div className="mb-8">
                  <h3 className="text-xl font-bold text-zinc-100">{device.name}</h3>
                  <p className="text-sm text-zinc-500">{device.room?.name || 'بدون غرفة'}</p>
                </div>

                {/* Temperature Display */}
                <div className="flex items-center justify-center gap-8 my-4">
                  <button onClick={() => updateClimate(device.id, { temperature: Math.max(16, state.temperature - 1) })} className="w-12 h-12 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-2xl transition-transform active:scale-95 disabled:opacity-50" disabled={!state.isOn}>
                    -
                  </button>
                  <div className={`text-6xl font-light tabular-nums tracking-tighter ${!state.isOn ? 'text-zinc-600' : 'text-zinc-100'}`}>
                    {state.temperature}°
                  </div>
                  <button onClick={() => updateClimate(device.id, { temperature: Math.min(32, state.temperature + 1) })} className="w-12 h-12 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-2xl transition-transform active:scale-95 disabled:opacity-50" disabled={!state.isOn}>
                    +
                  </button>
                </div>

                {/* Modes */}
                <div className="mt-8">
                  <p className="text-xs text-zinc-500 mb-3 font-medium">الوضع (Mode)</p>
                  <div className="flex gap-2">
                    {[
                      { id: 'COOL', icon: ThermometerSnowflake, label: 'تبريد', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
                      { id: 'HEAT', icon: ThermometerSun, label: 'تدفئة', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
                      { id: 'FAN', icon: Wind, label: 'مروحة', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
                      { id: 'AUTO', icon: Thermometer, label: 'تلقائي', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' }
                    ].map(mode => (
                      <button 
                        key={mode.id}
                        disabled={!state.isOn}
                        onClick={() => updateClimate(device.id, { mode: mode.id })}
                        className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${state.mode === mode.id && state.isOn ? mode.color : 'bg-zinc-950 border-zinc-800 text-zinc-500'} ${!state.isOn && 'opacity-50 cursor-not-allowed'}`}
                      >
                        <mode.icon size={20} />
                        <span className="text-[10px] font-medium">{mode.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fan Speed */}
                <div className="mt-6">
                  <p className="text-xs text-zinc-500 mb-3 font-medium">سرعة المروحة</p>
                  <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-1">
                    {[
                      { id: 'LOW', label: 'منخفض' },
                      { id: 'MED', label: 'متوسط' },
                      { id: 'HIGH', label: 'عالي' },
                      { id: 'AUTO', label: 'تلقائي' }
                    ].map(speed => (
                      <button 
                        key={speed.id}
                        disabled={!state.isOn}
                        onClick={() => updateClimate(device.id, { fanSpeed: speed.id })}
                        className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${state.fanSpeed === speed.id && state.isOn ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'text-zinc-500'} ${!state.isOn && 'opacity-50 cursor-not-allowed'}`}
                      >
                        {speed.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
