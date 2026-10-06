'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Home, ArrowLeft, ArrowRight, CheckCircle2, Cpu, Grid, Play, Smartphone, Wifi, Terminal, Eye, EyeOff } from 'lucide-react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    username: 'admin',
    pinCode: '',
    homeName: 'منزلي الذكي'
  });
  const [confirmPinCode, setConfirmPinCode] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  
  // Rooms selection state
  const [selectedRooms, setSelectedRooms] = useState<string[]>([
    'الصالة', 'غرفة النوم الرئيسية', 'المطبخ'
  ]);
  
  const availableRooms = [
    'الصالة', 'غرفة النوم الرئيسية', 'غرفة الأطفال', 'المطبخ', 'الحديقة', 'الممر الرئيسي', 'المجلس'
  ];

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bootLogs, setBootLogs] = useState<string[]>([]);

  useEffect(() => {
    // Check if already initialized
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => {
        if (data.isInitialized) {
          router.push('/auth/login');
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  const toggleRoom = (room: string) => {
    if (selectedRooms.includes(room)) {
      setSelectedRooms(selectedRooms.filter(r => r !== room));
    } else {
      setSelectedRooms([...selectedRooms, room]);
    }
  };

  // Run the installation simulation
  const runBootloader = async () => {
    setSubmitting(true);
    setError('');
    const logs = [
      '⏳ تفريغ حزم نظام التشغيل MOSA OS...',
      '🛠️ إنشاء قاعدة البيانات وجداول العلاقات...',
      '⚙️ إعداد قنوات بث الـ MQTT local bridge...',
      '🛰️ فحص بروتوكول mDNS للبحث التلقائي...',
      '🏠 تهيئة الغرف الأولى ومفتاح الترخيص المجاني...',
      '👤 ربط حساب المدير الأول وتوقيع حزم الحماية...',
      '🚀 تم التمهيد بنجاح! جاري الدخول للوحة التحكم...'
    ];

    for (let i = 0; i < logs.length; i++) {
      await new Promise(r => setTimeout(r, 600));
      setBootLogs(prev => [...prev, logs[i]]);
    }

    try {
      // Helper for safe JSON fetching
      const safeFetchJson = async (url: string, options: RequestInit) => {
        const res = await fetch(url, options);
        const ct = res.headers.get('content-type') || '';
        let data: any = {};
        if (ct.includes('application/json')) {
          data = await res.json();
        } else {
          const txt = await res.text();
          if (!res.ok) throw new Error(`خطأ في الاستجابة (${res.status})`);
        }
        if (!res.ok) throw new Error(data.error || data.message || 'فشلت الطلب');
        return data;
      };

      // 1. Init System
      await safeFetchJson('/api/setup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      // 2. Login immediately to get cookies
      const loginData = await safeFetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, pinCode: formData.pinCode })
      });
      
      if (loginData.accessToken) {
        localStorage.setItem('token', loginData.accessToken);
        localStorage.setItem('mosa_ui_mode', 'full');
        document.cookie = `token=${loginData.accessToken}; path=/; max-age=${100 * 365 * 24 * 60 * 60}; SameSite=Lax`;
        if (loginData.user) {
          useSmartHomeStore.getState().setUser(loginData.user);
        }
        useSmartHomeStore.getState().setUiMode('full');
        useSmartHomeStore.getState().initBackendConnection();
        
        // 3. Trigger setup wizard rooms setup
        try {
          await safeFetchJson('/api/setup/wizard', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${loginData.accessToken}`
            },
            body: JSON.stringify({
              homeName: formData.homeName,
              rooms: selectedRooms
            })
          });
        } catch (e) {}

        window.location.href = '/';
      } else {
        window.location.href = '/auth/login';
      }
    } catch (err: any) {
      setError(err.message || 'فشلت عملية تهيئة النظام');
      setSubmitting(false);
      setBootLogs([]);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#090B10] flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      
      {/* Decorative radial glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none z-0" />

      <AnimatePresence mode="wait">
        
        {/* Step 1: Unboxing / Welcome */}
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-xl w-full bg-[#0C1222]/95 border border-white/10 rounded-[3rem] p-10 backdrop-blur-2xl shadow-2xl text-center space-y-8 relative z-10"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 mb-2">
              <Smartphone className="w-10 h-10 text-blue-400 animate-bounce" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-black text-white">مرحباً بك في MOSA Smart Hub!</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                تهانينا على تشغيل المنصة لأول مرة! تماماً كالهاتف الجديد الذي تخرجه من صندوقه، سنساعدك على إعداد منزلك الذكي وتثبيت الحماية الأولية بخطوات بسيطة وممتعة.
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 p-5 rounded-2xl text-right text-xs space-y-2.5 text-slate-300">
              <p className="font-bold text-white mb-2 flex items-center gap-2">
                <Wifi size={14} className="text-blue-400" />
                الميزات المتوفرة بجهازك الذكي:
              </p>
              <p>• مراقبة حية للتيار الكهربائي واستهلاك الطاقة لتوفير الفواتير.</p>
              <p>• مساعد ذكاء اصطناعي صوتي ونظام أمان متطور للتحذير من الحركة.</p>
              <p>• تحديث هوائي وتلقائي لكافة لوحات ESP32 دون فكها.</p>
            </div>

            <button 
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              ابدأ التشغيل والإعداد
              <ArrowRight size={18} />
            </button>
          </motion.div>
        )}

        {/* Step 2: Credentials */}
        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="max-w-md w-full bg-[#0C1222]/95 border border-white/10 rounded-[3rem] p-8 backdrop-blur-2xl shadow-2xl space-y-6 relative z-10"
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-3">
                <ShieldCheck className="w-7 h-7 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white">الملف الشخصي للمسؤول</h2>
              <p className="text-slate-400 text-xs mt-1">أنشئ حساب المدير الرئيسي لتأمين نظام المنزل ومنع التطفل</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs text-center font-bold">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1.5">اسمك الكامل</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: موسى الكاظم"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1.5">اسم المستخدم (للدخول)</label>
                <input 
                  type="text" 
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  placeholder="admin"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1.5">الرمز السري (PIN Code)</label>
                <div className="relative">
                  <input 
                    type={showPin ? "text" : "password"} 
                    value={formData.pinCode}
                    onChange={e => setFormData({ ...formData, pinCode: e.target.value })}
                    placeholder="••••"
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 pr-10 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono tracking-widest"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1.5">تأكيد الرمز السري (Confirm PIN)</label>
                <div className="relative">
                  <input 
                    type={showConfirmPin ? "text" : "password"} 
                    value={confirmPinCode}
                    onChange={e => setConfirmPinCode(e.target.value)}
                    placeholder="••••"
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 pr-10 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono tracking-widest"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showConfirmPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {confirmPinCode.length > 0 && formData.pinCode.length > 0 && (
                  <p className={`text-[10px] mt-1.5 font-bold flex items-center gap-1 ${
                    formData.pinCode === confirmPinCode ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {formData.pinCode === confirmPinCode ? (
                      <>
                        <CheckCircle2 size={12} />
                        الرمزان متطابقان تماماً ✓
                      </>
                    ) : (
                      'الرمز السري وتأكيد الرمز غير متطابقين ⚠️'
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button 
                onClick={() => setStep(1)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={16} />
                السابق
              </button>
              <button 
                onClick={() => {
                  if (!formData.name.trim() || !formData.username.trim() || !formData.pinCode.trim() || !confirmPinCode.trim()) {
                    setError('يرجى ملء كافة الخانات المطلوبة بما فيها تأكيد الرمز!');
                    return;
                  }
                  if (formData.pinCode.length < 4) {
                    setError('يجب أن يتكون الرمز السري من 4 أرقام على الأقل لتأمين الحساب');
                    return;
                  }
                  if (formData.pinCode !== confirmPinCode) {
                    setError('الرمز السري وتأكيد الرمز غير متطابقين، يرجى التأكد من كتابتهما بالمثل!');
                    return;
                  }
                  setError('');
                  setStep(3);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                التالي
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Home & Room Configurations */}
        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="max-w-md w-full bg-[#0C1222]/95 border border-white/10 rounded-[3rem] p-8 backdrop-blur-2xl shadow-2xl space-y-6 relative z-10"
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-3">
                <Home className="w-7 h-7 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white">إعدادات المنزل والغرف</h2>
              <p className="text-slate-400 text-xs mt-1">تحديد اسم منزلك والغرف الأساسية لتوزيع الأجهزة عليها</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1.5">اسم منزلك الذكي</label>
                <input 
                  type="text" 
                  value={formData.homeName}
                  onChange={e => setFormData({ ...formData, homeName: e.target.value })}
                  placeholder="منزلي الذكي"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-bold mb-2">اختر الغرف المتوفرة حالياً</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableRooms.map(room => {
                    const isSelected = selectedRooms.includes(room);
                    return (
                      <button
                        key={room}
                        type="button"
                        onClick={() => toggleRoom(room)}
                        className={`p-2.5 rounded-xl border text-[11px] font-bold text-right flex items-center gap-2 transition-all ${
                          isSelected 
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300' 
                            : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        <Grid size={14} className={isSelected ? 'text-blue-400' : 'text-slate-500'} />
                        {room}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button 
                onClick={() => setStep(2)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={16} />
                السابق
              </button>
              <button 
                onClick={() => {
                  if (selectedRooms.length === 0) {
                    alert('يرجى تحديد غرفة واحدة على الأقل لتأسيس المنزل!');
                    return;
                  }
                  setStep(4);
                  runBootloader();
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                تشغيل النظام الأول
                <Play size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Installation Terminals */}
        {step === 4 && (
          <motion.div 
            key="step4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg w-full bg-[#0C1222]/95 border border-white/10 rounded-[3rem] p-8 backdrop-blur-2xl shadow-2xl space-y-6 relative z-10"
          >
            <div className="text-center">
              <Cpu className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-3" />
              <h2 className="text-xl font-bold text-white">جاري إقلاع وتأسيس المخدم (First Boot)</h2>
              <p className="text-slate-400 text-xs mt-1">يتم الآن تهيئة الملفات وتشغيل خدمات الأطراف الذكية في الخلفية...</p>
            </div>

            {/* Terminal Console logs */}
            <div className="bg-[#05070a] border border-white/5 rounded-2xl p-5 h-56 font-mono text-xs text-[#00f0ff] space-y-2 overflow-y-auto custom-scrollbar flex flex-col justify-end">
              {bootLogs.map((log, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Terminal size={12} className="text-slate-500" />
                  <span>{log}</span>
                </div>
              ))}
            </div>

            <div className="text-center text-[10px] text-slate-500">
              * يرجى عدم إطفاء الجهاز أو إغلاق هذه الصفحة لتجنب تضارب التخزين.
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
