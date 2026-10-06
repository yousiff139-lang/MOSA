'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useDeviceStore } from '@/store/device.store';
import { useSensorStore } from '@/store/sensor.store';
import { homeApi } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Thermometer, Droplets, Lightbulb, Zap, Wifi, WifiOff, Home, Layers } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '@/store/auth.store';

export default function DashboardPage() {
  const { toggleDevice } = useSocket();
  const { mqttConnected, rooms, devices, setRooms, setDevices } = useDeviceStore();
  const { temperature, humidity } = useSensorStore();
  const user = useAuthStore(state => state.user);

  const { isLoading: loading } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      const [roomsRes, devicesRes] = await Promise.all([
        homeApi.getRooms(),
        homeApi.getDevices()
      ]);
      const fetchedRooms = roomsRes.data;
      const fetchedDevices = devicesRes.data;
      
      const mergedRooms = fetchedRooms.map((room: any) => ({
        ...room,
        devices: fetchedDevices.filter((d: any) => d.roomId === room.id)
      }));

      setRooms(mergedRooms);
      setDevices(fetchedDevices);
      return { rooms: mergedRooms, devices: fetchedDevices };
    },
    staleTime: 5000, // Re-fetch occasionally but rely on Zustand/Socket for live updates
  });

  const energyData = [
    { value: 120 }, { value: 150 }, { value: 100 }, { value: 200 }, 
    { value: 180 }, { value: 220 }, { value: 170 }, { value: 250 }
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-full text-zinc-500">جاري تحميل الأجهزة...</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white drop-shadow-md">
            مساء الخير، {user?.name || 'يوسف'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1 flex items-center gap-2">
            <span>📅 {new Date().toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold text-white drop-shadow-md">{temperature ?? '--'}°C</span>
            <span className="text-xs text-zinc-400">الحرارة بالخارج</span>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border backdrop-blur-md shadow-lg ${mqttConnected ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-emerald-500/20' : 'bg-red-500/20 border-red-500/30 text-red-400 shadow-red-500/20'}`}>
            {mqttConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span className="text-sm font-bold">{mqttConnected ? 'متصل' : 'غير متصل'}</span>
          </div>
        </div>
      </div>

      {/* Top Status Banner */}
      <div className="glass-card p-6 flex justify-between items-center bg-white/5 border-white/10 glow-border hover:shadow-[0_0_20px_var(--glow-color)] transition-shadow">
        <div>
          <h2 className="text-lg font-bold text-white">حالة المنزل الذكي</h2>
          <p className="text-sm text-zinc-400">{devices.filter(d => d.currentState === 'ON').length} أجهزة مشغلة</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center glow-bg">
          <Home className="text-white w-6 h-6 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <Card className="glass-card border-white/10 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader>
            <CardTitle className="text-zinc-300 text-sm font-medium flex items-center gap-2">
              <Thermometer size={16} /> التحكم بالحرارة
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-6 pb-8 relative">
            {/* Circular UI Mockup */}
            <div className="w-32 h-32 rounded-full border-4 border-white/10 flex items-center justify-center relative glow-border mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--glow-color-bright)] border-t-transparent border-r-transparent rotate-45" />
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">{temperature ?? '--'}°C</span>
                <span className="text-xs text-zinc-400">الداخلية</span>
              </div>
            </div>
            <div className="flex w-full justify-between px-4">
              <div className="flex items-center gap-2 text-sm text-zinc-400"><Droplets size={14} className="text-blue-400"/> الرطوبة {humidity ?? '--'}%</div>
              <div className="flex items-center gap-2 text-sm text-emerald-400"><div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /> التبريد نشط</div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden relative group md:col-span-1 lg:col-span-2">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-0">
            <CardTitle className="text-zinc-300 text-sm font-medium flex justify-between items-center">
              <div className="flex items-center gap-2"><Zap size={16} /> استهلاك الطاقة</div>
              <span className="text-white font-bold text-lg drop-shadow-md">2.4 kW</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-32 p-0 mt-4 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={energyData}>
                <Line type="monotone" dataKey="value" stroke="var(--glow-color-bright)" strokeWidth={3} dot={false} 
                  style={{ filter: 'drop-shadow(0 0 8px var(--glow-color))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-12">
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white drop-shadow-sm flex items-center gap-2"><Layers size={20}/> جدول الغرف والأجهزة</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rooms.length === 0 ? (
              <div className="col-span-full text-center text-zinc-500 py-12 glass-card">لا توجد غرف أو أجهزة لعرضها.</div>
            ) : (
              rooms.map((room) => (
                <Card key={room.id} className="glass-card border-white/10 group hover:glow-border transition-all">
                  <CardHeader className="border-b border-white/10 pb-4 bg-black/20 rounded-t-2xl">
                    <CardTitle className="text-lg text-white flex justify-between items-center">
                      <span>{room.name}</span>
                      <span className="text-xs px-2 py-1 bg-white/10 rounded-full text-zinc-300">{room.devices?.length || 0} أجهزة</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3 relative z-10">
                    {room.devices?.length === 0 && <span className="text-sm text-zinc-500">لا توجد أجهزة في هذه الغرفة.</span>}
                    {room.devices?.map((device) => {
                      const isOn = device.currentState === 'ON';
                      return (
                        <div key={device.id} className="flex justify-between items-center p-3 rounded-xl bg-black/30 border border-white/5 hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg transition-all ${isOn ? 'glow-active text-white' : 'bg-white/5 text-zinc-500'}`}>
                              {device.type === 'LIGHT' ? <Lightbulb size={18} /> : <Zap size={18} />}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-zinc-200 block">{device.name}</span>
                              <span className="text-xs text-zinc-500">{isOn ? 'مُشغل' : 'مطفأ'}</span>
                            </div>
                          </div>
                          <Switch 
                            checked={isOn}
                            onCheckedChange={(checked) => toggleDevice(device.id, device.mqttTopic, checked ? 'ON' : 'OFF')}
                            className="data-[state=checked]:bg-[var(--glow-color-bright)]"
                          />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity Sidebar */}
        <div className="lg:col-span-1">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white drop-shadow-sm flex items-center gap-2"><Zap size={20}/> آخر النشاطات</h2>
          </div>
          <Card className="glass-card border-white/10 bg-black/20">
            <CardContent className="pt-6 space-y-6">
              {[
                { time: 'منذ دقيقتين', event: 'تم تشغيل إضاءة المطبخ', type: 'info' },
                { time: 'منذ ساعة', event: 'تم تحديث نظام الحماية', type: 'success' },
                { time: 'منذ ساعتين', event: 'انقطاع اتصال جهاز الحديقة', type: 'warning' }
              ].map((activity, index) => (
                <div key={index} className="flex gap-4 items-start relative before:absolute before:right-[11px] before:top-6 before:bottom-[-24px] before:w-px before:bg-white/10 last:before:hidden">
                  <div className={`w-6 h-6 rounded-full flex-shrink-0 z-10 flex items-center justify-center border-4 border-[#0a0f1e] ${activity.type === 'success' ? 'bg-emerald-500' : activity.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                  <div>
                    <p className="text-sm text-zinc-200 font-medium">{activity.event}</p>
                    <p className="text-xs text-zinc-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
