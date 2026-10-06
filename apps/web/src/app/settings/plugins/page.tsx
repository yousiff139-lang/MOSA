"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Puzzle, CheckCircle, Download, ShieldAlert, Code } from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';

const mockPlugins = [
  { id: 'p1', name: 'Hue Sync', desc: 'Sync your Philips Hue lights with MOSA.', author: 'MOSA Core', installed: true, official: true },
  { id: 'p2', name: 'Weather Predictor', desc: 'Advanced weather predictions for automations.', author: 'Community', installed: false, official: false },
  { id: 'p3', name: 'Telegram Bot', desc: 'Control your home via Telegram chat.', author: 'MOSA Core', installed: true, official: true },
];

export default function PluginMarketplace() {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);

  // For the demo, we mix our UI mock definitions with actual DB state
  const mockDefinitions = [
    { name: 'Zigbee2MQTT Auto-Discovery', desc: 'دمج آلي لآلاف أجهزة Zigbee فوراً عبر شبكة Z2M.', author: 'MOSA Core', official: true, code: 'console.log("Z2M Plugin Loaded");' },
    { name: 'Hue Sync', desc: 'Sync your Philips Hue lights with MOSA.', author: 'MOSA Core', official: true, code: 'console.log("Hue Plugin Loaded");' },
    { name: 'Weather Predictor', desc: 'Advanced weather predictions for automations.', author: 'Community', official: false, code: 'console.log("Weather Plugin Loaded");' }
  ];

  useEffect(() => {
    fetchPlugins();
  }, []);

  const fetchPlugins = async () => {
    try {
      const res = await fetchAuth('/api/plugins');
      const data = await res.json();
      
      // Merge DB state with mock definitions
      const merged = mockDefinitions.map(def => {
         const dbRecord = data.find((d: any) => d.name === def.name);
         return {
           id: dbRecord ? dbRecord.id : Math.random().toString(),
           ...def,
           installed: !!dbRecord
         };
      });
      setPlugins(merged);
    } catch (e) {
      console.error(e);
      // Fallback
      setPlugins(mockDefinitions.map(def => ({ ...def, id: Math.random().toString(), installed: false })));
    }
  };

  const handleInstall = async (plugin: any) => {
    setInstalling(plugin.id);
    try {
      const res = await fetchAuth('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           name: plugin.name,
           version: "1.0.0",
           description: plugin.desc,
           author: plugin.author,
           code: plugin.code,
           isActive: true
        })
      });
      
      if (res.ok) {
        await fetchPlugins();
      } else {
        alert('حدث خطأ أثناء التثبيت');
      }
    } catch (e) {
       alert('خطأ في الاتصال بالخادم');
    } finally {
       setInstalling(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 pt-8 pb-32">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">سوق الإضافات (Marketplace)</h1>
        <p className="text-gray-400 text-lg">أضف قدرات جديدة لنظامك باستخدام بيئة الـ Sandbox الآمنة.</p>
      </div>

      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-[2.5rem] p-6 mb-8 flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
          <ShieldAlert size={24} />
        </div>
        <div>
          <h3 className="text-white font-bold mb-1">بيئة تشغيل معزولة (Sandboxed V8 Engine)</h3>
          <p className="text-indigo-200 text-sm">
            جميع الإضافات هنا تعمل في بيئة معزولة تماماً. لا يمكن للإضافات الوصول إلى أجهزة لا تملك صلاحيتها، أو قراءة بياناتك الخاصة.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plugins.map(plugin => (
          <motion.div 
            key={plugin.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col h-full backdrop-blur-xl hover:bg-white/10 transition-colors relative overflow-hidden"
          >
            {plugin.official && (
               <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-10">
                 OFFICIAL
               </div>
            )}
            <div className="flex gap-4 items-start mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xl">
                <Puzzle size={24} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg leading-tight mb-1">{plugin.name}</h3>
                <p className="text-white/40 text-xs font-mono flex items-center gap-1">
                  <Code size={12} /> {plugin.author}
                </p>
              </div>
            </div>

            <p className="text-gray-400 text-sm mb-6 flex-1">{plugin.desc}</p>

            <button 
              onClick={() => !plugin.installed && handleInstall(plugin)}
              disabled={plugin.installed || installing === plugin.id}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                plugin.installed 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white text-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
              }`}
            >
              {installing === plugin.id ? (
                'جاري التثبيت...'
              ) : plugin.installed ? (
                <><CheckCircle size={18} /> مثبتة</>
              ) : (
                <><Download size={18} /> تثبيت الإضافة</>
              )}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
