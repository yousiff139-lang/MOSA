// @ts-nocheck
"use client";
/* eslint-disable */
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Zap, Activity, BatteryCharging, Trash2, PieChart } from 'lucide-react';
import { GlobalData, PowerDataPoint } from '@/types';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

interface EnergyMonitorProps {
  globalData: GlobalData;
  powerHistory: PowerDataPoint[];
}

export function EnergyMonitor({ globalData, powerHistory }: EnergyMonitorProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'chart'>('overview');
  const [tariffRate, setTariffRate] = useState<number>(100);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tariffRate');
      if (saved) setTariffRate(Number(saved));
    }
  }, []);

  const energyBudget = useSmartHomeStore(state => state.energyBudget);
  const setEnergyBudget = useSmartHomeStore(state => state.setEnergyBudget);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tariffRate', tariffRate.toString());
    }
  }, [tariffRate]);

  // Format total kWh beautifully
  const formattedKWh = globalData?.totalKWh?.toFixed(2) ?? "0.00";
  const currentPowerWatts = globalData?.currentPower?.toFixed(0) ?? "0";
  const estimatedCost = (globalData?.totalKWh ?? 0) * tariffRate;
  const budgetPercentage = Math.min((estimatedCost / energyBudget) * 100, 100);
  
  let budgetColor = 'bg-emerald-500';
  if (budgetPercentage > 70) budgetColor = 'bg-yellow-500';
  if (budgetPercentage > 90) budgetColor = 'bg-red-500';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-white/10 pb-6 gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white drop-shadow-md mb-2">مراقبة الطاقة</h2>
          <p className="text-sm text-gray-500">استهلاك الكهرباء اللحظي والتراكمي للأجهزة - يُحفظ تلقائياً</p>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide w-full md:w-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === 'overview' 
                ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Activity size={18} className={activeTab === 'overview' ? "text-white" : "text-gray-400 dark:text-gray-500"} />
            نظرة عامة
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === 'chart' 
                ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <PieChart size={18} className={activeTab === 'chart' ? "text-white" : "text-gray-400 dark:text-gray-500"} />
            الرسم البياني
          </button>
        </div>
      </header>

      <div className="animate-fade-in relative">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Total kWh Card */}
              <div className="glass-panel bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/30 rounded-3xl p-6 shadow-lg relative overflow-hidden transition-all hover:shadow-indigo-500/20 hover:-translate-y-1">
                <div className="absolute -right-6 -top-6 opacity-10 text-indigo-500 dark:text-indigo-400">
                  <BatteryCharging size={120} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-2">
                  <Zap size={20} className="text-indigo-500" />
                  الاستهلاك التراكمي (شهري)
                </h3>
                <div className="flex items-end gap-2 text-gray-900 dark:text-white">
                  <span className="text-5xl font-black drop-shadow-sm">{formattedKWh}</span>
                  <span className="text-xl font-bold opacity-80 mb-1">kWh</span>
                </div>
                
                {/* Billing Calculator & Budget Mini UI */}
                <div className="mt-4 pt-4 border-t border-indigo-500/20">
                   <div className="flex justify-between items-center text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      <span>التكلفة التقديرية:</span>
                      <span className={budgetPercentage > 90 ? "text-red-500" : budgetPercentage > 70 ? "text-yellow-500" : "text-emerald-500"}>
                        {estimatedCost.toFixed(0)} / {energyBudget} دينار
                      </span>
                   </div>
                   
                   {/* Budget Progress Bar */}
                   <div className="w-full bg-gray-200 dark:bg-black/30 rounded-full h-2.5 mb-4 border border-white/5">
                      <div className={`h-2.5 rounded-full transition-all duration-1000 ${budgetColor}`} style={{ width: `${budgetPercentage}%` }}></div>
                   </div>

                   <div className="flex items-center justify-between gap-4">
                     <div className="flex items-center gap-2 flex-1">
                        <input 
                          type="number" 
                          value={tariffRate} 
                          onChange={(e) => setTariffRate(Number(e.target.value))} 
                          className="w-full bg-white/50 dark:bg-black/30 border border-indigo-500/30 rounded-lg p-1.5 text-xs outline-none focus:border-indigo-500 text-gray-900 dark:text-white transition-colors" 
                          placeholder="السعر"
                        />
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">السعر/kWh</span>
                     </div>
                     <div className="flex items-center gap-2 flex-1">
                        <input 
                          type="number" 
                          value={energyBudget} 
                          onChange={(e) => setEnergyBudget(Number(e.target.value))} 
                          className="w-full bg-white/50 dark:bg-black/30 border border-indigo-500/30 rounded-lg p-1.5 text-xs outline-none focus:border-indigo-500 text-gray-900 dark:text-white transition-colors" 
                          placeholder="الميزانية"
                        />
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">الميزانية</span>
                     </div>
                   </div>
                </div>
              </div>

              {/* Current Power Card */}
              <div className="glass-panel bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/30 rounded-3xl p-6 shadow-lg relative overflow-hidden transition-all hover:shadow-orange-500/20 hover:-translate-y-1">
                <div className="absolute -right-6 -top-6 opacity-10 text-orange-500 dark:text-orange-400">
                  <Activity size={120} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-2">
                  <Activity size={20} className="text-orange-500" />
                  السحب اللحظي
                </h3>
                <div className="flex items-end gap-2 text-gray-900 dark:text-white">
                  <span className="text-5xl font-black drop-shadow-sm">{currentPowerWatts}</span>
                  <span className="text-xl font-bold opacity-80 mb-1">واط</span>
                </div>
                <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  القراءة الحية من حساس التيار
                </p>
              </div>
            </div>

            {/* Smart Commercial Energy Cost Banner */}
            <div className="glass-panel bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-indigo-500/15 border border-emerald-500/30 rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    حاسبة التكلفة الذكية (Energy Cost Insights)
                  </span>
                  <h4 className="text-xl font-black text-gray-900 dark:text-white pt-2">
                    فاتورة الكهرباء المقدرة: <span className="text-emerald-600 dark:text-emerald-400">{estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> دينار / شهر
                  </h4>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    💡 <strong className="text-emerald-500">نصيحة توفير تجارية:</strong> إطفاء المكيفات والأجهزة غير المستخدمة 1 ساعة مبكراً يوفر لك <span className="font-bold text-emerald-500">{((tariffRate * 1.5) * 30).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> دينار شهرياً!
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-white/40 dark:bg-black/40 p-3 rounded-2xl border border-white/10 shadow-inner">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">سعر الـ kWh:</span>
                  <input 
                    type="number" 
                    value={tariffRate} 
                    onChange={(e) => setTariffRate(Number(e.target.value))} 
                    className="w-20 bg-white dark:bg-gray-800 border border-emerald-500/40 rounded-xl px-2 py-1 text-sm font-bold text-center text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">دينار</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="glass-panel rounded-3xl p-6 md:p-8 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">الرسم البياني للسحب اللحظي</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">تتبع الاستهلاك على مدار الوقت</p>
              </div>
              {powerHistory.length > 0 && (
                <button 
                  onClick={() => {
                    if(typeof window !== 'undefined' && window.confirm('هل أنت متأكد من حذف الرسم البياني للطاقة؟')) useSmartHomeStore.getState().clearPowerHistory();
                  }}
                  className="flex items-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl transition-colors font-bold text-sm"
                >
                  <Trash2 size={18} />
                  حذف السجل
                </button>
              )}
            </div>
            
            <div className="h-72 w-full overflow-x-auto" dir="ltr">
              {powerHistory.length > 0 ? (
                <div style={{ width: '800px', height: '100%' }}>
                  <AreaChart data={powerHistory} width={800} height={280} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}W`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '12px', color: 'white' }}
                      itemStyle={{ color: '#fcd34d', fontWeight: 'bold' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="power" 
                      stroke="#f59e0b" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorPower)" 
                      name="الطاقة (واط)"
                      animationDuration={500}
                    />
                  </AreaChart>
                </div>
              ) : (
                 <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                   <Activity size={48} className="mb-4 opacity-50 animate-pulse" />
                   <p>جاري جمع البيانات...</p>
                 </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
