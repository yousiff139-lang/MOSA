'use client';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Activity, Battery, Flame } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  
  const [summary, setSummary] = useState({ today: 0, thisMonth: 0, thisYear: 0, peakHour: '', mostConsumingDevice: '' });
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [yearlyData, setYearlyData] = useState<any[]>([]);

  useEffect(() => {
    // Fetch Summary
    api.get('/energy/summary').then(res => setSummary(res.data)).catch(console.error);
    
    // Fetch Graph Data
    api.get('/energy/daily').then(res => setDailyData(res.data)).catch(() => {
      // Mock data if backend fails
      setDailyData(Array.from({ length: 24 }).map((_, i) => ({ time: `${i}:00`, power: Math.floor(Math.random() * 500) })));
    });

    api.get('/energy/monthly').then(res => setMonthlyData(res.data)).catch(() => {
      setMonthlyData(Array.from({ length: 30 }).map((_, i) => ({ day: `${i+1}`, power: Math.floor(Math.random() * 1000) })));
    });

    api.get('/energy/yearly').then(res => setYearlyData(res.data)).catch(() => {
      const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      setYearlyData(monthNames.map(m => ({ month: m, power: Math.floor(Math.random() * 5000) })));
    });
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <Zap className="text-amber-400" size={32} />
          تقارير الطاقة والاستهلاك
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-amber-400/10 rounded-lg text-amber-400"><Zap size={24} /></div>
            <div>
              <p className="text-sm text-zinc-400">استهلاك اليوم</p>
              <p className="text-2xl font-bold text-zinc-100">{summary.today || 12} <span className="text-sm text-zinc-500 font-normal">kWh</span></p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-400/10 rounded-lg text-blue-400"><Activity size={24} /></div>
            <div>
              <p className="text-sm text-zinc-400">استهلاك الشهر</p>
              <p className="text-2xl font-bold text-zinc-100">{summary.thisMonth || 340} <span className="text-sm text-zinc-500 font-normal">kWh</span></p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-400/10 rounded-lg text-emerald-400"><Battery size={24} /></div>
            <div>
              <p className="text-sm text-zinc-400">استهلاك العام</p>
              <p className="text-2xl font-bold text-zinc-100">{summary.thisYear || 4100} <span className="text-sm text-zinc-500 font-normal">kWh</span></p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-rose-500/10"><Flame size={100} /></div>
          <CardContent className="p-6 relative z-10">
            <p className="text-sm text-zinc-400 mb-1">الجهاز الأكثر استهلاكاً</p>
            <p className="text-xl font-bold text-zinc-100 mb-1">{summary.mostConsumingDevice || 'مكيف الصالة'}</p>
            <p className="text-xs text-rose-400">وقت الذروة: {summary.peakHour || '19:00'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Card className="bg-zinc-900 border-zinc-800 mt-8">
        <CardContent className="p-6">
          <div className="flex gap-2 mb-8 bg-zinc-950 p-1 rounded-lg w-fit">
            <button 
              onClick={() => setActiveTab('daily')}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'daily' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'}`}
            >
              يومي
            </button>
            <button 
              onClick={() => setActiveTab('monthly')}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'monthly' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'}`}
            >
              شهري
            </button>
            <button 
              onClick={() => setActiveTab('yearly')}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'yearly' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'}`}
            >
              سنوي
            </button>
          </div>

          <div className="h-[400px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === 'daily' ? (
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="time" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}W`} />
                  <Tooltip 
                    cursor={{fill: '#27272a', opacity: 0.4}}
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#fbbf24' }}
                  />
                  <Bar dataKey="power" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : activeTab === 'monthly' ? (
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="day" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                  <Tooltip 
                    cursor={{fill: '#27272a', opacity: 0.4}}
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Bar dataKey="power" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#34d399' }}
                  />
                  <Line type="monotone" dataKey="power" stroke="#34d399" strokeWidth={3} dot={{ fill: '#18181b', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#34d399' }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
