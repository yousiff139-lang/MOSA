"use client";

import { useState, useEffect } from 'react';
import { 
  Activity, BatteryCharging, Sliders, Calendar, 
  FileText, Search, ArrowDownWideNarrow, ShieldAlert, Cpu
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { useTheme } from '@/context/ThemeContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsPage() {
  const { accentColor } = useTheme();

  // Dynamic state bound to real backend database telemetry
  const [summary, setSummary] = useState<{
    currentLoadKW: string;
    todayKWh: string;
    voltageV: number;
    currentA: string;
    chartData: Array<{ time: string; value: number }>;
    logs: Array<{
      id: string;
      time: string;
      meterName: string;
      voltage: string;
      current: string;
      power: string;
      status: string;
    }>;
  }>({
    currentLoadKW: '0.00',
    todayKWh: '0.00',
    voltageV: 0,
    currentA: '0.0',
    chartData: [
      { time: '00:00', value: 0 },
      { time: '04:00', value: 0 },
      { time: '08:00', value: 0 },
      { time: '12:00', value: 0 },
      { time: '16:00', value: 0 },
      { time: '20:00', value: 0 },
      { time: '24:00', value: 0 },
    ],
    logs: []
  });

  const [loading, setLoading] = useState(true);

  // Colors mapping for charts
  const colorMap: Record<string, string> = {
    blue: '#00f0ff',
    emerald: '#10b981',
    purple: '#b53cff',
    rose: '#f43f5e',
    orange: '#f97316'
  };
  const primaryColor = colorMap[accentColor] || '#00f0ff';

  useEffect(() => {
    fetchAuth('/api/analytics/summary')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setSummary(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 lg:p-10 h-full flex flex-col gap-8 pb-44" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Activity className="text-blue-400" size={32} />
            التحليلات ومراقبة الطاقة الموحدة
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            مراقبة وتجميع كافة قراءات مقياس الطاقة الرئيسي (ESP32 Main Power Meter) للمنزل بالكامل
          </p>
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Current Power Load */}
        <GlassCard className="p-6 border-white/10 bg-black/40 shadow-xl rounded-3xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-400">الحمل الحالي النشط للمنزل</h3>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <BatteryCharging size={20} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{summary.currentLoadKW}</span>
            <span className="text-sm font-bold text-blue-400">kW (كيلوواط)</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">مقاس مباشر من مستشعر الدخل الرئيسي ESP32</p>
        </GlassCard>

        {/* Daily Energy Consumption */}
        <GlassCard className="p-6 border-white/10 bg-black/40 shadow-xl rounded-3xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-400">معدل الاستهلاك اليومي الكلي</h3>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Activity size={20} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{summary.todayKWh}</span>
            <span className="text-sm font-bold text-emerald-400">kWh</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">إجمالي الطاقة المسحوبة للمبنى اليوم</p>
        </GlassCard>

        {/* Total Incoming/Outgoing Line Meter Status */}
        <GlassCard className="p-6 border-white/10 bg-black/40 shadow-xl rounded-3xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-400">مقياس المصدر الداخل والخارج</h3>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Cpu size={20} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{summary.voltageV} V / {summary.currentA} A</span>
          </div>
          <p className="text-[11px] text-emerald-400 font-bold mt-2">
            {summary.voltageV > 0 ? 'مستقر (50Hz) - قراءة موحدة من ESP32 Meter' : 'غير متصل / لا يوجد حمل متصل'}
          </p>
        </GlassCard>

      </div>

      {/* Main Chart Card */}
      <GlassCard className="p-6 md:p-8 border-white/10 bg-black/40 shadow-2xl rounded-3xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Activity className="text-blue-400" size={22} />
              استهلاك الطاقة المباشر (جمع كافة الأحمال)
            </h2>
            <p className="text-xs text-gray-400 mt-1">تتبع التردد والأحمال الكهربائية للمنزل بالكامل خلال اليوم</p>
          </div>
        </div>

        {/* Real Dynamic Chart */}
        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', color: '#fff', fontSize: '12px' }}
                formatter={(val: any) => [`${val} kW`, 'الحمل الكلي']}
              />
              <Area type="monotone" dataKey="value" stroke={primaryColor} strokeWidth={3} fillOpacity={1} fill="url(#powerGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Consolidated Main Power Log Table */}
      <GlassCard className="p-6 md:p-8 border-white/10 bg-black/40 shadow-2xl rounded-3xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Cpu className="text-emerald-400" size={22} />
              سجل قراءات مقياس الطاقة الرئيسي للـ ESP32
            </h2>
            <p className="text-xs text-gray-400 mt-1">قراءات الجهد، التيار، وتجميع الطاقة الكلية الصادرة والواردة للمنزل</p>
          </div>
        </div>

        {/* Real Unified ESP Meter Readings Table */}
        <div className="overflow-x-auto">
          {summary.logs.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm font-bold">
              لا توجد قراءات مسجلة حالياً في قاعدة البيانات.
            </div>
          ) : (
            <table className="w-full text-right text-xs text-gray-300">
              <thead className="bg-white/5 text-gray-400 font-bold border-b border-white/10">
                <tr>
                  <th className="p-3.5 rounded-r-xl">الوقت والتاريخ</th>
                  <th className="p-3.5">مقياس المصدر (ESP32 Master Node)</th>
                  <th className="p-3.5">الجهد الكهربائي (Volt)</th>
                  <th className="p-3.5">التيار (Ampere)</th>
                  <th className="p-3.5">الحمل الإجمالي (kW)</th>
                  <th className="p-3.5 rounded-l-xl">الحالة الحية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {summary.logs.map(log => (
                  <tr key={log.id} className="hover:bg-white/5 transition-all">
                    <td className="p-3.5 text-white">{log.time}</td>
                    <td className="p-3.5 font-bold text-blue-400">{log.meterName}</td>
                    <td className="p-3.5">{log.voltage}</td>
                    <td className="p-3.5">{log.current}</td>
                    <td className="p-3.5 text-emerald-400 font-bold">{log.power}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </GlassCard>

    </div>
  );
}
