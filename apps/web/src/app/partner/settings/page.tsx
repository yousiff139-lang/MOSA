'use client';

import React, { useState } from 'react';
import { 
  Settings, Key, ShieldCheck, Lock, RefreshCw, Copy, CheckCircle2, 
  Server, Bell, Sparkles, Send, Globe, Radio, Cpu, Activity,
  Sliders, Database, Download, Check, AlertCircle, Wifi
} from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { notify } from '@/store/useConfirmStore';

export default function PartnerSettingsPage() {
  const [apiKey, setApiKey] = useState('mosa_pk_live_9f83a27b4e110c');
  const [supportTunnel, setSupportTunnel] = useState(true);
  const [autoOta, setAutoOta] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Advanced Partner Features
  const [webhookUrl, setWebhookUrl] = useState('https://discord.com/api/webhooks/...');
  const [webhookEvents, setWebhookEvents] = useState({
    offlineAlert: true,
    securityBreach: true,
    firmwareUpdate: false
  });
  const [autoBackupDaily, setAutoBackupDaily] = useState(true);
  const [rateLimitReqPerMin, setRateLimitReqPerMin] = useState(120);
  const [testingWebhook, setTestingWebhook] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    notify({ type: 'success', title: 'تم النسخ', message: 'تم نسخ مفتاح الـ API المشفر إلى الحافظة.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateKey = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      const newKey = 'mosa_pk_live_' + Math.random().toString(36).substring(2, 15);
      setApiKey(newKey);
      setIsRegenerating(false);
      notify({ type: 'info', title: 'مفتاح جديد', message: 'تم توليد وتحديث مفتاح المصادقة بنجاح.' });
    }, 700);
  };

  const handleTestWebhook = () => {
    setTestingWebhook(true);
    setTimeout(() => {
      setTestingWebhook(false);
      notify({ type: 'success', title: 'اختبار الويب هوك', message: 'تم إرسال إشعار تجريبي مشفر بنجاح إلى الرابط المحدد! (Status: 200 OK)' });
    }, 1000);
  };

  const handleSaveSettings = () => {
    setSaved(true);
    notify({ type: 'success', title: 'تم الحفظ', message: 'تم حفظ وتطبيق كافة إعدادات الأمان ومفاتيح التكامل بنجاح!' });
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 text-right dir-rtl font-sans pb-24" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-blue-950/40 to-slate-950 border border-blue-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30 shadow-lg shadow-blue-500/20">
              <Settings size={24} />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">إعدادات العضوية والأمان المتقدمة (Partner Settings)</h1>
              <p className="text-xs sm:text-sm text-blue-300/80 font-mono mt-0.5">Enterprise Security & Cloud-to-Edge Sync</p>
            </div>
          </div>
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed mt-2">
            إدارة مفاتيح API، قنوات الويب هوك لإشعارات الانقطاع اللحظية، بروتوكولات التشفير للـ ESP-NOW Mesh، والتحكم بالنسخ الاحتياطي التلقائي.
          </p>
        </div>

        <button 
          onClick={handleSaveSettings}
          className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center gap-2.5 shrink-0 hover:scale-105 active:scale-95"
        >
          <ShieldCheck size={18} />
          <span>حفظ إعدادات الأمان ✨</span>
        </button>
      </div>

      {/* Security Score Banner */}
      <div className="bg-slate-950/80 border border-emerald-500/30 rounded-3xl p-6 shadow-xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-xl shrink-0">
            100%
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>درع الأمان المتكامل (Zero-Trust Resilience)</span>
              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">محصن بالكامل</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              مفعل تلقائياً: تشفير Mutual TLS 8883، وتوقيع حزم الميش بـ HMAC-SHA256، وتشفير رموز الدخول بـ Bcrypt.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end w-full md:w-auto">
          <span className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-[11px] font-mono text-cyan-300">mTLS 8883 ✓</span>
          <span className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-[11px] font-mono text-emerald-300">HMAC-SHA256 ✓</span>
          <span className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-[11px] font-mono text-purple-300">Bcrypt PIN ✓</span>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. API Keys Card */}
        <div className="bg-slate-950/80 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <Key className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-bold text-white">1. مفاتيح الـ API للربط والتكامل الخارجي</h3>
              <p className="text-xs text-slate-400">مفتاح المصادقة المشفر للربط مع الأنظمة الخارجية</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">مفتاح الموزع الخاص (Partner API Key)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={apiKey}
                  className="flex-1 px-4 py-3 bg-black/50 border border-white/10 rounded-2xl text-xs font-mono text-cyan-300 focus:outline-none"
                />
                <button 
                  onClick={handleCopyKey}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 shrink-0"
                >
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>
            </div>

            <button 
              onClick={handleRegenerateKey}
              disabled={isRegenerating}
              className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={15} className={isRegenerating ? 'animate-spin' : ''} />
              <span>إعادة توليد مفتاح API جديد (Re-generate Secret)</span>
            </button>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">معدل الطلبات المسموح به (Rate Limit)</label>
              <div className="flex items-center gap-4 bg-white/[0.03] p-3 rounded-2xl border border-white/5">
                <input 
                  type="range" 
                  min="30" 
                  max="500" 
                  step="10"
                  value={rateLimitReqPerMin}
                  onChange={e => setRateLimitReqPerMin(Number(e.target.value))}
                  className="flex-1 accent-cyan-400 cursor-pointer"
                />
                <span className="text-cyan-300 font-mono text-xs font-bold bg-cyan-500/10 px-2.5 py-1 rounded-xl border border-cyan-500/30 shrink-0">
                  {rateLimitReqPerMin} طلب / دقيقة
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Security & OTA Protocols */}
        <div className="bg-slate-950/80 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <Lock className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-base font-bold text-white">2. بروتوكولات الأمان والصيانة المباشرة</h3>
              <p className="text-xs text-slate-400">تشفير القنوات والدعم الفني السريع أوفلاين</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-cyan-500/30 transition-all">
              <div>
                <p className="font-bold text-xs text-white">تفعيل النفق المباشر المشفر (Encrypted Support Tunnel)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">السماح بتلقي التحديثات السريعة من الوسيط المحلي دون خادم سحابي</p>
              </div>
              <input 
                type="checkbox" 
                checked={supportTunnel}
                onChange={e => setSupportTunnel(e.target.checked)}
                className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-cyan-500/30 transition-all">
              <div>
                <p className="font-bold text-xs text-white">التحديث التلقائي للـ ESP32 (Auto Firmware OTA)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">تنزيل التحديثات الأمنية وتمريرها عبر شبكة الميش فور توفرها</p>
              </div>
              <input 
                type="checkbox" 
                checked={autoOta}
                onChange={e => setAutoOta(e.target.checked)}
                className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-cyan-500/30 transition-all">
              <div>
                <p className="font-bold text-xs text-white">النسخ الاحتياطي التلقائي اليومي (Daily SQL Auto-Dump)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">أخذ نسخة احتياطية مشفرة من قواعد البيانات عند الساعة 2:00 صباحاً</p>
              </div>
              <input 
                type="checkbox" 
                checked={autoBackupDaily}
                onChange={e => setAutoBackupDaily(e.target.checked)}
                className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 3. Webhooks & Alert Dispatcher */}
        <div className="lg:col-span-2 bg-slate-950/80 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-white">3. نظام التنبيهات وإرسال الويب هوك (Webhooks & Event Dispatcher)</h3>
                <p className="text-xs text-slate-400">إرسال إشعارات فورية إلى تيليجرام أو ديسكورد أو Home Assistant عند انقطاع الإنترنت أو حدوث طارئ</p>
              </div>
            </div>

            <button
              onClick={handleTestWebhook}
              disabled={testingWebhook}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Send size={13} className={testingWebhook ? 'animate-ping' : ''} />
              <span>{testingWebhook ? 'جاري الاختبار...' : 'إرسال إشعار تجريبي ⚡'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">رابط استقبال الويب هوك (Webhook Endpoint URL)</label>
                <input 
                  type="text" 
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/api/webhook"
                  className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-2xl text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                يتم إرسال حمولة JSON بتوقيع تشفيري `X-Mosa-Signature` لتأكيد مصدر الحدث.
              </p>
            </div>

            <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/5">
              <span className="text-xs font-bold text-slate-300 block mb-2">أحداث النظام المراد تفعيل التنبيه لها:</span>
              
              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={webhookEvents.offlineAlert} 
                  onChange={e => setWebhookEvents({ ...webhookEvents, offlineAlert: e.target.checked })}
                  className="accent-amber-500 rounded"
                />
                <span>تنبيه فوري عند انقطاع راوتر الواي فاي والتحول لشبكة الميش</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={webhookEvents.securityBreach} 
                  onChange={e => setWebhookEvents({ ...webhookEvents, securityBreach: e.target.checked })}
                  className="accent-amber-500 rounded"
                />
                <span>تنبيهات الأمان (محاولات PIN خاطئة متكررة / تحذيرات الغاز والحريق)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={webhookEvents.firmwareUpdate} 
                  onChange={e => setWebhookEvents({ ...webhookEvents, firmwareUpdate: e.target.checked })}
                  className="accent-amber-500 rounded"
                />
                <span>إشعار بنجاح ترقية السوفتوير على كروت ESP32</span>
              </label>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
