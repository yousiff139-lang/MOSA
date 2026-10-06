"use client";

import { useState, useEffect, useRef } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Settings as SettingsIcon, Palette, Volume2, Globe, Shield, Zap, Download, Upload, FileJson, Send, MessageSquare, Eye, EyeOff, CheckCircle2, AlertTriangle, Bell, BellOff, Clock, Moon } from 'lucide-react';
import { AnimatedButton } from '@/components/ui/AnimatedButton';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import { useTheme } from '@/context/ThemeContext';
import { notify } from '@/store/useConfirmStore';

export default function SettingsPage() {
  const { lang, setLang } = useRuntimeStore();
  const { soundEnabled, setSoundEnabled } = useTheme();
  const [kwhPrice, setKwhPrice] = useState('10');
  const [kwhBudget, setKwhBudget] = useState('50000');
  const [isRestoring, setIsRestoring] = useState(false);
  
  // Telegram Bot State
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [telegramMutedUntil, setTelegramMutedUntil] = useState<string | null>(null);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [isSendingTelegramTest, setIsSendingTelegramTest] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isUpdatingSnooze, setIsUpdatingSnooze] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setKwhPrice(localStorage.getItem('mosa_kwh_price') || '10');
      setKwhBudget(localStorage.getItem('mosa_kwh_budget') || '50000');
    }
    
    const fetchTariffData = async () => {
      try {
        const { fetchAuth } = await import('@/store/useSmartHomeStore');
        const res = await fetchAuth('/api/energy/tariff');
        if (res.ok) {
          const data = await res.json();
          if (data.energyTariff) {
            setKwhPrice(data.energyTariff.toString());
            setKwhBudget(data.energyBudget.toString());
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    const fetchSettingsData = async () => {
      try {
        const { fetchAuth } = await import('@/store/useSmartHomeStore');
        const res = await fetchAuth('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            if (data.telegramToken) setTelegramToken(data.telegramToken);
            if (data.telegramChatId) setTelegramChatId(data.telegramChatId);
            if (data.telegramEnabled !== undefined) setTelegramEnabled(data.telegramEnabled);
            if (data.telegramMutedUntil !== undefined) setTelegramMutedUntil(data.telegramMutedUntil);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchTariffData();
    fetchSettingsData();
  }, []);

  const handleSaveTariff = async (tariffVal: string, budgetVal: string) => {
    setKwhPrice(tariffVal);
    setKwhBudget(budgetVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mosa_kwh_price', tariffVal);
      localStorage.setItem('mosa_kwh_budget', budgetVal);
    }
    try {
      const { fetchAuth } = await import('@/store/useSmartHomeStore');
      await fetchAuth('/api/energy/tariff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          energyTariff: Number(tariffVal),
          energyBudget: Number(budgetVal)
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Export system backup payload
  const handleExportBackup = async () => {
    try {
      const { fetchAuth } = await import('@/store/useSmartHomeStore');
      const res = await fetchAuth('/api/config/backup');
      if (!res.ok) throw new Error('Failed to fetch backup');
      const data = await res.json();

      // Download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mosa_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('فشل في تصدير النسخة الاحتياطية');
    }
  };

  // Import configuration backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.rooms || !json.devices || !json.automations) {
          alert('الملف غير صالح للتهيئة، يرجى التأكد من اختيار ملف النسخ الاحتياطي الصحيح');
          return;
        }

        if (!confirm('سيتم مسح الأجهزة والغرف والقواعد الحالية واستبدالها بالملف المختار، هل تريد الاستمرار؟')) {
          return;
        }

        setIsRestoring(true);
        const { fetchAuth } = await import('@/store/useSmartHomeStore');
        const res = await fetchAuth('/api/config/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });

        if (res.ok) {
          alert(isEn ? 'Backup restored successfully! Refreshing system...' : 'تم استعادة النسخة الاحتياطية بنجاح! جاري تنشيط النظام...');
          window.location.reload();
        } else {
          const err = await res.json();
          alert(err.error || (isEn ? 'Import failed' : 'فشلت عملية الاستيراد'));
        }
      } catch (err) {
        alert(isEn ? 'Error reading configuration file' : 'حدث خطأ أثناء قراءة أو فك ملف التهيئة');
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  const isEn = lang === 'en';

  return (
    <div className="p-3.5 sm:p-6 lg:p-10 h-full flex flex-col gap-6 sm:gap-8 pb-36" dir={isEn ? 'ltr' : 'rtl'}>
      
      {/* Page Header */}
      <div className="flex items-center gap-3 sm:gap-4 border-b border-white/5 pb-4 sm:pb-6">
        <div className="p-3 sm:p-4 bg-primary/10 rounded-2xl border border-primary/20 shadow-[inset_0_0_20px_var(--primary-glow)] shrink-0">
          <SettingsIcon className="text-primary drop-shadow-[0_0_8px_var(--primary-glow)]" size={26} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-white truncate">{isEn ? 'Settings' : 'الإعدادات'}</h1>
          <p className="text-xs sm:text-sm text-gray-400 font-medium line-clamp-2">
            {isEn ? 'Customize user experience, system options & platform preferences' : 'تخصيص تجربة الاستخدام والنظام ومطابقة الهوية'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
        
        {/* Appearance Theme Selector */}
        <GlassCard className="p-6 flex flex-col gap-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3 border-b border-white/10 pb-4">
            <Palette className="text-primary" size={24} />
            {isEn ? 'Appearance & Theme' : 'المظهر والألوان'}
          </h2>
          <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
            <span className="text-white font-medium">{isEn ? 'Primary Color (Theme)' : 'اللون الأساسي (الثيم)'}</span>
            <ThemeSwitcher />
          </div>
        </GlassCard>

        {/* Pricing Tariff Settings */}
        <GlassCard className="p-6 flex flex-col gap-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3 border-b border-white/10 pb-4">
            <Zap className="text-primary" size={24} />
            {isEn ? 'Energy Tariff & Budget' : 'تسعير استهلاك الطاقة والميزانية'}
          </h2>
          <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-xl">
            <div className="flex justify-between items-center">
              <span className="text-white font-medium">{isEn ? 'kWh Price' : 'سعر الكيلوواط/ساعة (kWh)'}</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  value={kwhPrice} 
                  onChange={(e) => handleSaveTariff(e.target.value, kwhBudget)}
                  className="w-24 bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white text-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
                <span className="text-xs text-slate-400">{isEn ? 'IQD' : 'د.ع'}</span>
              </div>
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-3">
              <span className="text-white font-medium">{isEn ? 'Monthly Budget' : 'الميزانية الشهرية للكهرباء'}</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  value={kwhBudget} 
                  onChange={(e) => handleSaveTariff(kwhPrice, e.target.value)}
                  className="w-24 bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-white text-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
                <span className="text-xs text-slate-400">{isEn ? 'IQD' : 'د.ع'}</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* System Language Settings */}
        <GlassCard className="p-6 flex flex-col gap-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3 border-b border-white/10 pb-4">
            <Globe className="text-primary" size={24} />
            {isEn ? 'Language & Region' : 'اللغة والمنطقة'}
          </h2>
          <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
            <span className="text-white font-medium">{isEn ? 'Interface Language' : 'لغة الواجهة'}</span>
            <AnimatedButton 
              variant="outline" 
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            >
              {lang === 'ar' ? 'English' : 'العربية'}
            </AnimatedButton>
          </div>
        </GlassCard>

        {/* Sound FX Settings */}
        <GlassCard className="p-6 flex flex-col gap-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3 border-b border-white/10 pb-4">
            <Volume2 className="text-primary" size={24} />
            {isEn ? 'Sound & Feedback' : 'الصوت والتفاعل'}
          </h2>
          <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
            <span className="text-white font-medium">{isEn ? 'System Sounds (Alerts)' : 'أصوات النظام (التنبيهات)'}</span>
            <AnimatedButton 
              variant={soundEnabled ? 'primary' : 'outline'}
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? (isEn ? 'Enabled' : 'مفعل') : (isEn ? 'Disabled' : 'معطل')}
            </AnimatedButton>
          </div>
        </GlassCard>

        {/* MOSA OS System Update Engine Card */}
        <GlassCard className="p-6 flex flex-col gap-6 border-blue-500/30 bg-gradient-to-br from-blue-950/30 to-slate-900/60">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <Download className="text-blue-400" size={24} />
              {isEn ? 'MOSA OS Autonomous Updates' : 'تحديثات النظام الذكية (MOSA OS)'}
            </h2>
            <span className="bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full border border-blue-500/30 font-mono font-semibold">
              v1.0.0 Stable
            </span>
          </div>
          
          <p className="text-sm text-slate-300">
            {isEn ? 'Autonomous self-healing update engine (Backend + Frontend + Firmware OTA + Database Schema) with automatic rollback protection.' : 'مُحرك التحديثات الذاتي المستقل للنظام (Backend + Frontend + Firmware OTA + Database Schema) مع حماية التراجع التلقائي فجراً.'}
          </p>

          <div className="grid grid-cols-2 gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
            <a 
              href="/settings/ota"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold p-3 rounded-xl flex items-center justify-center gap-2 transition-all text-xs text-center shadow-lg shadow-blue-600/20"
            >
              <Download size={16} />
              {isEn ? 'Update Manager' : 'مركز إدارة التحديثات'}
            </a>
            <button 
              onClick={async () => {
                try {
                  const { fetchAuth } = await import('@/store/useSmartHomeStore');
                  const res = await fetchAuth('/api/system/simulate', { method: 'POST' });
                  if (res.ok) alert(isEn ? 'Update simulation trigger sent!' : 'تم إرسال إشعار محاكاة التحديث بنجاح!');
                } catch {
                  alert(isEn ? 'Error checking updates' : 'حدث خطأ أثناء فحص التحديثات');
                }
              }}
              className="bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold p-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-all text-xs text-center"
            >
              <Zap size={16} className="text-amber-400" />
              {isEn ? 'Simulate Update Toast' : 'محاكاة إشعار التحديث'}
            </button>
          </div>
        </GlassCard>

        {/* Backup and Restore config panel */}
        <GlassCard className="p-6 flex flex-col gap-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3 border-b border-white/10 pb-4">
            <FileJson className="text-primary" size={24} />
            {isEn ? 'Backup & Restore Configuration' : 'النسخ الاحتياطي واستعادة التكوين'}
          </h2>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 space-y-2 text-xs">
            <div className="font-bold text-blue-400 flex items-center gap-1.5 text-sm">
              <FileJson size={18} />
              {isEn ? 'Smart Lightweight Backup' : 'نسخة احتياطية خفيفة ومنظمة:'}
            </div>
            <p className="text-slate-300 leading-relaxed">
              {isEn 
                ? 'Backs up all active devices, rooms, automation rules, and system settings cleanly. Soft-deleted items are excluded to save memory and space.'
                : 'تحفظ التكوين الكامل للنظام (الأجهزة النشطة، منافذ الـ GPIO، الغرف، السيناريوهات والأتمتة) بدون السجلات المحذوفة سابقاً للحفاظ على السرعة وخفة الحجم.'
              }
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl">
            <button 
              onClick={handleExportBackup}
              className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white font-bold p-3 rounded-xl border border-blue-500/20 flex flex-col items-center justify-center gap-2 transition-all shadow-lg"
            >
              <Download size={20} />
              <span className="text-xs">{isEn ? 'Export Backup (.json)' : 'تنزيل نسخة احتياطية (.json)'}</span>
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isRestoring}
              className="bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white font-bold p-3 rounded-xl border border-purple-500/20 flex flex-col items-center justify-center gap-2 transition-all shadow-lg"
            >
              <Upload size={20} />
              <span className="text-xs">{isRestoring ? (isEn ? 'Restoring...' : 'جاري الاستعادة...') : (isEn ? 'Import Configuration' : 'استعادة النسخة')}</span>
            </button>
            <input 
              type="file" 
              accept=".json"
              ref={fileInputRef}
              onChange={handleImportBackup}
              className="hidden"
            />
          </div>
        </GlassCard>

        {/* Telegram Instant Dispatcher Notification Card */}
        <GlassCard className="p-4 sm:p-6 flex flex-col gap-5 sm:gap-6 md:col-span-2 border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-slate-900/60 to-slate-950/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <MessageSquare className="text-cyan-400 shrink-0" size={24} />
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  {isEn ? 'Instant Telegram Alert Bot' : 'إشعارات البوت الفورية (Telegram Alerts)'}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {telegramEnabled 
                    ? (isEn ? 'Alerts are actively monitoring and dispatching events' : 'التنبيهات تعمل بنشاط وترسل الإشعارات لهاتفك')
                    : (isEn ? 'Alerts are PAUSED indefinitely until you toggle them ON' : 'التنبيهات متوقفة تماماً ولن ترسل شيئاً حتى تقوم بتشغيلها مجدداً')
                  }
                </p>
              </div>
            </div>

            {/* Master ON / OFF Toggle Button */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={async () => {
                  const nextEnabled = !telegramEnabled;
                  setTelegramEnabled(nextEnabled);
                  try {
                    const { fetchAuth } = await import('@/store/useSmartHomeStore');
                    await fetchAuth('/api/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ telegramEnabled: nextEnabled })
                    });
                    if (nextEnabled) {
                      notify(isEn ? 'Telegram alerts ENABLED permanently! 🔔' : 'تم تشغيل التنبيهات بنجاح وستصلك الإشعارات! 🔔', 'success');
                    } else {
                      notify(isEn ? 'Telegram alerts PAUSED permanently until you re-enable them! 🛑' : 'تم إيقاف التنبيهات بالكامل (لن تعمل حتى تشغلها بنفسك) 🛑', 'info');
                    }
                  } catch (e) {
                    notify(isEn ? 'Failed to update alert state' : 'فشل تغيير حالة التنبيهات', 'error');
                  }
                }}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-lg active:scale-95 ${
                  telegramEnabled 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 shadow-emerald-500/10' 
                    : 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30 shadow-red-500/10'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${telegramEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                <span>{telegramEnabled ? (isEn ? 'Status: ON (Active)' : 'الحالة: شغال ومفعل 🟢') : (isEn ? 'Status: OFF (Paused)' : 'الحالة: متوقف ومعطل 🛑')}</span>
              </button>
            </div>
          </div>

          {!telegramEnabled && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 sm:p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-red-200">
              <div className="flex items-start sm:items-center gap-2">
                <BellOff size={18} className="text-red-400 shrink-0 mt-0.5 sm:mt-0" />
                <span className="leading-relaxed">
                  {isEn 
                    ? '⚠️ Telegram alerts are permanently turned OFF. No alerts will be sent to your phone until you click "الحالة: شغال ومفعل 🟢" above.'
                    : '⚠️ التنبيهات متوقفة بالكامل حالياً. لن يتم إرسال أي إشعار لهاتفك حتى تقوم بالضغط على زر التشغيل بالأعلى مرة أخرى.'
                  }
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setTelegramEnabled(true);
                  try {
                    const { fetchAuth } = await import('@/store/useSmartHomeStore');
                    await fetchAuth('/api/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ telegramEnabled: true })
                    });
                    notify(isEn ? 'Alerts resumed! 🔔' : 'تم تشغيل التنبيهات فوراً! 🔔', 'success');
                  } catch (e) {}
                }}
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl text-xs shrink-0 transition-all shadow-md text-center"
              >
                {isEn ? 'Turn ON Now' : 'تشغيل الآن 🔔'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-4 bg-black/40 p-4 sm:p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-300 font-bold">1. Telegram Bot Token:</label>
                    <button
                      type="button"
                      onClick={() => setShowTelegramToken(!showTelegramToken)}
                      className="text-slate-400 hover:text-cyan-300 transition-colors flex items-center gap-1 text-[11px]"
                    >
                      {showTelegramToken ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showTelegramToken ? (isEn ? 'Hide' : 'إخفاء') : (isEn ? 'Show' : 'إظهار')}</span>
                    </button>
                  </div>
                  <input
                    type={showTelegramToken ? 'text' : 'password'}
                    value={telegramToken}
                    onChange={e => setTelegramToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyZ..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-bold mb-1.5">2. Telegram Chat ID:</label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={e => setTelegramChatId(e.target.value)}
                    placeholder="987654321"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition-all"
                  />
                </div>
              </div>

              {/* ── Control & Snooze Box (إيقاف عام دائم + إيقاف مؤقت) ── */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-white/10 space-y-3">
                {/* Header Status & Master Toggle */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">
                      {isEn ? 'Global Alert Status:' : 'التحكم العام بالتنبيهات:'}
                    </span>
                    {telegramEnabled ? (
                      telegramMutedUntil && new Date(telegramMutedUntil).getTime() > Date.now() ? (
                        <span className="text-amber-400 text-xs font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                          <Clock size={12} className="animate-pulse" />
                          {isEn ? 'Temporarily Snoozed' : 'مؤقت (عدم إزعاج)'}
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          {isEn ? 'Active (ON)' : 'شغال ومفعل 🟢'}
                        </span>
                      )
                    ) : (
                      <span className="text-red-400 text-xs font-bold flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        {isEn ? 'Permanently OFF' : 'إيقاف عام دائم 🛑'}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const nextEnabled = !telegramEnabled;
                      setTelegramEnabled(nextEnabled);
                      if (nextEnabled) {
                        setTelegramMutedUntil(null);
                      }
                      try {
                        const { fetchAuth } = await import('@/store/useSmartHomeStore');
                        await fetchAuth('/api/settings', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            telegramEnabled: nextEnabled,
                            ...(nextEnabled ? { telegramMutedUntil: null } : {})
                          })
                        });
                        if (nextEnabled) {
                          notify(isEn ? 'Telegram alerts ENABLED! 🔔' : 'تم تشغيل التنبيهات بنجاح! 🔔', 'success');
                        } else {
                          notify(isEn ? 'Telegram alerts STOPPED permanently! 🛑' : 'تم الإيقاف العام الدائم للتنبيهات (لن تعمل حتى تشغلها بنفسك) 🛑', 'info');
                        }
                      } catch (e) {
                        notify(isEn ? 'Failed to update alert state' : 'فشل تغيير حالة التنبيهات', 'error');
                      }
                    }}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all shadow-md active:scale-95 flex items-center gap-1.5 ${
                      telegramEnabled
                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold border-emerald-400'
                    }`}
                  >
                    {telegramEnabled ? (
                      <>
                        <BellOff size={13} />
                        <span>{isEn ? 'Turn OFF Permanently' : 'إيقاف عام دائم 🛑'}</span>
                      </>
                    ) : (
                      <>
                        <Bell size={13} />
                        <span>{isEn ? 'Turn ON Alerts' : 'تشغيل التنبيهات الآن 🔔'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Snooze & Pause Options */}
                {telegramEnabled && (
                  <div>
                    {telegramMutedUntil && new Date(telegramMutedUntil).getTime() > Date.now() ? (
                      <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-amber-300/90 flex items-center gap-1.5">
                          <Clock size={13} className="shrink-0 text-amber-400" />
                          <span>
                            {isEn 
                              ? `Snoozed until: ${new Date(telegramMutedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : `متوقف حتى: ${new Date(telegramMutedUntil).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                            }
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            setIsUpdatingSnooze(true);
                            try {
                              const { fetchAuth } = await import('@/store/useSmartHomeStore');
                              const res = await fetchAuth('/api/settings', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ telegramMutedUntil: null })
                              });
                              if (res.ok) {
                                setTelegramMutedUntil(null);
                                notify(isEn ? 'Alerts resumed! 🔔' : 'تم استئناف التنبيهات بنجاح! 🔔', 'success');
                              }
                            } finally {
                              setIsUpdatingSnooze(false);
                            }
                          }}
                          disabled={isUpdatingSnooze}
                          className="text-[10px] bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-2.5 py-1 rounded-lg transition-all"
                        >
                          {isEn ? 'Resume' : 'استئناف الآن'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <span className="text-[11px] text-slate-400 font-medium block">
                          {isEn ? 'Pause / Snooze Options:' : 'خيارات الإيقاف المؤقت (عدم الإزعاج):'}
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { label: isEn ? '30m' : '30 دقيقة', mins: 30 },
                            { label: isEn ? '1h' : 'ساعة', mins: 60 },
                            { label: isEn ? '4h' : '4 ساعات', mins: 240 },
                            { label: isEn ? '8h 🌙' : '8س (نوم)', mins: 480 },
                          ].map(preset => (
                            <button
                              key={preset.mins}
                              type="button"
                              disabled={isUpdatingSnooze}
                              onClick={async () => {
                                setIsUpdatingSnooze(true);
                                try {
                                  const muteUntil = new Date(Date.now() + preset.mins * 60 * 1000).toISOString();
                                  const { fetchAuth } = await import('@/store/useSmartHomeStore');
                                  const res = await fetchAuth('/api/settings', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ telegramMutedUntil: muteUntil })
                                  });
                                  if (res.ok) {
                                    setTelegramMutedUntil(muteUntil);
                                    notify(isEn ? `Alerts snoozed for ${preset.label}` : `تم إيقاف الإشعارات مؤقتاً لمدة ${preset.label} 🔕`, 'info');
                                  }
                                } finally {
                                  setIsUpdatingSnooze(false);
                                }
                              }}
                              className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-medium py-1.5 px-1 rounded-lg text-[10px] border border-white/5 transition-all text-center"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={async () => {
                    if (!telegramToken.trim() || !telegramChatId.trim()) {
                      notify(isEn ? 'Please enter both Bot Token and Chat ID' : 'يرجى إدخال كل من Bot Token و Chat ID أولاً', 'error');
                      return;
                    }
                    setIsSavingTelegram(true);
                    try {
                      const { fetchAuth } = await import('@/store/useSmartHomeStore');
                      const res = await fetchAuth('/api/settings', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ telegramToken: telegramToken.trim(), telegramChatId: telegramChatId.trim(), telegramEnabled: true })
                      });
                      if (res.ok) {
                        notify(isEn ? 'Telegram credentials saved successfully! ✓' : 'تم حفظ بيانات البوت بنجاح! ✓', 'success');
                      } else {
                        const err = await res.json().catch(() => ({}));
                        notify(err.message || (isEn ? 'Error saving config' : 'خطأ في حفظ الإعدادات'), 'error');
                      }
                    } catch (e) {
                      notify(isEn ? 'Error saving config' : 'خطأ في حفظ الإعدادات', 'error');
                    } finally {
                      setIsSavingTelegram(false);
                    }
                  }}
                  disabled={isSavingTelegram}
                  className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold p-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
                >
                  <CheckCircle2 size={15} />
                  {isSavingTelegram ? (isEn ? 'Saving...' : 'جاري الحفظ...') : (isEn ? 'Save Credentials' : 'حفظ البيانات')}
                </button>

                <button
                  onClick={async () => {
                    if (!telegramToken.trim() || !telegramChatId.trim()) {
                      notify(isEn ? 'Please enter Bot Token and Chat ID first' : 'يرجى إدخال Bot Token و Chat ID أولاً', 'error');
                      return;
                    }
                    setIsSendingTelegramTest(true);
                    try {
                      const { fetchAuth } = await import('@/store/useSmartHomeStore');
                      const res = await fetchAuth('/api/settings/telegram/test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: telegramToken.trim(), chatId: telegramChatId.trim() })
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && data.success) {
                        notify(data.message || (isEn ? 'Test alert delivered to Telegram! 🚀' : 'تم إرسال إشعار التجربة لهاتفك على تليجرام بنجاح! 🚀'), 'success');
                      } else {
                        notify(data.message || (isEn ? 'Test failed: Check your token or start the bot' : 'فشل إرسال التنبيه: تأكد من التوكن أو افتح البوت واضغط Start'), 'error');
                      }
                    } catch (e) {
                      notify(isEn ? 'Failed to connect to Telegram' : 'فشل الاتصال بخادم تليجرام', 'error');
                    } finally {
                      setIsSendingTelegramTest(false);
                    }
                  }}
                  disabled={isSendingTelegramTest}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 font-bold p-3 rounded-xl border border-cyan-500/30 text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md"
                >
                  <Send size={15} className={isSendingTelegramTest ? 'animate-pulse' : ''} />
                  {isSendingTelegramTest ? (isEn ? 'Sending...' : 'جاري الإرسال...') : (isEn ? 'Send Test Alert' : 'تجربة التنبيه 🚀')}
                </button>
              </div>
            </div>

            {/* Telegram Step-by-Step Tutorial Box */}
            <div className="bg-black/30 border border-cyan-500/20 rounded-2xl p-5 space-y-3.5 text-xs flex flex-col justify-center">
              <h3 className="font-bold text-cyan-400 flex items-center gap-1.5 text-sm border-b border-white/10 pb-2.5">
                💡 طريقة تفعيل البوت والحصول على البيانات خلال دقيقة:
              </h3>
              <ol className="space-y-2.5 text-slate-300 pr-2 list-decimal list-inside leading-relaxed">
                <li>
                  <span className="font-bold text-white">خطوة 1 (Bot Token):</span> افتح تطبيق تليجرام وابحث عن الحساب <code className="bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">@BotFather</code>، أرسل له الأمر <code className="bg-white/10 text-emerald-400 px-1 py-0.5 rounded">/newbot</code> واتبع التعليمات لإنشاء بوتك واحرص على نسخ الـ <span className="text-cyan-300">API Token</span>.
                </li>
                <li>
                  <span className="font-bold text-white">خطوة 2 (Chat ID):</span> ابحث عن حساب <code className="bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">@userinfobot</code> ثم أرسل له أي كلمة، وسيقوم بالرد عليك فوراً بالـ <span className="text-amber-300">Id</span> الخاص بحسابك الشخصي.
                </li>
                <li className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-amber-200">
                  <span className="font-bold text-amber-300 flex items-center gap-1 mb-1">
                    <AlertTriangle size={14} className="text-amber-400 inline" />
                    خطوة هامة جداً (تفعيل البوت):
                  </span>
                  افتح البوت الذي أنشأته في تليجرام واضغط على زر <strong>(Start / البدء)</strong> أو أرسل له أي رسالة أولاً لكي يسمح تليجرام له بمراسلتك.
                </li>
                <li>
                  <span className="font-bold text-white">خطوة 4 (الحفظ والتجربة):</span> ضع الـ Token والـ Chat ID في الحقول على اليمين واضغط <strong>"حفظ البيانات"</strong> ثم <strong>"تجربة التنبيه 🚀"</strong> ليصلك إشعار فوراً!
                </li>
              </ol>
            </div>
          </div>
        </GlassCard>

        {/* Danger Factory Reset Panel */}
        <GlassCard className="p-6 flex flex-col gap-6 border-red-500/20">
          <h2 className="text-xl font-bold text-red-400 flex items-center gap-3 border-b border-red-500/10 pb-4">
            <Shield className="text-red-400" size={24} />
            {isEn ? 'Advanced System' : 'النظام المتقدم'}
          </h2>
          <div className="flex justify-between items-center bg-red-500/5 p-4 rounded-xl border border-red-500/10">
            <span className="text-red-200 font-medium">{isEn ? 'Factory Reset' : 'إعادة ضبط المصنع'}</span>
            <AnimatedButton 
              variant="primary" 
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={async () => {
                if (window.confirm(isEn ? 'Are you sure you want to reset all system data? This cannot be undone.' : 'هل أنت متأكد من مسح جميع بيانات النظام؟ هذا الإجراء لا يمكن التراجع عنه.')) {
                  const confirmationText = window.prompt(isEn ? 'Please type "RESET" to confirm:' : 'الرجاء كتابة كلمة "فرمتة" لتأكيد المسح النهائي:');
                  if (confirmationText === 'RESET' || confirmationText === 'فرمتة') {
                    try {
                      const { fetchAuth } = await import('@/store/useSmartHomeStore');
                      const res = await fetchAuth('/api/settings/reset', { method: 'POST' });
                      if (res.ok) {
                        alert(isEn ? 'System reset complete. Rebooting...' : 'تم فرمتة النظام بنجاح. سيتم إعادة تشغيل النظام.');
                        window.location.href = '/';
                      } else {
                        alert(isEn ? 'Failed to reset system' : 'فشل في فرمتة النظام');
                      }
                    } catch (e) {
                      alert(isEn ? 'Server connection error' : 'خطأ في الاتصال بالخادم');
                    }
                  } else if (confirmationText !== null) {
                    alert(isEn ? 'Operation cancelled. Incorrect confirmation word.' : 'تم إلغاء العملية. الكلمة المدخلة غير صحيحة.');
                  }
                }
              }}
            >
              {isEn ? 'Reset Platform' : 'مسح النظام'}
            </AnimatedButton>
          </div>
        </GlassCard>

      </div>
    </div>
  );
}
