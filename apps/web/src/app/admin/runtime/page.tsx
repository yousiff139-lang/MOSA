"use client";

import { useState, useEffect } from 'react';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { 
  Save, AlertTriangle, Code, Languages, FileJson, 
  ToggleRight, Check, Sparkles, Shield, Cpu, Zap, 
  RefreshCw, Radio, Lock, Globe
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function RuntimeConfigPanel() {
  const { featureFlags, uiConfig, translations, lang, setLang } = useRuntimeStore();
  const [activeTab, setActiveTab] = useState<'FLAGS' | 'TRANSLATIONS' | 'ADVANCED_JSON'>('FLAGS');
  
  // Visual Feature Flags state
  const [flags, setFlags] = useState<{ [key: string]: boolean }>({
    edge_zero_latency: true,
    cloud_hybrid_ai: true,
    hardware_aes_encryption: true,
    mqtt_debug_stream: false,
    enforce_two_factor: false,
    auto_firmware_updates: true,
    high_contrast_mode: false,
    sound_effects_enabled: true
  });

  const [flagsDraft, setFlagsDraft] = useState(JSON.stringify(featureFlags || {}, null, 2));
  const [uiDraft, setUiDraft] = useState(JSON.stringify(uiConfig || {}, null, 2));
  const [transDraft, setTransDraft] = useState(JSON.stringify(translations || {}, null, 2));
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setFlagsDraft(JSON.stringify(featureFlags, null, 2));
    setUiDraft(JSON.stringify(uiConfig, null, 2));
    setTransDraft(JSON.stringify(translations, null, 2));
  }, [featureFlags, uiConfig, translations]);

  const handleToggleFlag = (key: string) => {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveRuntime = async () => {
    setIsSaving(true);
    try {
      await fetchAuth('/api/config/runtime', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureFlags: flags
        })
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveJson = async (type: string, draft: string) => {
    setIsSaving(true);
    try {
      const parsed = JSON.parse(draft);
      const res = await fetchAuth('/api/config/runtime', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [type]: parsed })
      });
      if (res.ok) {
        alert('تم حفظ التكوين وبثه لحظياً لجميع الشاشات المتصلة!');
      }
    } catch (e) {
      alert('خطأ في صيغة JSON!');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans" dir="rtl">
      
      {/* ── Top Header Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-950/70 via-slate-900/90 to-purple-950/70 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold mb-3">
              <Zap size={16} className="text-indigo-400" />
              <span>التحكم اللحظي بالنظام (Hot Runtime Switcher & Feature Flags)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              برمجة وتعديل النظام اللحظية (Runtime Programming)
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              تفعيل الميزات وإيقافها، تعديل النصوص وتخصيص القوائم وبثها فوراً (Hot Reload) لجميع أجهزة التابلت والجوالات بالمنزل دون الحاجة لإعادة تشغيل السيرفر.
            </p>
          </div>

          {/* Action Tabs & Switch Lang */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 p-1.5 bg-black/40 border border-white/10 rounded-2xl text-xs">
              <button
                onClick={() => setActiveTab('FLAGS')}
                className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'FLAGS'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ToggleRight size={16} />
                <span>مفاتيح الميزات</span>
              </button>
              <button
                onClick={() => setActiveTab('ADVANCED_JSON')}
                className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'ADVANCED_JSON'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileJson size={16} />
                <span>محرر JSON المتقدم</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Danger Zone Safety Notice ── */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3.5">
        <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 shrink-0">
          <AlertTriangle size={18} />
        </div>
        <p className="text-xs text-amber-200 leading-relaxed">
          <strong>تنبيه البث المباشر (WebSocket Hot Broadcast):</strong> أي تغيير تقوم بحفظه هنا يتم تطبيقه وبثه لحظياً لكل شاشات اللمس والمستخدمين في المنزل دون انقطاع للخدمة.
        </p>
      </div>

      {/* ── Tab 1: Visual Interactive Feature Flags ── */}
      {activeTab === 'FLAGS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                id: 'edge_zero_latency',
                title: '⚡ نمط السرعة القصوى (Zero-Latency Edge)',
                desc: 'معالجة الأوامر محلياً على ESP32 بدون تأخير أجزاء الثانية.',
                icon: Zap,
                color: 'text-amber-400'
              },
              {
                id: 'cloud_hybrid_ai',
                title: '🧠 الذكاء الهجين (Cloud Hybrid AI)',
                desc: 'دمج الذكاء الاصطناعي السحابي لتحليل الأوامر الصوتية المعقدة.',
                icon: Sparkles,
                color: 'text-purple-400'
              },
              {
                id: 'hardware_aes_encryption',
                title: '🛡️ التشفير العسكري (AES-256 Mesh)',
                desc: 'تشفير كافة حزم MQTT المتنقلة بين اللوحات والسيرفر.',
                icon: Shield,
                color: 'text-emerald-400'
              },
              {
                id: 'mqtt_debug_stream',
                title: '📡 بث سجلات التصحيح (MQTT Debug)',
                desc: 'عرض كافة الرسائل الدقيقة للأجهزة في صفحة السجلات.',
                icon: Radio,
                color: 'text-cyan-400'
              },
              {
                id: 'enforce_two_factor',
                title: '🔒 فرض المصادقة الثنائية (Enforce 2FA)',
                desc: 'إلزام جميع المقيمين بإدخال رمز التحقق عند الدخول.',
                icon: Lock,
                color: 'text-rose-400'
              },
              {
                id: 'auto_firmware_updates',
                title: '🔄 التحديث التلقائي للوحات (Auto OTA)',
                desc: 'تحديث برمجيات ESP32 تلقائياً عند صدور إصدارات أمنية.',
                icon: RefreshCw,
                color: 'text-blue-400'
              },
              {
                id: 'sound_effects_enabled',
                title: '🔊 أصوات التأكيد التفاعلية',
                desc: 'تشغيل نغمة عند تنفيذ الأوامر الصوتية أو تشغيل الأجهزة.',
                icon: Sparkles,
                color: 'text-teal-400'
              },
              {
                id: 'high_contrast_mode',
                title: '👁️ نمط التباين العالي (High Contrast)',
                desc: 'زيادة وضوح النصوص والأزرار للشاشات المعلقة على الحائط.',
                icon: Globe,
                color: 'text-indigo-400'
              },
            ].map(item => {
              const Icon = item.icon;
              const isEnabled = flags[item.id] ?? false;

              return (
                <div
                  key={item.id}
                  className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 hover:border-indigo-500/40 rounded-3xl p-5 flex flex-col justify-between space-y-4 shadow-xl transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center ${item.color}`}>
                        <Icon size={18} />
                      </div>
                      <button
                        onClick={() => handleToggleFlag(item.id)}
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                          isEnabled ? 'bg-indigo-600' : 'bg-slate-800'
                        }`}
                      >
                        <motion.div
                          animate={{ x: isEnabled ? (lang === 'ar' ? -24 : 24) : 0 }}
                          className="w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 right-0.5"
                        />
                      </button>
                    </div>
                    <h4 className="font-bold text-sm text-white">{item.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">الحالة اللحظية:</span>
                    <strong className={isEnabled ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {isEnabled ? 'مفعل (Active)' : 'معطل (Disabled)'}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSaveRuntime}
              disabled={isSaving}
              className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-black text-xs transition shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check size={16} />
                  <span>تم البث والتطبيق لجميع الشاشات!</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{isSaving ? 'جاري البث...' : 'حفظ وبث الإعدادات لحظياً 🚀'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab 2: Advanced JSON Schema Editors ── */}
      {activeTab === 'ADVANCED_JSON' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Feature Flags JSON */}
          <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 flex flex-col h-[480px] shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <ToggleRight className="text-indigo-400" />
              <h3 className="text-sm font-bold text-white">مخطط الميزات الخام (Feature Flags JSON)</h3>
            </div>
            <textarea
              value={flagsDraft}
              onChange={e => setFlagsDraft(e.target.value)}
              className="flex-1 bg-[#050914] border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-300 focus:outline-none focus:border-indigo-500 resize-none mb-3"
            />
            <button
              onClick={() => handleSaveJson('featureFlags', flagsDraft)}
              disabled={isSaving}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Save size={14} />
              <span>حفظ وتطبيق الـ JSON</span>
            </button>
          </div>

          {/* UI Sidebar Schema JSON */}
          <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 flex flex-col h-[480px] shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <FileJson className="text-purple-400" />
              <h3 className="text-sm font-bold text-white">تخصيص القائمة الجانبية (Sidebar UI Schema)</h3>
            </div>
            <textarea
              value={uiDraft}
              onChange={e => setUiDraft(e.target.value)}
              className="flex-1 bg-[#050914] border border-slate-800 rounded-xl p-3 font-mono text-xs text-purple-300 focus:outline-none focus:border-purple-500 resize-none mb-3"
            />
            <button
              onClick={() => handleSaveJson('uiConfig', uiDraft)}
              disabled={isSaving}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Save size={14} />
              <span>حفظ وتطبيق القائمة</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
