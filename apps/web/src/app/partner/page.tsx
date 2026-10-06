'use client';

import React, { useEffect, useState } from 'react';
import { Users, Server, Activity, ArrowUpRight, DollarSign, Building, Cpu, ShieldCheck, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { fetchAuth } from '@/store/useSmartHomeStore';

export default function PartnerDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fallback Mock Data for Partner Overview
  const fallbackStats = [
    { name: 'المنازل والعقارات النشطة', value: '4 منازل', change: '+25%', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { name: 'إجمالي أجهزة ESP32 المربوطة', value: '18 جهاز', change: '+12%', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { name: 'استجابة MQTT المحلية (Latency)', value: '< 4ms', change: 'أوفلاين 100%', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { name: 'إجمالي استهلاك الطاقة الحالية', value: '1.24 kW', change: '-8% موفر', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  const fallbackGrowth = [
    { name: 'يناير', devices: 6, calls: 1200 },
    { name: 'فبراير', devices: 9, calls: 2400 },
    { name: 'مارس', devices: 12, calls: 4100 },
    { name: 'أبريل', devices: 15, calls: 6800 },
    { name: 'مايو', devices: 18, calls: 9200 },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetchAuth('/api/partner/stats');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to fetch partner stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const icons = [Building, Cpu, ShieldCheck, Zap];
  const statsList = data?.stats && data.stats.length > 0 ? data.stats : fallbackStats;
  const growthChart = data?.charts?.growth && data.charts.growth.length > 0 ? data.charts.growth : fallbackGrowth;

  return (
    <div className="p-4 sm:p-8 space-y-8 text-white dir-rtl text-right" dir="rtl">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-cyan-950/40 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <h2 className="text-2xl sm:text-3xl font-black text-white">لوحة تحكم وتحليلات الشركاء (Partner Analytics)</h2>
        <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          نظرة عامة شاملة على أداء المنازل والعقارات المربوطة، معدل استجابة الحساسات أوفلاين، واستهلاك الطاقة الموحد لجميع الفروع والمنازل.
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statsList.map((stat: any, index: number) => {
          const Icon = icons[index % icons.length];
          return (
            <div key={stat.name} className="bg-slate-950/80 border border-white/10 rounded-3xl p-6 shadow-xl hover:border-cyan-500/40 transition-all group">
              <div className="flex items-center justify-between">
                <div className={`p-3.5 rounded-2xl border border-white/5 ${stat.bg}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>{stat.change}</span>
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-slate-400 text-xs font-bold">{stat.name}</h3>
                <p className="text-2xl sm:text-3xl font-black text-white mt-1 group-hover:text-cyan-300 transition-colors">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Recharts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Devices Growth */}
        <div className="bg-slate-950/80 border border-white/10 rounded-3xl p-6 h-96 flex flex-col shadow-xl backdrop-blur-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu size={18} className="text-purple-400" />
              معدل نمو الأجهزة الذكية المربوطة (ESP32 Nodes)
            </h3>
            <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">تحديث مباشر 🟢</span>
          </div>
          <div className="flex-1 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDevices" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#090d16', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '16px', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#c084fc', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="devices" name="عدد الأجهزة" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorDevices)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Local Telemetry & API Calls */}
        <div className="bg-slate-950/80 border border-white/10 rounded-3xl p-6 h-96 flex flex-col shadow-xl backdrop-blur-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity size={18} className="text-cyan-400" />
              معدل استدعاء الرسائل وقراءات الحساسات أوفلاين
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">MQTT Fast Bus</span>
          </div>
          <div className="flex-1 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#090d16', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '16px', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
                />
                <Bar dataKey="calls" name="عدد قراءات الحساسات" fill="#06b6d4" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
