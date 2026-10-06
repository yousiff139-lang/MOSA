import { motion } from 'framer-motion';
import { Thermometer, Zap, Activity, ShieldCheck } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';

import { useSmartHomeStore } from '@/store/useSmartHomeStore';

export function QuickStats() {
  const devices = useSmartHomeStore(state => state.devices);
  const isConnected = useSmartHomeStore(state => state.isConnected);
  const isMqttConnected = useSmartHomeStore(state => state.isMqttConnected);

  const globalData = useSmartHomeStore(state => state.globalData);

  const activeCount = devices.filter(d => d.state === 'ON').length;
  const powerUsage = (globalData.currentPower > 0 ? (globalData.currentPower / 1000).toFixed(2) : (activeCount * 0.15).toFixed(1));
  const tempVal = globalData.currentTemp > 0 ? `${globalData.currentTemp.toFixed(1)}°C` : '24°C';
  const isSecure = isConnected && isMqttConnected;
  const stats = [
    { label: 'متوسط الحرارة', value: tempVal, icon: Thermometer, color: 'text-amber-500', glow: 'var(--primary-glow)' },
    { label: 'استهلاك الطاقة الحالي', value: `${powerUsage} kW`, icon: Zap, color: 'text-yellow-400', glow: 'var(--primary-glow)' },
    { label: 'الأجهزة النشطة', value: `${activeCount} / ${devices.length}`, icon: Activity, color: 'text-emerald-400', glow: 'var(--primary-glow)' },
    { label: 'حالة النظام', value: isSecure ? 'آمن ومستقر' : 'مقطوع', icon: ShieldCheck, color: isSecure ? 'text-blue-400' : 'text-red-500', glow: 'var(--primary-glow)' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {stats.map((stat, i) => (
        <GlassCard 
          key={i}
          className="p-5 flex flex-col gap-3 group hover:scale-[1.02] cursor-default"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <div className="flex justify-between items-start">
            <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 ${stat.color} shadow-[inset_0_0_15px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_15px_var(--primary-glow)] transition-shadow`}>
              <stat.icon size={22} />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-white">{stat.value}</h3>
            <p className="text-xs text-gray-400 font-medium mt-1">{stat.label}</p>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
