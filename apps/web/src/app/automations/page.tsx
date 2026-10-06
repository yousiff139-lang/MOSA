"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Plus, Settings2, PlayCircle, Clock, Thermometer, ShieldCheck, 
  Trash2, RefreshCw, Sparkles, Layers, BookOpen, GitFork, Check, 
  AlertCircle, ArrowRight, Play, Cpu, ChevronRight, Moon, Sun, Film, Coffee
} from 'lucide-react';
import { fetchAuth, useSmartHomeStore } from '@/store/useSmartHomeStore';
import { AutomationBuilderModal } from '@/components/automations/AutomationBuilderModal';
import Link from 'next/link';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

export default function AutomationsPage() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [automations, setAutomations] = useState<any[]>([]);
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [autoRes, scenesRes] = await Promise.all([
        fetchAuth('/api/automations'),
        fetchAuth('/api/scenes')
      ]);

      if (autoRes.ok) {
        const autoData = await autoRes.json();
        if (Array.isArray(autoData)) setAutomations(autoData);
      }

      if (scenesRes.ok) {
        const scData = await scenesRes.json();
        if (Array.isArray(scData)) setScenes(scData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTogglingId(id);
    try {
      const res = await fetchAuth(`/api/automations/${id}/toggle`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAutomations(prev => prev.map(a => a.id === id ? { ...a, isActive: data.isActive } : a));
        showToast(data.isActive ? 'تم تفعيل الأتمتة ⚡' : 'تم تعطيل الأتمتة ⏸️');
      }
    } catch (e) {
      showToast('حدث خطأ أثناء تبديل الحالة');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('هل تريد حذف هذه القاعدة التلقائية؟')) return;
    try {
      const res = await fetchAuth(`/api/automations/${id}`, { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        setAutomations(prev => prev.filter(a => a.id !== id));
        showToast('تم حذف الأتمتة بنجاح 🗑️');
      }
    } catch (e) {
      showToast('فشل حذف الأتمتة');
    }
  };

  const handleExecuteScene = async (id: string, name: string) => {
    setExecutingId(id);
    try {
      const res = await fetchAuth(`/api/scenes/${id}/execute`, { method: 'POST' });
      if (res.ok) {
        showToast(`تم تفعيل سيناريو "${name}" بنجاح! 🎭✨`);
      } else {
        showToast('فشل تنفيذ السيناريو');
      }
    } catch (e) {
      showToast('حدث خطأ أثناء التنفيذ');
    } finally {
      setTimeout(() => setExecutingId(null), 1000);
    }
  };

  const activeCount = automations.filter(a => a.isActive).length;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8 pb-32 font-sans"
      dir="rtl"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm border border-purple-400 flex items-center gap-2"
        >
          <Sparkles size={18} />
          <span>{toastMessage}</span>
        </motion.div>
      )}

      {/* Header Banner */}
      <motion.header variants={itemVariants} className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-purple-950/70 via-indigo-950/50 to-slate-950/90 border border-white/10 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/15 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-[90px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.4)] shrink-0">
              <Zap size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">محرك الأتمتة الذكي (Automations)</h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">
                إدارة القواعد التلقائية، الجداول الزمنية، واستجابة المنزل للحساسات وظروف الطقس
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowBuilder(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-2xl transition-all shadow-lg text-xs sm:text-sm hover:scale-105 cursor-pointer"
            >
              <Plus size={18} />
              <span>إنشاء قاعدة جديدة</span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Quick Navigation Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link 
          href="/automations/blueprints"
          className="bg-[#0b101d]/90 hover:bg-white/5 border border-white/10 hover:border-purple-500/50 rounded-3xl p-5 shadow-xl transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">قوالب الأتمتة (Blueprints)</h3>
              <p className="text-[11px] text-slate-400">قوالب أمان وتوفير طاقة جاهزة للتحميل</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-500 group-hover:text-white transition-colors rotate-180" />
        </Link>

        <Link 
          href="/scenarios"
          className="bg-[#0b101d]/90 hover:bg-white/5 border border-white/10 hover:border-purple-500/50 rounded-3xl p-5 shadow-xl transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layers size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white group-hover:text-purple-300 transition-colors">المشاهد والسيناريوهات</h3>
              <p className="text-[11px] text-slate-400">تشغيل مجموعات أجهزة بضغطة زر واحدة</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-500 group-hover:text-white transition-colors rotate-180" />
        </Link>

        <Link 
          href="/automations/flow"
          className="bg-[#0b101d]/90 hover:bg-white/5 border border-white/10 hover:border-purple-500/50 rounded-3xl p-5 shadow-xl transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <GitFork size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">منشئ الأتمتة العقدي (Flow)</h3>
              <p className="text-[11px] text-slate-400">بناء تسلسلي ذكي للروتينات المعقدة</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-500 group-hover:text-white transition-colors rotate-180" />
        </Link>
      </motion.div>

      {/* Quick Scenes Interactive Bar */}
      {scenes.length > 0 && (
        <motion.div variants={itemVariants} className="bg-[#0b101d]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/10">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Sparkles size={17} className="text-purple-400" />
              المشاهد السريعة المتاحة للتفعيل الفوري
            </h3>
            <Link href="/scenarios" className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors">
              عرض كل المشاهد &larr;
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {scenes.slice(0, 4).map(sc => {
              const isExec = executingId === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => handleExecuteScene(sc.id, sc.name)}
                  disabled={isExec}
                  className="p-4 rounded-2xl bg-black/40 hover:bg-white/5 border border-white/10 hover:border-purple-500/40 flex items-center justify-between gap-3 transition-all text-right group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/20 group-hover:bg-purple-600 text-purple-400 group-hover:text-white flex items-center justify-center transition-all shadow-md">
                      <Play size={16} className={isExec ? 'animate-spin' : ''} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{sc.name}</h4>
                      <p className="text-[10px] text-slate-400">{sc.actions?.length || 0} أجهزة</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-purple-300 bg-purple-500/10 px-2 py-1 rounded-lg font-bold group-hover:bg-purple-600 group-hover:text-white transition-all">
                    تفعيل
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Main Automations Rules Section */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Cpu size={19} className="text-purple-400" />
              القواعد النشطة في النظام
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeCount} مفعلة من أصل {automations.length} قاعدة مسجلة
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
            title="تحديث القواعد"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {automations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {automations.map(a => {
              const isToggling = togglingId === a.id;
              const cond = Array.isArray(a.conditions) ? a.conditions[0] : a.conditions;
              const actionsCount = Array.isArray(a.actions) ? a.actions.length : 1;

              return (
                <div 
                  key={a.id}
                  className={`bg-[#0b101d]/90 backdrop-blur-xl border rounded-3xl p-5 shadow-xl transition-all space-y-4 group ${
                    a.isActive ? 'border-purple-500/30' : 'border-white/5 opacity-70'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-md ${
                        a.isActive ? 'bg-purple-600 text-white shadow-purple-600/30' : 'bg-white/5 text-slate-500'
                      }`}>
                        <Zap size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">{a.name}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                          a.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {a.isActive ? 'قيد التشغيل التلقائي' : 'معطلة مؤقتاً'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDelete(a.id, e)}
                        className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="حذف الأتمتة"
                      >
                        <Trash2 size={16} />
                      </button>

                      <button
                        onClick={(e) => handleToggle(a.id, e)}
                        disabled={isToggling}
                        className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${
                          a.isActive ? 'bg-purple-600' : 'bg-white/10'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          a.isActive ? '-translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Conditions & Actions Badge Info */}
                  <div className="grid grid-cols-2 gap-2 bg-black/40 border border-white/5 rounded-2xl p-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-300 font-mono">
                      <Clock size={14} className="text-blue-400 shrink-0" />
                      <span className="truncate">
                        {cond?.time ? `الساعة ${cond.time}` : (cond?.type === 'sensor_value' ? `${cond.operator} ${cond.value}${cond.unit || ''}` : 'حساس ذكي')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-300 font-mono">
                      <Cpu size={14} className="text-emerald-400 shrink-0" />
                      <span className="truncate">
                        {actionsCount} إجراءات تنفيذية
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#0b101d]/60 border border-dashed border-white/10 rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-purple-600/10 text-purple-400 flex items-center justify-center mx-auto">
              <Zap size={32} />
            </div>
            <div>
              <h4 className="text-base font-black text-white">لا توجد قواعد أتمتة مسجلة بعد</h4>
              <p className="text-xs text-slate-400 mt-1">ابدأ بإنشاء قاعدة مخصصة أو اختر من قوالب الأتمتة الجاهزة</p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setShowBuilder(true)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                إنشاء قاعدة جديدة
              </button>
              <Link
                href="/automations/blueprints"
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-black transition-all"
              >
                استعراض القوالب
              </Link>
            </div>
          </div>
        )}
      </motion.div>

      {/* Builder Modal */}
      {showBuilder && (
        <AutomationBuilderModal 
          onClose={() => setShowBuilder(false)} 
          onSuccess={() => {
            showToast('تمت إضافة الأتمتة الجديدة بنجاح! ⚡');
            loadData();
          }}
        />
      )}
    </motion.div>
  );
}
