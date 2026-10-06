"use client";

import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { notify } from '@/store/useConfirmStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import { SmartPairingPopup } from '@/components/SmartPairingPopup';
import { 
  Sun, Moon, Film, Briefcase, ShieldCheck, 
  Thermometer, Zap, Activity, Bluetooth, ChevronRight,
  Sparkles, Bell, Clock, Compass, Layers
} from 'lucide-react';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { DeviceGrid } from '@/components/dashboard/DeviceGrid';
import { SimpleFamilyDashboard } from '@/components/dashboard/SimpleFamilyDashboard';
import { AnimatedButton } from '@/components/ui/AnimatedButton';
import { GlassCard } from '@/components/ui/GlassCard';
import AiInsights from '@/components/AiInsights';
import { motion } from 'framer-motion';

// PERFORMANCE FIX #1: Removed Floorplan3D from homepage (800KB Three.js bundle)
// Users can access it via the dedicated /floorplan page instead
const DiscoveryPopup = dynamic(() => import('@/components/dashboard/DiscoveryPopup').then(mod => mod.DiscoveryPopup), { ssr: false });
const AIChatInterface = dynamic(() => import('@/components/dashboard/AIChatInterface').then(mod => mod.AIChatInterface), { ssr: false });

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 20 } }
};

export default function Home() {
  const devices = useSmartHomeStore(state => state.devices);
  const isConnected = useSmartHomeStore(state => state.isConnected);
  const isMqttConnected = useSmartHomeStore(state => state.isMqttConnected);
  const globalData = useSmartHomeStore(state => state.globalData);
  const user = useSmartHomeStore(state => state.user);
  const uiMode = useSmartHomeStore(state => state.uiMode);
  const setUiMode = useSmartHomeStore(state => state.setUiMode);
  const activityLogs = useSmartHomeStore(state => state.activityLogs);
  const lang = useRuntimeStore(state => state.lang);
  const isEn = lang === 'en';
  
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        if (!data.isInitialized) {
          router.replace('/setup');
          return;
        }

        const token = typeof window !== 'undefined' ? (
          localStorage.getItem('token') ||
          document.cookie.includes('token=') ||
          document.cookie.includes('access_token=')
        ) : null;

        if (!token) {
          router.replace('/auth/login');
          return;
        }

        setIsMounted(true);
      })
      .catch(() => {
        if (!active) return;
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
          router.replace('/auth/login');
        } else {
          setIsMounted(true);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#070d1a] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
        <span className="text-cyan-400 font-bold text-sm tracking-wider">جاري التحقق من أمان المنظومة...</span>
      </div>
    );
  }

  // 🏡 If in Simple Family Mode, render the dedicated Non-Technical Dashboard (Owners/Managers always get Full Dashboard)
  const userRole = (user?.role || '').toUpperCase();
  const isManager = userRole === 'SUPER_OWNER' || userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'SUPERADMIN';

  if (uiMode === 'simple' && !isManager) {
    return <SimpleFamilyDashboard />;
  }

  const handleExecuteQuickScene = async (title: string) => {
    try {
      const res = await fetchAuth('/api/scenes');
      if (res.ok) {
        const scenes = await res.json();
        const found = scenes.find((s: any) => s.name === title || s.name.includes(title));
        if (found) {
          const execRes = await fetchAuth(`/api/scenes/${found.id}/execute`, { method: 'POST' });
          if (execRes.ok) {
            notify(`تم تفعيل سيناريو "${title}" بنجاح! ✨`, 'success');
          } else {
            notify('فشل في تفعيل السيناريو.', 'error');
          }
        } else {
          notify(`سيناريو "${title}" غير مضاف بالسيرفر. يرجى إضافته من صفحة السيناريوهات.`, 'warning');
        }
      }
    } catch (e) {
      console.error(e);
      notify('حدث خطأ أثناء تفعيل السيناريو.', 'error');
    }
  };

  const activeCount = devices?.filter(d => d.state === 'ON').length || 0;
  const totalCount = devices?.length || 0;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-4 md:p-8 flex flex-col gap-6 relative z-10 font-sans"
      dir={isEn ? 'ltr' : 'rtl'}
    >
      <SmartPairingPopup onPair={() => {}} />

      {/* ── 1. Top Hero: Luxury Welcome Banner with AI Eco Saver Mode ── */}
      <motion.div variants={itemVariants}>
        <WelcomeBanner />
      </motion.div>

      {/* ── 2. Summary Metric Cards ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Active Devices */}
        <div className="p-3.5 sm:p-5 bg-[#0e1424] border border-slate-800 hover:border-emerald-500/30 rounded-2xl sm:rounded-[2rem] flex items-center justify-between gap-2 sm:gap-4 shadow-lg transition-all">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 text-[11px] sm:text-xs font-bold truncate">{isEn ? 'Active Devices' : 'الأجهزة الشغّالة'}</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {activeCount} <span className="text-[11px] sm:text-xs text-slate-500 font-normal">{isEn ? 'of' : 'من'} {totalCount}</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {isEn ? 'Live Synced' : 'محدث لحظياً'}
            </span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Zap size={18} className="sm:w-5 sm:h-5 animate-pulse" />
          </div>
        </div>

        {/* Card 2: Temperature & Humidity */}
        <div className="p-3.5 sm:p-5 bg-[#0e1424] border border-slate-800 hover:border-cyan-500/30 rounded-2xl sm:rounded-[2rem] flex items-center justify-between gap-2 sm:gap-4 shadow-lg transition-all">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 text-[11px] sm:text-xs font-bold truncate">{isEn ? 'Temperature' : 'درجة الحرارة'}</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {globalData?.currentTemp || 24.3}°C
            </span>
            <span className="text-[10px] text-cyan-400 font-bold mt-0.5">
              {isEn ? 'Humidity' : 'الرطوبة'}: {globalData?.currentHum || 43}%
            </span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
            <Thermometer size={18} className="sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Card 3: Power Consumption */}
        <div className="p-3.5 sm:p-5 bg-[#0e1424] border border-slate-800 hover:border-blue-500/30 rounded-2xl sm:rounded-[2rem] flex items-center justify-between gap-2 sm:gap-4 shadow-lg transition-all">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 text-[11px] sm:text-xs font-bold truncate">{isEn ? 'Current Power' : 'الاستهلاك الآن'}</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {globalData?.currentPower || 286} <span className="text-[11px] sm:text-xs text-slate-500 font-normal">{isEn ? 'W' : 'واط'}</span>
            </span>
            <span className="text-[10px] text-blue-400 font-bold mt-0.5">
              {isEn ? 'Today' : 'اليوم'}: {Math.round((globalData?.totalKWh || 184.4) * 10) / 10} kWh
            </span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Activity size={18} className="sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Card 4: System Alerts & Security */}
        <div className="p-3.5 sm:p-5 bg-[#0e1424] border border-slate-800 hover:border-purple-500/30 rounded-2xl sm:rounded-[2rem] flex items-center justify-between gap-2 sm:gap-4 shadow-lg transition-all">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-400 text-[11px] sm:text-xs font-bold truncate">{isEn ? 'System Health' : 'تنبيهات وحالة النظام'}</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-0.5">
              0
            </span>
            <span className="text-[10px] text-purple-400 font-bold mt-0.5">
              {isEn ? 'Protected' : 'الحماية نشطة بالكامل'}
            </span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="sm:w-5 sm:h-5" />
          </div>
        </div>
      </motion.div>

      {/* ── 3. Quick Scenes Grid ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { title: "الصباح", icon: Sun, color: "from-amber-400/20 to-orange-500/10", border: "border-amber-500/30", text: "text-amber-300", glow: "rgba(245, 158, 11, 0.4)" },
          { title: "المساء", icon: Moon, color: "from-indigo-500/20 to-purple-600/10", border: "border-indigo-500/30", text: "text-indigo-300", glow: "rgba(99, 102, 241, 0.4)" },
          { title: "مشاهدة فيلم", icon: Film, color: "from-rose-500/20 to-red-600/10", border: "border-rose-500/30", text: "text-rose-300", glow: "rgba(244, 63, 94, 0.4)" },
          { title: "العمل", icon: Briefcase, color: "from-teal-400/20 to-emerald-500/10", border: "border-teal-500/30", text: "text-teal-300", glow: "rgba(20, 184, 166, 0.4)" },
        ].map((scene, idx) => (
          <button 
            key={idx}
            onClick={() => handleExecuteQuickScene(scene.title)}
            className={`group relative h-24 rounded-[1.8rem] overflow-hidden flex flex-col items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.03] active:scale-95 border ${scene.border} bg-gradient-to-br ${scene.color} backdrop-blur-xl shadow-lg`}
          >
            <scene.icon size={26} className={`${scene.text} transition-transform group-hover:-translate-y-1`} style={{ filter: `drop-shadow(0 0 10px ${scene.glow})` }} />
            <span className="text-white font-bold text-xs tracking-wide">{scene.title}</span>
          </button>
        ))}
      </motion.div>

      {/* ── 4. BLE Setup Banner ── */}
      {user?.role !== 'RESTRICTED' && (
        <motion.div variants={itemVariants}>
          <Link href="/setup/ble" className="block w-full hover:scale-[1.01] transition-transform duration-300">
            <GlassCard className="p-6 overflow-hidden relative flex flex-col md:flex-row items-center justify-between gap-6 border-white/10 rounded-[2.5rem] bg-slate-950/60 shadow-xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center gap-4 relative z-10 w-full">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.35)] border border-cyan-300/30 shrink-0">
                  <Bluetooth size={26} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-white mb-0.5">إضافة جهاز جديد (Bluetooth)</h3>
                  <p className="text-xs text-slate-400">
                    قم بربط أجهزة التحكم (ESP32) والملحقات الذكية بشبكة منزلك بأمان تام عبر البلوتوث.
                  </p>
                </div>
              </div>

              <div className="relative z-10 w-full md:w-auto shrink-0 flex justify-end">
                <AnimatedButton variant="primary" className="whitespace-nowrap px-6 py-2.5 font-bold text-xs flex items-center gap-2 rounded-xl">
                  البدء بالإعداد <ChevronRight size={14} />
                </AnimatedButton>
              </div>
            </GlassCard>
          </Link>
        </motion.div>
      )}

      {/* ── 5. AI Recommendations (Edge AI) ── */}
      <motion.div variants={itemVariants}>
        <AiInsights />
      </motion.div>

      {/* ── 6. Favorite Sockets & Switches Grid ── */}
      <motion.div variants={itemVariants} className="w-full">
        <div className="mb-4 px-2 flex justify-between items-center">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Zap size={20} className="text-cyan-400" />
            <span>{isEn ? 'Quick Switch & Socket Controls' : 'التحكم باللوحات والمقابس الذكية'}</span>
          </h3>
          <Link href="/devices" className="text-xs text-cyan-400 hover:text-cyan-300 font-bold transition-colors">
            {isEn ? 'View All' : 'عرض الكل'} ←
          </Link>
        </div>
        <DeviceGrid />
      </motion.div>

      {/* ── 7. Architectural AutoCAD 2D/3D Floorplan (Placed at the bottom) ── */}
      {user?.role !== 'RESTRICTED' && (
        <motion.div variants={itemVariants} className="w-full">
          <div className="w-full rounded-[2.5rem] bg-slate-950/80 border border-cyan-500/30 p-4 md:p-6 shadow-2xl backdrop-blur-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                  <Compass size={22} />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                    <span>المخطط الهندسي وتوزيع الأحمال الذكية (2D AutoCAD FloorPlan)</span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      مخطط تفاعلي
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    خريطة تفاعلية لتوزيع الغرف ومخارج التحكم الكهربائي وتعيين المقابس على مخطط المنزل
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/floorplan"
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5"
                >
                  <Layers size={14} />
                  <span>تعديل وتوسيع المخطط</span>
                </Link>
              </div>
            </div>

            {/* PERFORMANCE FIX #1: Preview instead of full 3D render (saves 800KB Three.js) */}
            <Link href="/floorplan" className="block w-full min-h-[500px] rounded-3xl bg-black/40 border border-white/5 overflow-hidden relative shadow-inner hover:border-cyan-500/30 transition-all group">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-cyan-950/20 to-blue-950/20 group-hover:from-cyan-900/30 group-hover:to-blue-900/30 transition-all">
                <Compass size={64} className="text-cyan-400/50 group-hover:text-cyan-400 transition-all group-hover:scale-110" />
                <div className="text-center space-y-2">
                  <p className="text-xl font-bold text-white">المخطط الهندسي التفاعلي</p>
                  <p className="text-sm text-slate-400">انقر لفتح المخطط ثلاثي الأبعاد</p>
                </div>
                <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold shadow-lg group-hover:shadow-cyan-500/50 transition-all">
                  <Layers size={18} />
                  <span>فتح المخطط الكامل</span>
                  <ChevronRight size={18} />
                </div>
              </div>
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── 8. Real Family Activity Feed ── */}
      <motion.div variants={itemVariants} className="bg-slate-950/80 border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Clock size={20} className="text-cyan-400" />
            <span>سجل نشاط العائلة والأتمتة اللحظي</span>
          </h3>
          <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            محدث مباشرة 🟢
          </span>
        </div>
        
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {(!activityLogs || activityLogs.length === 0) ? (
            <div className="py-8 text-center text-slate-500 text-xs font-bold bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
              لا توجد نشاطات مسجلة حالياً. الأوامر المستلمة من العائلة والأتمتة ستظهر هنا لحظياً.
            </div>
          ) : (
            activityLogs.slice(0, 10).map((log: any, idx: number) => {
              const timeStr = log.timestamp 
                ? new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                : 'الآن';
              
              const isAutomation = log.type === 'AUTOMATION' || log.message?.includes('أتمتة') || log.message?.includes('جدولة');
              const isSystem = log.type === 'SYSTEM' || log.message?.includes('ESP32') || log.message?.includes('مستشعر');
              
              const dotColor = isAutomation 
                ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' 
                : isSystem 
                  ? 'bg-purple-500 shadow-[0_0_8px_#a855f7]' 
                  : 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]';

              return (
                <div key={log.id || idx} className="flex items-center gap-4 text-xs bg-white/[0.03] hover:bg-white/[0.06] transition-colors p-3.5 rounded-2xl border border-white/5">
                  <div className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
                  <span className="text-slate-400 font-mono w-20 shrink-0 text-left" dir="ltr">{timeStr}</span>
                  <span className="text-slate-200 font-medium leading-relaxed">
                    {log.message || log.details}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </motion.div>

      <DiscoveryPopup />
      <AIChatInterface />
    </motion.div>
  );
}
