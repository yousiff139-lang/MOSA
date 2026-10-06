"use client";

import { useState, useEffect, useRef } from 'react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { notify } from '@/store/useConfirmStore';
import { Activity, Server, Cpu, Database, Wifi, Terminal, Save, Key, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { motion } from 'framer-motion';

export default function MqttGatewayDashboard() {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const { socket } = useSmartHomeStore();
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Configuration settings form state
  const [brokerUrl, setBrokerUrl] = useState('mqtts://mosa-mosquitto:8883');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('mosa_backend');
  const [reconnectPeriod, setReconnectPeriod] = useState('5000');
  const [isSaving, setIsSaving] = useState(false);

  const fetchHealth = async () => {
    try {
      const res = await fetchAuth('/api/system/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (err) {
      console.error('Failed to fetch system health', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetchAuth('/api/mqtt/config');
      if (res.ok) {
        const data = await res.json();
        setBrokerUrl(data.brokerUrl || 'mqtts://mosa-mosquitto:8883');
        setUsername(data.username || '');
        setClientId(data.clientId || 'mosa_backend');
        setReconnectPeriod(String(data.reconnectPeriod || 5000));
      }
    } catch (err) {
      console.error('Failed to fetch MQTT configuration', err);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchConfig();
    
    // Fetch initial logs
    fetchAuth('/api/mqtt/logs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setLogs(data);
      })
      .catch(console.error);

    const interval = setInterval(fetchHealth, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleMqttLog = (log: any) => {
      setLogs(prev => {
        const newLogs = [...prev, log];
        if (newLogs.length > 50) newLogs.shift();
        return newLogs;
      });
    };
    
    socket.on('mqtt:log', handleMqttLog);
    return () => {
      socket.off('mqtt:log', handleMqttLog);
    };
  }, [socket]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetchAuth('/api/mqtt/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerUrl,
          username,
          password: password || undefined,
          clientId,
          reconnectPeriod: parseInt(reconnectPeriod, 10)
        })
      });

      if (res.ok) {
        const data = await res.json();
        notify('تم حفظ إعدادات البوابة وإعادة تشغيل اتصال MQTT بنجاح! ⚡', 'success');
        fetchHealth();
      } else {
        const err = await res.json();
        notify(err.error || 'حدث خطأ أثناء الاتصال بالخادم الجديد', 'error');
      }
    } catch (err) {
      notify('خطأ في الاتصال بالخادم المركزي', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !healthData) {
    return <div className="p-8 text-white">جاري تحميل قراءات البوابة...</div>;
  }

  const isMqttConnected = healthData?.mqttConnected;
  const memUsage = healthData?.system?.memUsagePercent || 0;
  const cpuLoad = healthData?.system?.cpuLoadAvg?.toFixed(2) || 0;
  const uptimeDays = Math.floor((healthData?.system?.uptime || 0) / 86400);

  return (
    <div className="p-6 md:p-10 min-h-full relative w-full pb-44 animate-fade-in" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Wifi className="text-primary" size={32} />
            بوابة وسيط الرسائل (MQTT Gateway)
          </h1>
          <p className="text-gray-400 mt-2 text-sm">مراقبة حالة اتصال الـ MQTT Broker وتأمين بروتوكولات الاتصال مع لوحات ESP32</p>
        </div>
        <button 
          onClick={() => { fetchHealth(); fetchConfig(); }}
          className="bg-white/5 hover:bg-white/10 text-white font-bold px-4 py-2.5 rounded-xl border border-white/10 transition-colors flex items-center gap-2 text-xs"
        >
          <RefreshCw size={14} />
          تحديث المؤشرات
        </button>
      </div>

      {/* Broker Health Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className={`p-5 rounded-2xl border relative overflow-hidden flex flex-col justify-center ${
          isMqttConnected 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <div className="flex justify-between items-start mb-3">
            <Activity size={24} />
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/25">
              {isMqttConnected ? 'Online' : 'Offline'}
            </span>
          </div>
          <h3 className="text-white font-bold text-sm">حالة الاتصال</h3>
          <p className="text-xs opacity-70 mt-1">{isMqttConnected ? 'متصل بالوسيط بنجاح' : 'انقطع الاتصال بالوسيط'}</p>
        </div>

        <div className="bg-[#11151c]/80 border border-white/5 rounded-2xl p-5 flex flex-col justify-center">
          <Cpu className="text-blue-400 mb-3" size={24} />
          <h3 className="text-white font-bold text-sm">متوسط حمل المعالج</h3>
          <p className="text-lg font-black text-white mt-1">{cpuLoad}%</p>
        </div>

        <div className="bg-[#11151c]/80 border border-white/5 rounded-2xl p-5 flex flex-col justify-center">
          <Server className="text-purple-400 mb-3" size={24} />
          <h3 className="text-white font-bold text-sm">استهلاك الذاكرة</h3>
          <p className="text-lg font-black text-white mt-1">{memUsage}%</p>
        </div>

        <div className="bg-[#11151c]/80 border border-white/5 rounded-2xl p-5 flex flex-col justify-center">
          <Database className="text-orange-400 mb-3" size={24} />
          <h3 className="text-white font-bold text-sm">مدة التشغيل</h3>
          <p className="text-lg font-black text-white mt-1">{uptimeDays} يوم</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: MQTT Settings Form */}
        <div className="col-span-12 lg:col-span-5">
          <GlassCard className="p-6 border-white/10 bg-black/40 shadow-2xl rounded-3xl space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
              <Key className="text-primary" size={20} />
              إعدادات الاتصال بالوسيط
            </h2>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1.5">عنوان السيرفر (Broker URL)</label>
                <input 
                  type="text" 
                  value={brokerUrl}
                  onChange={e => setBrokerUrl(e.target.value)}
                  placeholder="mqtt://localhost:1883"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">اسم المستخدم</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">كلمة المرور</label>
                  <input 
                    type="password" 
                    placeholder="غير محددة"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">معرف العميل (Client ID)</label>
                  <input 
                    type="text" 
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 font-bold mb-1.5">مؤقت إعادة الاتصال (ms)</label>
                  <input 
                    type="number" 
                    value={reconnectPeriod}
                    onChange={e => setReconnectPeriod(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs shadow-lg transition-all"
                >
                  <Save size={16} />
                  {isSaving ? 'جاري الحفظ وإعادة الاتصال...' : 'حفظ وإعادة تشغيل البوابة'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>

        {/* Right: MQTT Messages Console */}
        <div className="col-span-12 lg:col-span-7">
          <GlassCard className="p-6 border-white/10 bg-black/40 shadow-2xl rounded-3xl flex flex-col h-[480px]">
             <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Terminal className="text-[#00f0ff] animate-pulse" size={24} />
                مراقب حركة شبكة MQTT المباشر
             </h2>
             <div className="flex-1 flex flex-col bg-[#05070a] border border-white/5 rounded-2xl overflow-hidden font-mono text-xs relative">
                <div className="flex bg-[#11151c] border-b border-white/5 px-4 py-2.5 text-gray-500 font-bold tracking-wider">
                   <div className="w-24">الوقت</div>
                   <div className="flex-1">موضوع الرسالة (Topic)</div>
                   <div className="flex-1">البيانات (Payload)</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
                   {logs.length === 0 ? (
                     <div className="text-white/30 text-center py-12">بانتظار وصول رسائل MQTT من الحساسات...</div>
                   ) : (
                     logs.map((log, i) => (
                       <div key={log.id || i} className="flex flex-col md:flex-row gap-2 border-b border-white/5 pb-2 hover:bg-white/[0.02] transition-colors p-1 rounded">
                         <div className="w-24 text-gray-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</div>
                         <div className="flex-1 text-[#00f0ff] break-all">{log.topic}</div>
                         <div className="flex-1 text-[#b53cff] break-all">{log.payload}</div>
                       </div>
                     ))
                   )}
                   <div ref={logsEndRef} />
                </div>
             </div>
          </GlassCard>
        </div>

      </div>

      {/* Bottom Detailed Explanation & Guide Card */}
      <div className="mt-10 bg-gradient-to-br from-[#0b0e14] via-[#111827] to-[#0b0e14] border border-blue-500/20 rounded-[2.5rem] p-8 md:p-10 shadow-2xl space-y-8 animate-fade-in">
        
        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-lg">
            <Wifi size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">🌐 ملخص فكرة وحقول البوابة</h2>
            <p className="text-gray-400 text-sm mt-1">شرح كامل وآلية عمل وسيط الرسائل والتأثيرات الناتجة عن تعديل القيم</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Concept 1 */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-3 hover:border-blue-500/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-lg border border-indigo-500/20">
              📡
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Server size={18} className="text-indigo-400" />
              الفكرة والغاية من البوابة
            </h3>
            <p className="text-gray-300 text-xs leading-relaxed">
              تعمل كـ <span className="text-blue-400 font-bold">"سنترال فائق السرعة"</span> لنقل الأوامر والرسائل بين السيرفر المركز وحساسات ومتحكمات الـ ESP32 محلياً أوفلاين، وبسرعة استجابة فائقة تبلغ <span className="text-emerald-400 font-bold">أقل من 5ms</span>.
            </p>
          </div>

          {/* Concept 2 */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-3 hover:border-blue-500/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-lg border border-purple-500/20">
              ⚙️
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Key size={18} className="text-purple-400" />
              ماذا يغير المستخدم في الصفحة؟
            </h3>
            <ul className="text-gray-300 text-xs space-y-2 leading-relaxed">
              <li><strong className="text-white">عنوان السيرفر (Broker URL):</strong> لربط عنوان وسيط Mosquitto في الشبكة المحلية.</li>
              <li><strong className="text-white">اسم المستخدم وكلمة المرور:</strong> لتأمين قنوات الاتصال بالوسيط وحمايتها.</li>
              <li><strong className="text-white">معرف العميل (Client ID):</strong> معرف الجلسة الخاصة بالباك إند.</li>
              <li><strong className="text-white">مؤقت إعادة الاتصال (Reconnect Period ms):</strong> مهلة إعادة محاولة الاتصال التلقائي عند انقطاع الشبكة.</li>
            </ul>
          </div>

          {/* Concept 3 */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-3 hover:border-blue-500/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/20">
              🔄
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <RefreshCw size={18} className="text-emerald-400" />
              ماذا يحدث عند الحفظ وإعادة التشغيل؟
            </h3>
            <p className="text-gray-300 text-xs leading-relaxed">
              يقوم السيرفر بإنهاء الجلسة القديمة، وحفظ التكوينات الجديدة، وإنشاء قناة اتصال مشفرة ومباشرة مع الوسيط الجديد، مع ظهور كافة الرسائل الحية مباشرة في شاشة <span className="text-amber-400 font-bold">"مراقب حركة شبكة MQTT المباشر"</span>.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
