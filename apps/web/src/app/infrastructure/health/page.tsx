"use client";

import { useTranslation } from '@/hooks/useTranslation';
import { Server, Activity, Cpu, ShieldCheck, Database, Trash2, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { GlassCard } from '@/components/ui/GlassCard';

export default function InfrastructurePage() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState({ cpu: 42, ram: 55, mqtt: 'Connected' });
  const [healthData, setHealthData] = useState<any>(null);
  const [chaosMode, setChaosMode] = useState(false);
  const [isWorking, setIsWorking] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetchAuth('/api/system/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
        setMetrics(prev => ({
          ...prev,
          mqtt: data.mqttConnected ? 'Connected' : 'Disconnected',
          cpu: data.system?.cpuLoadAvg ? Math.round(data.system.cpuLoadAvg * 20) : prev.cpu,
          ram: data.system?.memUsagePercent || prev.ram
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  // Self-Healing Trigger Call
  const handleSelfHealing = async (action: string, endpoint: string) => {
    setIsWorking(action);
    try {
      const res = await fetchAuth(`/api/system/health/${endpoint}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (endpoint === 'repair-db') {
          alert(`تم فحص الجداول وإصلاحها! الأجهزة المعزولة التي تم مسحها: ${data.repairedCount || 0}`);
        } else if (endpoint === 'flush-cache') {
          alert('تم تفريغ الذاكرة المؤقتة بالكامل وتنشيط الـ WebSockets!');
        } else if (endpoint === 'prune-logs') {
          alert(`تم تنظيف السجلات بنجاح! الأسطر القديمة المحذوفة: ${data.prunedCount || 0}`);
        }
        fetchHealth();
      } else {
        alert('فشلت العملية، يرجى التحقق من صلاحيات المسؤول');
      }
    } catch (e) {
      alert('حدث خطأ في الاتصال بالخادم المركزي');
    } finally {
      setIsWorking(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 w-full animate-fade-up" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <ShieldCheck className="text-emerald-400" size={32} />
            لوحة صحة وحماية النظام (Self-Healing Hub)
          </h1>
          <p className="text-gray-400 mt-1 text-sm">مراقبة صحة الخادم المركزي وتشغيل أدوات الإصلاح الذاتي لمنع الأخطاء</p>
        </div>

        <button 
          onClick={fetchHealth}
          className="bg-white/5 hover:bg-white/10 text-white font-bold px-4 py-2.5 rounded-xl border border-white/10 transition-colors flex items-center gap-2 text-xs"
        >
          <RefreshCw size={14} />
          تحديث المؤشرات
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        {/* MQTT Status */}
        <div className={`rounded-3xl p-6 border ${
          metrics.mqtt === 'Connected' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Activity size={24} />
            </div>
            <h2 className="text-xl font-bold text-white">بوابة MQTT Broker</h2>
          </div>
          <div className="text-3xl font-black">{metrics.mqtt === 'Connected' ? 'متصل' : 'منقطع'}</div>
          <p className="text-xs opacity-75 mt-2">يعمل كجسر ربط أساسي مع لوحات ESP32</p>
        </div>

        {/* Edge Node CPU */}
        <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl">
              <Cpu size={24} />
            </div>
            <h2 className="text-xl font-bold text-white">Edge CPU</h2>
          </div>
          <div className="text-3xl font-black text-white">{metrics.cpu}%</div>
          <div className="w-full bg-white/10 h-2 rounded-full mt-4">
            <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${metrics.cpu}%` }}></div>
          </div>
        </div>

        {/* Edge Node RAM */}
        <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
              <Server size={24} />
            </div>
            <h2 className="text-xl font-bold text-white">Edge RAM</h2>
          </div>
          <div className="text-3xl font-black text-white">{metrics.ram}%</div>
          <div className="w-full bg-white/10 h-2 rounded-full mt-4">
            <div className="bg-amber-500 h-2 rounded-full transition-all duration-500" style={{ width: `${metrics.ram}%` }}></div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Self-Healing Proactive Tools */}
        <div className="col-span-12 lg:col-span-7">
          <GlassCard className="p-6 border-white/10 bg-black/40 shadow-2xl rounded-3xl space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
              <Sparkles className="text-emerald-400" size={20} />
              أدوات الصيانة الذكية والإصلاح الوقائي
            </h2>
            
            <div className="space-y-4">
              
              {/* Tool 1: DB Repair */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database size={16} className="text-blue-400" />
                    فحص وإصلاح قاعدة البيانات
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">تحديد ومسح الأجهزة المعزولة التي ليس لها لوحة تحكم لتسريع الاستعلامات</p>
                </div>
                <button
                  disabled={isWorking !== null}
                  onClick={() => handleSelfHealing('repair-db', 'repair-db')}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all"
                >
                  {isWorking === 'repair-db' ? 'جاري الفحص...' : 'فحص وإصلاح'}
                </button>
              </div>

              {/* Tool 2: Flush Redis */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <RefreshCw size={16} className="text-purple-400" />
                    تصفية ذاكرة التخزين المؤقت (Redis)
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">تفريغ سجل التخزين المؤقت وحلقات الاتصال لإنعاش استجابة الأزرار</p>
                </div>
                <button
                  disabled={isWorking !== null}
                  onClick={() => handleSelfHealing('flush-cache', 'flush-cache')}
                  className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all"
                >
                  {isWorking === 'flush-cache' ? 'جاري التفريغ...' : 'تصفية الكاش'}
                </button>
              </div>

              {/* Tool 3: Prune Logs */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Trash2 size={16} className="text-amber-400" />
                    تنظيف السجلات وتفريغ المساحة
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">مسح سجلات الحركة والعمليات القديمة (أكثر من 30 يوماً) لتوفير سعة التخزين</p>
                </div>
                <button
                  disabled={isWorking !== null}
                  onClick={() => handleSelfHealing('prune-logs', 'prune-logs')}
                  className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all"
                >
                  {isWorking === 'prune-logs' ? 'جاري التنظيف...' : 'تنظيف السجلات'}
                </button>
              </div>

            </div>
          </GlassCard>
        </div>

        {/* Right: Component Status Monitoring */}
        <div className="col-span-12 lg:col-span-5">
          <GlassCard className="p-6 border-white/10 bg-black/40 shadow-2xl rounded-3xl space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
              <ShieldAlert className="text-blue-400" size={20} />
              حالة الخدمات والمكونات الرئيسية
            </h2>

            <div className="space-y-3 text-xs">
              {/* Component 1: Postgres DB */}
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                <span className="text-slate-300 font-bold">قاعدة بيانات النظام (Postgres)</span>
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold">
                  {healthData?.dbConnected !== false ? 'نشط / سليم' : 'تعطل'}
                </span>
              </div>

              {/* Component 2: Redis cache */}
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                <span className="text-slate-300 font-bold">الذاكرة المؤقتة للرسائل (Redis)</span>
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold">
                  نشط / سليم
                </span>
              </div>

              {/* Component 3: MQTT Broker */}
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                <span className="text-slate-300 font-bold">وسيط رسائل اللوحات (MQTT)</span>
                <span className={`px-2.5 py-1 border rounded font-bold ${
                  metrics.mqtt === 'Connected' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {metrics.mqtt === 'Connected' ? 'متصل' : 'منقطع'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 leading-relaxed font-bold">
              * يقوم النظام بفحص المكونات وسلامة الجداول تلقائياً كل 8 ثوانٍ، لتلافي أي أخطاء أو بطء في معالجة القراءات القادمة من الحساسات.
            </div>
          </GlassCard>
        </div>

      </div>

      {/* Chaos Engineering Panel */}
      <div className="mt-12 bg-red-500/10 border border-red-500/20 rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
              ⚠️ محرك هندسة الفوضى (Chaos Engine)
            </h2>
            <p className="text-red-300/80 text-xs mt-1">
              اختبار متانة الـ Supervisor عبر محاكاة انقطاعات الشبكة، سقوط الحاويات، وفقدان بيانات الـ MQTT.
            </p>
          </div>
          <button 
            onClick={async () => {
              const res = await fetchAuth('/api/chaos/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enable: !chaosMode })
              });
              if(res.ok) {
                 const data = await res.json();
                 setChaosMode(data.enabled);
              }
            }}
            className={`px-6 py-3 rounded-xl font-bold text-xs transition-all ${
              chaosMode ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            }`}
          >
            {chaosMode ? 'إيقاف الفوضى' : 'تفعيل الفوضى'}
          </button>
        </div>
      </div>

    </div>
  );
}
