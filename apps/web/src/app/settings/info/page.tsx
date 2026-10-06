'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { useLanguage } from '@/context/LanguageContext';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  Copy,
  Check,
  Info,
  Cpu,
  Wifi,
  Key,
  Globe,
  Usb,
  Smartphone,
  Code2,
  Radio,
  Terminal,
  ShieldCheck,
  Layers,
  ArrowUpRight,
  Sparkles,
  Zap,
  Activity,
  Server,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function ConnectionInfoPage() {
  const { user, isConnected } = useSmartHomeStore();
  const { t } = useLanguage();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [hostIp, setHostIp] = useState('192.168.1.102');
  const [activeMethod, setActiveMethod] = useState<'web_usb' | 'captive_portal' | 'arduino_ide' | 'ota'>('web_usb');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '') {
        setHostIp(hostname);
      }
    }
  }, []);

  const homeId = user?.homeId || 'a12af95a-042a-48a0-a8de-2211fa3986fe';

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const configVariables = [
    { label: t('connection.title'), value: homeId, name: 'homeId', icon: Key },
    { label: t('connection.mqtt_broker'), value: hostIp, name: 'mqttHost', icon: Server },
    { label: t('connection.port'), value: '1883 (TCP)', name: 'mqttPort', icon: Radio },
    { label: t('connection.username'), value: 'mosa_device', name: 'mqttUser', icon: ShieldCheck },
    { label: t('connection.password'), value: 'mosa_mqtt_secret', name: 'mqttPassword', icon: Key }
  ];

  const methods = [
    {
      id: 'web_usb',
      title: 'الطريقة 1: الربط السريع عبر Web USB',
      badge: 'الأسهل والأسرع ⚡',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: Usb,
      desc: 'حقن إعدادات الواي فاي والسيرفر مباشرة عبر المتصفح دون الحاجة لتعديل أي سطر كود.'
    },
    {
      id: 'captive_portal',
      title: 'الطريقة 2: نقطة البث الذاتية (AP Mode)',
      badge: 'من الهاتف أو اللابتوب 📱',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      icon: Smartphone,
      desc: 'الاتصال بشبكة MosaSmart_Setup وضبط الإعدادات عبر المتصفح (192.168.4.1).'
    },
    {
      id: 'arduino_ide',
      title: 'الطريقة 3: البرمجة المباشرة عبر Arduino IDE',
      badge: 'للمطورين والمبرمجين 💻',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: Code2,
      desc: 'تعديل متغيرات الكود المصدر ورفعه ببرنامج Arduino IDE مع إعدادات الذاكرة المناسبة.'
    },
    {
      id: 'ota',
      title: 'الطريقة 4: التحديث الهوائي اللاسلكي (OTA)',
      badge: 'ترقية لاسلكية 🚀',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      icon: Radio,
      desc: 'ترقية وتطوير فيرموير اللوحات عن بعد عبر الشبكة المحلية دون كابلات.'
    }
  ];

  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 text-right font-sans" dir="rtl">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900/80 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold mb-3">
              <Sparkles size={14} className="animate-spin" />
              دليل ربط ومزامنة وحدات ESP32
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              معلومات ودليل ربط اللوحة بالمنصة
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-2 max-w-2xl leading-relaxed">
              دليلك الشامل لتهيئة وبرمجة لوحات التحكم الذكي <strong className="text-cyan-300">ESP32 / NodeMCU</strong> وربطها محلياً وفورياً بمنصة التحكم الذاتي <strong className="text-white">MOSA Smart Platform</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/settings/matter"
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition-all hover:scale-105"
            >
              <Globe size={16} />
              <span>تكاملات Matter و Alexa و HomeKit</span>
              <ArrowUpRight size={14} />
            </Link>
            <Link
              href="/developer"
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all hover:scale-105"
            >
              <Code2 size={16} />
              <span>أدوات المطورين و API</span>
              <ArrowUpRight size={14} />
            </Link>
            <Link
              href="/settings/pinout"
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105"
            >
              <Cpu size={16} />
              <span>مخطط المنافذ (Pinout)</span>
              <ArrowUpRight size={14} />
            </Link>
            <Link
              href="/flasher"
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
            >
              <Usb size={16} />
              <span>فلاشر الـ USB المباشر</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Grid Layout: Methods & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Interactive Methods */}
        <div className="lg:col-span-2 space-y-6">

          {/* Methods Tabs Selection */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {methods.map((m) => {
              const Icon = m.icon;
              const isActive = activeMethod === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMethod(m.id as any)}
                  className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-3 ${
                    isActive
                      ? 'bg-gradient-to-b from-blue-600/20 to-cyan-600/10 border-cyan-400/60 shadow-lg shadow-blue-600/10 scale-[1.02]'
                      : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={`p-2 rounded-xl border ${isActive ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                      <Icon size={18} />
                    </div>
                    {isActive && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                      {m.title.split(':')[0]}
                    </h3>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{m.badge}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* METHOD 1: WEB USB FLASHER */}
          {activeMethod === 'web_usb' && (
            <GlassCard className="p-6 md:p-8 space-y-6 border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-slate-900/60 to-slate-900/90 shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                    <Usb size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">الطريقة الأولى: الإعداد التلقائي عبر Web USB</h2>
                    <p className="text-xs text-slate-400">الطريقة الأسهل والأسرع بدون الحاجة لفتح أو تعديل الكود</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  موصى به ⚡
                </span>
              </div>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <p>قم بتوصيل لوحة ESP32 بمنفذ الـ USB في حاسوبك باستخدام كابل بيانات (Data Cable).</p>
                </div>

                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <p>
                    انتقل إلى صفحة <Link href="/flasher" className="text-cyan-400 underline font-bold">فلاشر وموجه الأوامر (Web Flasher)</Link> واضغط على زر <strong>"توصيل منفذ USB"</strong> واختر المنفذ المناسب (COM).
                  </p>
                </div>

                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <p>
                    في تبويب <strong>"إعداد الشبكة والسيرفر"</strong>، اضغط على <strong>"فحص الشبكات من اللوحة"</strong> لاختيار شبكتك المنزلية، ثم أدخل كلمة المرور واضغط <strong>"حفظ وإرسال إعدادات الواي فاي"</strong>.
                  </p>
                </div>

                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">4</span>
                  <p>ستقوم اللوحة بحفظ البيانات في الذاكرة الدائمة (NVS) وإعادة التشغيل والاتصال الفوري بالمنصة تلقائياً.</p>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/flasher"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <Zap size={16} />
                  <span>فتح صفحة الفلاشر وحاقن الـ USB الآن</span>
                </Link>
              </div>
            </GlassCard>
          )}

          {/* METHOD 2: CAPTIVE PORTAL */}
          {activeMethod === 'captive_portal' && (
            <GlassCard className="p-6 md:p-8 space-y-6 border-blue-500/30 bg-gradient-to-br from-blue-950/20 via-slate-900/60 to-slate-900/90 shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">الطريقة الثانية: نقطة البث الذاتية (Captive Portal)</h2>
                    <p className="text-xs text-slate-400">مناسبة للإعداد الميداني من الهاتف الذكي أو الأجهزة اللوحية</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  بدون كابلات 📱
                </span>
              </div>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <p>عند تشغيل اللوحة لأول مرة، ستبث شبكة واي فاي خاصة ومفتوحة باسم: <strong className="text-cyan-300 font-mono">MosaSmart_Setup</strong>.</p>
                </div>

                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <p>اتصل بهذه الشبكة من هاتفك، ثم افتح متصفح الإنترنت وتوجه إلى العنوان: <code className="text-amber-300 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">http://192.168.4.1</code>.</p>
                </div>

                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <p>ستظهر لك صفحة إعداد زرقاء أنيقة؛ أدخل اسم شبكة الواي فاي المنزلية، والـ Home ID، وعنوان الـ MQTT Broker، ثم اضغط <strong>"Save &amp; Restart"</strong>.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-blue-500/20 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">عنوان صفحة البوابة الافتراضي:</p>
                  <p className="text-xs text-cyan-400 font-mono mt-0.5">http://192.168.4.1</p>
                </div>
                <button
                  onClick={() => copyToClipboard('http://192.168.4.1', 'portal_ip')}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  {copiedField === 'portal_ip' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedField === 'portal_ip' ? 'تم النسخ' : 'نسخ العنوان'}</span>
                </button>
              </div>
            </GlassCard>
          )}

          {/* METHOD 3: ARDUINO IDE */}
          {activeMethod === 'arduino_ide' && (
            <GlassCard className="p-6 md:p-8 space-y-6 border-purple-500/30 bg-gradient-to-br from-purple-950/20 via-slate-900/60 to-slate-900/90 shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30">
                    <Code2 size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">الطريقة الثالثة: البرمجة المباشرة عبر Arduino IDE</h2>
                    <p className="text-xs text-slate-400">تخصيص الكود ورفعه للوحة من بيئة التطوير</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  للمطورين 💻
                </span>
              </div>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <div>
                    <p className="font-bold text-white mb-1">تثبيت المكتبات المطلوبة:</p>
                    <p className="text-slate-400">في Arduino IDE افتح (Library Manager) وثبت: <code className="text-cyan-300">PubSubClient</code>, <code className="text-cyan-300">ArduinoJson</code>, <code className="text-cyan-300">DHT sensor library</code>, <code className="text-cyan-300">Adafruit SSD1306</code>.</p>
                  </div>
                </div>

                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <div>
                    <p className="font-bold text-white mb-1">مخطط الذاكرة (Partition Scheme):</p>
                    <p className="text-slate-400">من قائمة <strong>Tools -&gt; Partition Scheme</strong> اختر: <strong className="text-emerald-400">"Minimal SPIFFS (1.9MB APP with OTA)"</strong> أو <strong className="text-emerald-400">"Huge APP (3MB)"</strong> لضمان استيعاب الكود بسلاسة.</p>
                  </div>
                </div>

                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <p>افتح ملف <code className="text-purple-300 font-mono">R1_Refactored.ino</code> واستبدل أسطر الإعداد بالقيم الموضحة في المربع أدناه.</p>
                </div>
              </div>

              {/* Code Snippet Box */}
              <div className="relative bg-slate-950/90 rounded-2xl p-4 border border-white/10 font-mono text-xs text-left overflow-hidden" dir="ltr">
                <div className="flex justify-between items-center text-[10px] text-slate-500 border-b border-white/10 pb-2 mb-3">
                  <span>FILE: R1_Refactored.ino</span>
                  <span>CONFIG VARIABLES</span>
                </div>
                <pre className="text-slate-200 overflow-x-auto leading-relaxed font-mono space-y-1">
                  <div><span className="text-blue-400">const char*</span> default_wifi_ssid   = <span className="text-emerald-400">"YOUR_WIFI_SSID"</span>;</div>
                  <div><span className="text-blue-400">const char*</span> default_wifi_pass   = <span className="text-emerald-400">"YOUR_WIFI_PASS"</span>;</div>
                  <div><span className="text-blue-400">const char*</span> default_home_id     = <span className="text-amber-300">"{homeId}"</span>;</div>
                  <div><span className="text-blue-400">const char*</span> default_mqtt_host   = <span className="text-amber-300">"{hostIp}"</span>;</div>
                  <div><span className="text-blue-400">const int</span>   default_mqtt_port   = <span className="text-purple-400">1883</span>; <span className="text-slate-500">// Standard TCP Port</span></div>
                </pre>

                <button 
                  onClick={() => copyToClipboard(`const char* default_wifi_ssid   = "YOUR_WIFI_SSID";\nconst char* default_wifi_pass   = "YOUR_WIFI_PASS";\nconst char* default_home_id     = "${homeId}";\nconst char* default_mqtt_host   = "${hostIp}";\nconst int   default_mqtt_port   = 1883;`, 'code')}
                  className="absolute top-3 right-3 p-2 rounded-xl bg-purple-600/30 hover:bg-purple-600 border border-purple-400/40 text-purple-200 hover:text-white transition-all flex items-center gap-1.5 text-xs font-sans shadow-lg"
                >
                  {copiedField === 'code' ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span>تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>نسخ الكود</span>
                    </>
                  )}
                </button>
              </div>
            </GlassCard>
          )}

          {/* METHOD 4: OTA WIRELESS UPDATE */}
          {activeMethod === 'ota' && (
            <GlassCard className="p-6 md:p-8 space-y-6 border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-slate-900/60 to-slate-900/90 shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
                    <Radio size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">الطريقة الرابعة: التحديث الهوائي اللاسلكي (OTA)</h2>
                    <p className="text-xs text-slate-400">تحديث وتطوير فيرموير اللوحة لاسلكياً دون الحاجة لكابلات</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Over-The-Air 🚀
                </span>
              </div>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <p>في Arduino IDE، بعد كتابة تعديلاتك، اختر من القائمة: <strong>Sketch -&gt; Export Compiled Binary</strong> لإنشاء ملف الـ <code className="text-cyan-300 font-mono">.bin</code> المترجم.</p>
                </div>

                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <p>افتح متصفحك وتوجه لصفحة تحديث اللوحة مباشرة: <code className="text-amber-300 font-mono">http://[IP-Address]/update</code> أو افتح صفحة <Link href="/ota" className="text-cyan-400 underline font-bold">مدير الـ OTA</Link>.</p>
                </div>

                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="w-6 h-6 rounded-xl bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <p>اختر ملف الـ <code className="text-cyan-300 font-mono">.bin</code> واضغط <strong>Upload &amp; Update</strong>؛ ستتم الترقية ويعاد التشغيل خلال 5 ثوانٍ.</p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Hardware Pinout Reference */}
          <GlassCard className="p-6 md:p-8 space-y-5">
            <h2 className="text-base font-black text-white flex items-center gap-2.5">
              <Layers className="text-blue-400" size={20} />
              <span>خريطة ومخطط الأطراف القياسية (Standard Hardware Pinout)</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2.5 px-3">الطرف (GPIO)</th>
                    <th className="py-2.5 px-3">الوظيفة الافتراضية</th>
                    <th className="py-2.5 px-3">مفتاح جداري (Switch InPin)</th>
                    <th className="py-2.5 px-3">الحالة والملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 font-mono">
                  <tr>
                    <td className="py-2 px-3 text-cyan-300 font-bold">GPIO 2</td>
                    <td className="py-2 px-3 font-sans">ريليه مخرج 1 (Relay 1)</td>
                    <td className="py-2 px-3 text-amber-300">GPIO 13 / 34</td>
                    <td className="py-2 px-3 font-sans text-slate-400">مدمج مع الليد الأزرق</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-300 font-bold">GPIO 4</td>
                    <td className="py-2 px-3 font-sans">ريليه مخرج 2 (Relay 2)</td>
                    <td className="py-2 px-3 text-amber-300">GPIO 14 / 35</td>
                    <td className="py-2 px-3 font-sans text-slate-400">مخرج قياسي آمن</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-300 font-bold">GPIO 5</td>
                    <td className="py-2 px-3 font-sans">ريليه مخرج 3 (Relay 3)</td>
                    <td className="py-2 px-3 text-amber-300">GPIO 27 / 36</td>
                    <td className="py-2 px-3 font-sans text-slate-400">مخرج قياسي آمن</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-300 font-bold">GPIO 18</td>
                    <td className="py-2 px-3 font-sans">ريليه مخرج 4 (Relay 4)</td>
                    <td className="py-2 px-3 text-amber-300">GPIO 26 / 39</td>
                    <td className="py-2 px-3 font-sans text-slate-400">مخرج قياسي آمن</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-300 font-bold">GPIO 16</td>
                    <td className="py-2 px-3 font-sans">مستشعر DHT11 / DHT22</td>
                    <td className="py-2 px-3 text-slate-500">-</td>
                    <td className="py-2 px-3 font-sans text-slate-400">قراءة الحرارة والرطوبة تلقائياً</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-300 font-bold">GPIO 21, 22</td>
                    <td className="py-2 px-3 font-sans">شاشة OLED (I2C SDA / SCL)</td>
                    <td className="py-2 px-3 text-slate-500">-</td>
                    <td className="py-2 px-3 font-sans text-slate-400">عرض الـ IP وحالة المخارج</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Serial & MQTT CLI Command Reference */}
          <GlassCard className="p-6 md:p-8 space-y-4">
            <h2 className="text-base font-black text-white flex items-center gap-2.5">
              <Terminal className="text-emerald-400" size={20} />
              <span>دليل أوامر موجه الـ CLI و الـ MQTT المباشرة</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <p className="font-mono text-cyan-300 font-bold">STATUS</p>
                <p className="text-slate-400 text-[11px] mt-0.5">استعلام تقرير حالة اللوحة والواي فاي والذاكرة.</p>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <p className="font-mono text-cyan-300 font-bold">SCAN</p>
                <p className="text-slate-400 text-[11px] mt-0.5">فحص شبكات الواي فاي المحيطة وإرجاعها كـ JSON.</p>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <p className="font-mono text-cyan-300 font-bold">TEST</p>
                <p className="text-slate-400 text-[11px] mt-0.5">تشغيل فحص الهاردوير الذاتي وتجربة الريليهات.</p>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <p className="font-mono text-cyan-300 font-bold">GPIO:18,TOGGLE</p>
                <p className="text-slate-400 text-[11px] mt-0.5">تبديل حالة أي طرف GPIO مباشرة (ON / OFF / TOGGLE).</p>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <p className="font-mono text-cyan-300 font-bold">REBOOT</p>
                <p className="text-slate-400 text-[11px] mt-0.5">إعادة تشغيل المتحكم فورياً.</p>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <p className="font-mono text-cyan-300 font-bold">RESET</p>
                <p className="text-slate-400 text-[11px] mt-0.5">مسح ذاكرة NVS وإعادة اللوحة لضبط المصنع.</p>
              </div>
            </div>
          </GlassCard>

        </div>

        {/* Right Col: Live Sync Data Panel */}
        <div className="space-y-6">
          <GlassCard className="p-6 space-y-6 sticky top-24 border-cyan-500/20 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Activity className="text-cyan-400" size={18} />
                <span>بيانات المزامنة الحالية</span>
              </h2>
              <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                سيرفر محلي نشط
              </span>
            </div>

            <div className="space-y-3.5">
              {configVariables.map((v) => {
                const Icon = v.icon;
                const isCopied = copiedField === v.name;
                return (
                  <div key={v.name} className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <Icon size={12} className="text-slate-400" />
                      <span>{v.label}</span>
                    </label>
                    <div className="relative flex items-center bg-slate-950/80 border border-white/10 rounded-2xl px-3 py-2 text-xs font-mono text-cyan-300 group hover:border-cyan-500/40 transition">
                      <span className="truncate pr-1 pl-8 text-left w-full" dir="ltr">{v.value}</span>
                      <button
                        onClick={() => copyToClipboard(v.value, v.name)}
                        className="absolute left-2 p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"
                        title="نسخ"
                      >
                        {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <Link
                href="/flasher"
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition"
              >
                <Usb size={14} />
                <span>فتح صفحة الـ Flasher</span>
              </Link>
              <Link
                href="/devices"
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-white/10 transition"
              >
                <Sliders size={14} />
                <span>لوحة تحكم الأجهزة والمفاتيح</span>
              </Link>
            </div>
          </GlassCard>
        </div>

      </div>
    </main>
  );
}
