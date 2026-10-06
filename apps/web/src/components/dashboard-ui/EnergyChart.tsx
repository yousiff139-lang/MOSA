'use client';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap } from 'lucide-react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

export default function EnergyChart() {
  const powerHistory = useSmartHomeStore(s => s.powerHistory);

  // Map powerHistory to the format recharts expects
  const data = powerHistory.map(p => ({
    time: p.time,
    today: p.power,
    avg: p.power * 0.85
  }));

  if (data.length === 0) {
    return (
      <div className="h-64 w-full flex flex-col items-center justify-center border border-white/5 rounded-2xl bg-black/40 text-slate-400 text-xs font-bold gap-2">
        <Zap size={28} className="text-slate-500 animate-pulse" />
        <span>لا توجد قراءات طاقة حقيقية مسجلة حالياً. سيتم تحديث الرسم فور استقبال البيانات من أجهزة ESP32</span>
      </div>
    );
  }

  return (
    <div className="h-72 w-full mt-4" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorToday" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#b53cff" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#b53cff" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis dataKey="time" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0b0e14', borderColor: '#ffffff20', borderRadius: '12px', color: '#f8fafc' }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Area type="monotone" dataKey="today" name="اليوم (W)" stroke="#00f0ff" strokeWidth={3} fillOpacity={1} fill="url(#colorToday)" />
          <Area type="monotone" dataKey="avg" name="المتوسط (W)" stroke="#b53cff" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorAvg)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const mockData = [
  { time: '00:00', today: 120, avg: 100 },
  { time: '04:00', today: 80, avg: 90 },
  { time: '08:00', today: 350, avg: 300 },
  { time: '12:00', today: 420, avg: 380 },
  { time: '16:00', today: 500, avg: 450 },
  { time: '20:00', today: 300, avg: 350 },
];
