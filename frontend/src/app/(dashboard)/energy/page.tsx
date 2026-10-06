'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Zap, Activity, BatteryCharging, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';

const API_BASE = 'http://localhost:8080/api';

export default function EnergyPage() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['energyHistory'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/telemetry/history`, { withCredentials: true });
      return res.data;
    }
  });

  const chartData = history.map((h: any) => ({
    time: new Date(h.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    power: h.powerUsage,
    kwh: h.totalKWh
  }));

  const deviceUsage = [
    { name: 'المكيف (الصالة)', usage: 800 },
    { name: 'سخان الماء', usage: 1200 },
    { name: 'الثلاجة', usage: 200 },
    { name: 'إضاءة السور', usage: 100 },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-700" dir="rtl">
      <div className="flex flex-col justify-between items-start mb-8 gap-4">
        <h1 className="text-3xl font-bold text-white drop-shadow-md">مراقبة الطاقة</h1>
        <p className="text-sm text-zinc-400">تحليلات لحظية وتاريخية لاستهلاك الكهرباء</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="glass-card border-blue-500/20 bg-blue-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-200">الاستهلاك اللحظي</CardTitle>
            <Activity className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">1,850 واط</div>
            <p className="text-xs text-blue-400/80 mt-1">طبيعي جداً</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-200">الاستهلاك اليومي</CardTitle>
            <Zap className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">18.2 kWh</div>
            <p className="text-xs text-emerald-400/80 mt-1">+2% عن الأمس</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-purple-500/20 bg-purple-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-200">التكلفة التقديرية</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">3.45 SAR</div>
            <p className="text-xs text-purple-400/80 mt-1">لليوم الحالي</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-amber-500/20 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-200">حالة الشبكة</CardTitle>
            <BatteryCharging className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">224 V</div>
            <p className="text-xs text-amber-400/80 mt-1">مستقر</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 glass-card border-[#1e293b] p-2">
          <CardHeader>
            <CardTitle className="text-lg text-white">منحنى الاستهلاك (الـ 24 ساعة الماضية)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#1e293b', borderRadius: '12px', color: '#f1f5f9' }}
                    itemStyle={{ color: '#3b82f6' }}
                  />
                  <Area type="monotone" dataKey="power" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPower)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-[#1e293b] p-2">
          <CardHeader>
            <CardTitle className="text-lg text-white">أكثر الأجهزة استهلاكاً</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deviceUsage} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} hide />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#1e293b', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#1e293b', borderRadius: '12px', color: '#f1f5f9' }}
                  />
                  <Bar dataKey="usage" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
