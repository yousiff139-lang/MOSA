"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, QrCode, Smartphone, Check, HelpCircle, RefreshCw, 
  Wifi, Link2, ShieldCheck, Copy, ExternalLink, Sparkles,
  Layers, CheckCircle2, AlertCircle, ArrowUpRight, Cloud, Lightbulb,
  Power, Lock, Info, CheckCircle, X
} from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';

export default function MatterSettingsPage() {
  const [copied, setCopied] = useState(false);
  const [matterStatus, setMatterStatus] = useState<any>({
    online: true,
    enabled: true,
    pairingCode: 'MT:Y.K90AFN00KA0648G00',
    manualCode: '3497-011-2332',
    qrCodeDataUrl: ''
  });
  const [integrationsStatus, setIntegrationsStatus] = useState<any>({
    tuya: { online: false, linked: false, clientId: null },
    hue: { online: false, linked: false, bridgeIp: null }
  });
  
  const [activeTab, setActiveTab] = useState<'homekit' | 'matter' | 'certs'>('homekit');
  const [homekitStatus, setHomekitStatus] = useState<any>({
    active: true,
    pincode: '202-02-021',
    qrCodeDataUrl: '',
    setupUri: '',
    accessoriesCount: 0
  });
  const [isResettingHomeKit, setIsResettingHomeKit] = useState(false);
  const [controllers, setControllers] = useState<any[]>([]);
  const [renewingCertNodeId, setRenewingCertNodeId] = useState<string | null>(null);

  const [tuyaId, setTuyaId] = useState('');
  const [tuyaSecret, setTuyaSecret] = useState('');
  const [hueIp, setHueIp] = useState('192.168.1.50');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchIntegrations = async () => {
    try {
      const res = await fetchAuth('/api/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrationsStatus(data);
        if (data.matter) {
          setMatterStatus(data.matter);
        }
        if (data.homekit) {
          setHomekitStatus(data.homekit);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchControllers = async () => {
    try {
      const res = await fetchAuth('/api/controllers');
      if (res.ok) {
        const data = await res.json();
        setControllers(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  const handleResetHomeKit = async () => {
    setIsResettingHomeKit(true);
    try {
      const res = await fetchAuth('/api/integrations/homekit/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.homekit) setHomekitStatus(data.homekit);
        showToast('تمت إعادة ضبط وتوليد رمز إقران جديد لـ Apple HomeKit 🍏', 'success');
      }
    } catch (e) {
      showToast('حدث خطأ في إعادة ضبط HomeKit', 'error');
    } finally {
      setIsResettingHomeKit(false);
    }
  };

  const handleRenewCert = async (nodeId: string, nodeName: string) => {
    setRenewingCertNodeId(nodeId);
    try {
      const res = await fetchAuth(`/api/controllers/${nodeId}/renew-cert`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `تم تجديد شهادة ${nodeName} هوائياً بنجاح! 🔐`, 'success');
      } else {
        showToast(data.message || 'فشل تجديد الشهادة', 'error');
      }
    } catch (e) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setRenewingCertNodeId(null);
    }
  };

  const handleCopyHomeKitCode = () => {
    if (!homekitStatus.pincode) return;
    navigator.clipboard.writeText(homekitStatus.pincode);
    setCopied(true);
    showToast('تم نسخ رمز PIN الخاص بـ Apple HomeKit بنجاح (202-02-021)!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRenewWindow = async () => {
    setIsRenewing(true);
    try {
      const res = await fetchAuth('/api/integrations/matter/renew', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.matter) setMatterStatus(data.matter);
        showToast('تم تمديد وتنشيط نافذة الإقران بنجاح (جاهز للبث لمدة 15 دقيقة) ⏱️', 'success');
      } else {
        showToast('فشل تمديد نافذة الإقران', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
      setIsRenewing(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
    fetchControllers();
    // Refresh pairing commissioning window when visiting page
    fetchAuth('/api/integrations/matter/renew', { method: 'POST' }).catch(() => {});
  }, []);

  const handleCopyCode = () => {
    if (!matterStatus.manualCode) return;
    navigator.clipboard.writeText(matterStatus.manualCode);
    setCopied(true);
    showToast('تم نسخ رمز الإقران اليدوي بنجاح!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggleMatter = async () => {
    setIsToggling(true);
    const nextState = !matterStatus.enabled;
    try {
      const res = await fetchAuth('/api/integrations/matter/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.matter) setMatterStatus(data.matter);
        showToast(
          nextState 
            ? 'تم تفعيل جسر Apple HomeKit & Matter بنجاح! 🟢' 
            : 'تم إيقاف الخدمة مؤقتاً (لن تقبل أي اتصالات جديدة) 🛑',
          nextState ? 'success' : 'info'
        );
      } else {
        showToast('فشل تغيير حالة الخدمة، يرجى المحاولة لاحقاً', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
      setIsToggling(false);
    }
  };

  const handleResetPairing = async () => {
    if (!confirm('هل تريد فعلاً إعادة ضبط رمز الإقران وتوليد رمز QR جديد؟ ستحتاج لإعادة ربط الخدمة في تطبيق Home.')) {
      return;
    }
    setIsResetting(true);
    try {
      const res = await fetchAuth('/api/integrations/matter/reset', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.matter) setMatterStatus(data.matter);
        showToast('تمت إعادة ضبط رمز الإقران وتوليد QR جديد بنجاح! ✓', 'success');
      } else {
        showToast('فشل إعادة ضبط الرمز', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء إعادة الضبط', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handlePairTuya = async () => {
    if (!tuyaId || !tuyaSecret) {
      alert('الرجاء إدخال Client ID و Client Secret من منصة Tuya IoT');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetchAuth('/api/integrations/tuya/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: tuyaId, clientSecret: tuyaSecret })
      });
      if (res.ok) {
        alert('تم ربط سحابة Tuya ومزامنة أجهزتك بنجاح!');
        fetchIntegrations();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePairHue = async () => {
    if (!hueIp) {
      alert('الرجاء إدخال عنوان IP الخاص بـ Philips Hue Bridge');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetchAuth('/api/integrations/hue/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridgeIp: hueIp })
      });
      if (res.ok) {
        alert('تم ربط Philips Hue Bridge ومزامنة مصابيحك بنجاح!');
        fetchIntegrations();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans" dir="rtl">
      
      {/* ── Toast Notification (Floating Below TopBar) ── */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className={`fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-[10001] px-6 py-3.5 rounded-2xl border shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl flex items-center gap-3.5 text-sm font-bold pointer-events-auto transition-all duration-300 max-w-lg w-[90%] sm:w-auto justify-between ${
              notification.type === 'success'
                ? 'bg-slate-950/95 border-emerald-500/60 text-emerald-100 shadow-emerald-500/20'
                : notification.type === 'info'
                ? 'bg-slate-950/95 border-blue-500/60 text-blue-100 shadow-blue-500/20'
                : 'bg-slate-950/95 border-red-500/60 text-red-100 shadow-red-500/20'
            }`}
          >
            <div className="flex items-center gap-3">
              {notification.type === 'success' && <CheckCircle size={20} className="text-emerald-400 shrink-0" />}
              {notification.type === 'info' && <Info size={20} className="text-blue-400 shrink-0" />}
              {notification.type === 'error' && <AlertCircle size={20} className="text-red-400 shrink-0" />}
              <span className="leading-snug">{notification.msg}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors mr-2 shrink-0 cursor-pointer"
              title="إغلاق"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Header Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-950/70 via-slate-900/90 to-blue-950/70 border border-teal-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-bold mb-3">
              <Globe size={16} className="text-teal-400" />
              <span>جسر التكامل الموحد (Matter 1.3 & Apple HomeKit & Google Home Hub)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              تكاملات Matter و Apple HomeKit و Google
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              تحكم بجميع أجهزة ومفاتيح <strong className="text-teal-300">MOSA</strong> مباشرة من هواتف <strong className="text-white">iPhone, iPad, Apple Watch</strong> أو عبر مساعدات <strong className="text-cyan-300">Siri, Google Assistant, Alexa</strong> محلياً بدون إنترنت وسحابياً عبر Tuya.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
              matterStatus.enabled 
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                : 'bg-red-500/20 border-red-500/40 text-red-300'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${matterStatus.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
              <span>{matterStatus.enabled ? 'الجسر مفعل وجاهز للإقران 🟢' : 'الجسر متوقف ومعطل 🛑'}</span>
            </span>
          </div>
        </div>

        {/* Global Ecosystem Badges */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
            <span className="font-bold text-slate-200">🍎 Apple HomeKit & Siri</span>
            <span className="text-emerald-400 text-[10px] font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">جاهز ومتاح ✅</span>
          </div>
          <div className="p-3 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
            <span className="font-bold text-slate-200">🤖 Google Home</span>
            <span className="text-emerald-400 text-[10px] font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">جاهز ومتاح ✅</span>
          </div>
          <div className="p-3 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
            <span className="font-bold text-slate-200">🗣️ Amazon Alexa</span>
            <span className="text-cyan-300 text-[10px] font-bold bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">جاهز للاقتران</span>
          </div>
          <div className="p-3 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
            <span className="font-bold text-slate-200">⚡ تشغيل محلي (LAN)</span>
            <span className="text-amber-300 text-[10px] font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">بدون إنترنت ⚡</span>
          </div>
        </div>
      </div>

      {/* ── 🟢 2. MASTER CONTROL CARD (مثل فكرة بوت التليجرام) ── */}
      <div className={`p-6 sm:p-7 rounded-3xl border backdrop-blur-xl shadow-2xl transition-all duration-300 ${
        matterStatus.enabled 
          ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-teal-950/40 border-emerald-500/40' 
          : 'bg-gradient-to-r from-red-950/30 via-slate-900/90 to-slate-950/40 border-red-500/30'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                matterStatus.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                <Power size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">تفعيل / إيقاف تكامل Apple HomeKit & Matter</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${matterStatus.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                  <span className={`text-xs font-bold ${matterStatus.enabled ? 'text-emerald-400' : 'text-red-400'}`}>
                    {matterStatus.enabled ? 'الحالة: شغال ومفعل للإقران 🟢 (Active & Ready)' : 'الحالة: متوقف ومعطل 🛑 (Paused / Offline)'}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 pr-13 leading-relaxed">
              {matterStatus.enabled
                ? 'جسر التكامل نشط ويستقبل طلبات الإقران والتحكم عبر Apple HomeKit و Google Home والتحكم الصوتي عبر Siri.'
                : '⚠️ تم إيقاف خدمة Matter و HomeKit مؤقتاً. تم حظر اتصالات الإقران وتجميد الجسر حتى تقوم بتفعيله بنفسك.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:self-center shrink-0">
            {/* Renew Commissioning Window Button */}
            <button
              onClick={handleRenewWindow}
              disabled={isRenewing || !matterStatus.enabled}
              className="px-4 py-2.5 rounded-2xl bg-teal-950/80 hover:bg-teal-900 text-teal-200 hover:text-white border border-teal-500/40 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              title="تمديد وتنشيط بث الإقران لـ 15 دقيقة إضافية"
            >
              <Sparkles size={14} className={isRenewing ? 'animate-spin text-teal-300' : 'text-teal-300'} />
              <span>{isRenewing ? 'جارٍ التنشيط...' : 'تمديد وتنشيط الإقران ⏱️'}</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={handleResetPairing}
              disabled={isResetting}
              className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              title="إعادة ضبط وتهيئة الإقران ومسح الروابط السابقة"
            >
              <RefreshCw size={14} className={isResetting ? 'animate-spin text-teal-400' : 'text-teal-400'} />
              <span>{isResetting ? 'جارٍ الضبط...' : 'إعادة تهيئة الروابط 🔄'}</span>
            </button>

            {/* Toggle Switch Button */}
            <button
              onClick={handleToggleMatter}
              disabled={isToggling}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50 ${
                matterStatus.enabled
                  ? 'bg-red-600/90 hover:bg-red-500 text-white shadow-red-900/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              }`}
            >
              <Power size={15} />
              <span>{isToggling ? 'جارٍ المعالجة...' : matterStatus.enabled ? 'إيقاف مؤقت 🛑' : 'تفعيل وتشغيل 🟢'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 📱 Tab Switcher: HomeKit Direct (No Hub) vs Matter 1.3 vs mTLS Certs ── */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-white/10 w-fit">
        <button
          onClick={() => setActiveTab('homekit')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'homekit'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🍏 Apple HomeKit المباشر (بدون HomePod)</span>
          <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">مباشر ⚡</span>
        </button>

        <button
          onClick={() => setActiveTab('matter')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'matter'
              ? 'bg-gradient-to-r from-teal-600 to-blue-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🌐 جسر Matter 1.3 (Google Home & Hubs)</span>
        </button>

        <button
          onClick={() => setActiveTab('certs')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'certs'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🔐 تجديد شهادات mTLS للـ ESP32</span>
          <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px]">OTA 📡</span>
        </button>
      </div>

      {/* ── 🍏 1. NATIVE APPLE HOMEKIT DIRECT VIEW (NO HUB REQUIRED) ── */}
      {activeTab === 'homekit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: HomeKit QR Code & PIN */}
          <div className="bg-slate-950/85 backdrop-blur-2xl border border-emerald-500/30 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden space-y-5">
            <div className="flex items-center gap-2">
              <QrCode size={20} className="text-emerald-400" />
              <h3 className="font-black text-base text-white">رمز إقران Apple HomeKit المباشر</h3>
            </div>

            <div className="relative p-4 bg-white rounded-3xl shadow-[0_0_40px_rgba(16,185,129,0.3)] border-4 border-emerald-400/50">
              {homekitStatus.qrCodeDataUrl ? (
                <img 
                  src={homekitStatus.qrCodeDataUrl} 
                  alt="Apple HomeKit Direct QR Code" 
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl"
                />
              ) : (
                <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center bg-slate-100 rounded-xl">
                  <RefreshCw size={28} className="animate-spin text-emerald-600" />
                </div>
              )}
            </div>

            {/* Manual PIN Code */}
            <div className="w-full space-y-2">
              <span className="text-[11px] text-slate-400 font-bold block">رمز الـ PIN اليدوي لتطبيق Home:</span>
              <div className="flex items-center justify-between gap-2 p-3 bg-black/60 border border-emerald-500/30 rounded-2xl">
                <span className="font-mono text-base sm:text-lg font-black text-emerald-300 tracking-widest">
                  {homekitStatus.pincode || '202-02-021'}
                </span>
                <button
                  onClick={handleCopyHomeKitCode}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'تم النسخ' : 'نسخ PIN'}</span>
                </button>
              </div>
            </div>

            {/* Direct Protocol Info Card */}
            <div className="text-[10px] text-slate-300 leading-relaxed bg-slate-900/80 p-3.5 rounded-2xl border border-emerald-500/20 w-full text-right space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">نوع البروتوكول:</span>
                <span className="text-emerald-400 font-bold">Apple HAP الأصلي (Native)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">متطلبات الإقران:</span>
                <span className="text-emerald-300 font-bold">هاتف iPhone / iPad فقط (بدون هاب)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">منفذ البث المحلي:</span>
                <span className="font-mono text-cyan-300 font-bold">51826 (TCP)</span>
              </div>
            </div>

            <button
              onClick={handleResetHomeKit}
              disabled={isResettingHomeKit}
              className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} className={isResettingHomeKit ? 'animate-spin text-emerald-400' : 'text-emerald-400'} />
              <span>{isResettingHomeKit ? 'جارٍ إعادة الضبط...' : 'تجديد رمز إقران HomeKit 🔄'}</span>
            </button>
          </div>

          {/* Right 2 Columns: HomeKit Direct Step-by-Step Guide */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-black text-base text-white flex items-center gap-2">
                  <Smartphone size={20} className="text-emerald-400" />
                  <span>خطوات إقران الآيفون المباشر بدون هوم بود (Apple Home)</span>
                </h3>
                <span className="text-[11px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg font-bold">
                  بدون هاب أبل 🚀
                </span>
              </div>

              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-xs text-emerald-200 leading-relaxed">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-emerald-300 block mb-0.5">ميزة التوصيل المباشر (HAP Direct):</strong>
                  هذا الجسر يعمل ببروتوكول HomeKit HAP الأصلي، ويتصل مباشرة بهاتفك الآيفون عبر الشبكة المحلية (LAN) دون الحاجة لشراء جهاز Apple HomePod أو Apple TV 4K.
                </div>
              </div>

              <div className="space-y-3.5">
                {[
                  {
                    step: '1',
                    title: 'افتح تطبيق المنزل (Apple Home 🏠) على الآيفون',
                    desc: 'تأكد من أن هاتفك متصل بنفس شبكة الواي فاي المنزلية المتصل بها سيرفر الراسبيري باي.'
                  },
                  {
                    step: '2',
                    title: 'اضغط على علامة (+) ثم إضافة ملحق (Add Accessory)',
                    desc: 'ستفتح كاميرا الآيفون مباشرة لمسح رمز الإقران.'
                  },
                  {
                    step: '3',
                    title: 'وجّه الكاميرا إلى رمز الـ QR الأخضر',
                    desc: 'وجّه الكاميرا نحو الرمز الظاهر على يسار الشاشة، أو اضغط "خيارات أخرى" وأدخل رمز الـ PIN: 202-02-021.'
                  },
                  {
                    step: '4',
                    title: 'التحكم الفوري ومزامنة الغرف والمفاتيح',
                    desc: 'ستظهر لك لوحة MOSA Smart Bridge وكافة الغرف والمفاتيح على شاشة الآيفون وساعة Apple Watch مع تحكم كامل بصوتك عبر Siri.'
                  }
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-3.5 p-3.5 bg-black/30 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 font-black flex items-center justify-center shrink-0 border border-emerald-500/30 text-xs">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{item.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 🌐 2. MATTER 1.3 VIEW (GOOGLE HOME & APPLE HUBS) ── */}
      {activeTab === 'matter' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: QR Code & Manual Pairing Code */}
          <div className="bg-slate-950/85 backdrop-blur-2xl border border-teal-500/20 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden space-y-5">
            <div className="flex items-center gap-2">
              <QrCode size={20} className="text-teal-400" />
              <h3 className="font-black text-base text-white">رمز إقران Matter 1.3 القياسي</h3>
            </div>

            <div className="relative p-4 bg-white rounded-3xl shadow-[0_0_40px_rgba(20,184,166,0.3)] border-4 border-teal-400/50">
              {matterStatus.qrCodeDataUrl ? (
                <img 
                  src={matterStatus.qrCodeDataUrl} 
                  alt="Matter QR Code" 
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl"
                />
              ) : (
                <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center bg-slate-100 rounded-xl">
                  <RefreshCw size={28} className="animate-spin text-teal-600" />
                </div>
              )}
            </div>

            <div className="w-full space-y-2">
              <span className="text-[11px] text-slate-400 font-bold block">رمز الإقران اليدوي لـ Matter:</span>
              <div className="flex items-center justify-between gap-2 p-3 bg-black/60 border border-teal-500/30 rounded-2xl">
                <span className="font-mono text-base sm:text-lg font-black text-teal-300 tracking-widest">
                  {matterStatus.manualCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'تم النسخ' : 'نسخ الرمز'}</span>
                </button>
              </div>
            </div>

            <div className="text-[10px] text-slate-300 leading-relaxed bg-slate-900/80 p-3 rounded-2xl border border-teal-500/20 w-full text-right space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">العنوان المحلي:</span>
                <span className="font-mono text-teal-300 font-bold">{matterStatus.hostIp || '192.168.1.110'}:5540</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">رمز المعرّف (Discriminator):</span>
                <span className="font-mono text-amber-300 font-bold">D={matterStatus.discriminator || 3840}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-black text-base text-white flex items-center gap-2">
                  <Smartphone size={20} className="text-teal-400" />
                  <span>خطوات إقران Google Home و Amazon Alexa</span>
                </h3>
                <span className="text-[11px] bg-teal-500/15 border border-teal-500/30 text-teal-300 px-2.5 py-1 rounded-lg font-bold">
                  Matter 1.3
                </span>
              </div>

              <div className="space-y-3.5">
                {[
                  {
                    step: '1',
                    title: 'افتح تطبيق Google Home على هاتفك',
                    desc: 'اضغط على علامة (+) ثم "إعداد جهاز" -> "جهاز جديد متوافق مع Matter".'
                  },
                  {
                    step: '2',
                    title: 'امسح رمز QR الخاص بـ Matter',
                    desc: 'وجّه الكاميرا نحو الرمز الظاهر على يسار الشاشة أو اكتب الرمز اليدوي.'
                  },
                  {
                    step: '3',
                    title: 'التحكم الصوتي عبر مساعد Google الصوتي',
                    desc: 'سيتم استيراد كافة المخارج فوراً وتسمية الغرف للتحكم بها عبر Google Nest ومساعد Google.'
                  }
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-3.5 p-3.5 bg-black/30 rounded-2xl border border-white/5 hover:border-teal-500/20 transition-all">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 font-black flex items-center justify-center shrink-0 border border-teal-500/30 text-xs">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{item.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 🔐 3. OTA mTLS CERTIFICATE RENEWAL VIEW ── */}
      {activeTab === 'certs' && (
        <div className="bg-slate-950/85 backdrop-blur-2xl border border-indigo-500/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="flex items-center gap-2.5 text-indigo-400 font-black text-base">
                <ShieldCheck size={22} />
                <span>نظام تجديد شهادات التشفير mTLS هوائياً (OTA PKI Renewal)</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                تتيح لك هذه الميزة تجديد شهادات الأمان والمفاتيح الخاصة لجميع لوحات ESP32 المثبتة في جدران المنزل بضغطة زر لاسلكياً، دون الحاجة لفك اللوحات أو توصيلها بالحاسوب.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-300">قائمة لوحات التحكم الذكية (ESP32 Nodes):</h4>
            {controllers.length === 0 ? (
              <div className="p-8 bg-black/40 rounded-2xl border border-white/5 text-center text-xs text-slate-400">
                لا توجد لوحات مسجلة حالياً، قم بعمل Scan لاكتشاف اللوحات أولاً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {controllers.map((c: any) => (
                  <div key={c.id} className="p-4 bg-slate-900/90 rounded-2xl border border-white/10 hover:border-indigo-500/30 transition flex flex-col justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{c.name || c.id}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          c.status === 'online'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}>
                          {c.status === 'online' ? 'متصل 🟢' : 'غير متصل ⚪'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        MAC: {c.mac || c.id} | IP: {c.ip || '192.168.1.100'}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRenewCert(c.id, c.name || c.id)}
                      disabled={renewingCertNodeId === c.id}
                      className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={renewingCertNodeId === c.id ? 'animate-spin text-indigo-300' : 'text-indigo-300'} />
                      <span>{renewingCertNodeId === c.id ? 'جارٍ إرسال الشهادة...' : 'تجديد شهادة mTLS هوائياً 🔐'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

          {/* ── Global Connectors: Tuya Cloud & Philips Hue ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Tuya Cloud Connector */}
            <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Cloud className="text-amber-400" size={20} />
                  <h4 className="font-bold text-sm text-white">تكامل سحابة Tuya IoT</h4>
                </div>
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-bold">
                  سحابي (Cloud)
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                ربط أجهزة Smart Life و Tuya عبر حساب المطورين من منصة iot.tuya.com لمزامنة السخانات والسبالت.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1">Client ID (Access ID):</label>
                  <input
                    type="text"
                    placeholder="Tuya Client ID"
                    value={tuyaId}
                    onChange={e => setTuyaId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1">Client Secret (Access Secret):</label>
                  <input
                    type="password"
                    placeholder="Tuya Secret"
                    value={tuyaSecret}
                    onChange={e => setTuyaSecret(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <button
                  onClick={handlePairTuya}
                  disabled={isSyncing}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  <Link2 size={14} />
                  <span>{isSyncing ? 'جارٍ المزامنة...' : 'ربط ومزامنة أجهزة Tuya ☁️'}</span>
                </button>
              </div>
            </div>

            {/* Philips Hue Local Bridge */}
            <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Lightbulb className="text-cyan-400" size={20} />
                  <h4 className="font-bold text-sm text-white">تكامل Philips Hue المحلي</h4>
                </div>
                <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 font-bold">
                  محلي (Local LAN)
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                اكتشاف ومزامنة جسر Philips Hue Bridge محلياً للتحكم الفوري بالإضاءة الذكية دون الحاجة للإنترنت.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1">عنوان IP الخاص بـ Hue Bridge:</label>
                  <input
                    type="text"
                    value={hueIp}
                    onChange={e => setHueIp(e.target.value)}
                    placeholder="192.168.1.50"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 text-left font-mono"
                  />
                </div>
                <div className="pt-7">
                  <button
                    onClick={handlePairHue}
                    disabled={isSyncing}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                  <Sparkles size={14} />
                  <span>{isSyncing ? 'جارٍ الاتصال...' : 'اقتران ومزامنة Philips Hue 💡'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
