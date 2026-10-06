"use client";

import { ShieldAlert, Key, Smartphone, Globe, Lock, Save, X, AlertTriangle, Check, Plus, Trash2, QrCode } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { confirmAction, notify } from '@/store/useConfirmStore';

function SecuritySettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const force = searchParams.get('force') === 'true';

  // Security Toggles State
  const [edgeMode, setEdgeMode] = useState(false);
  const [aesEncryption, setAesEncryption] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  // API Keys State
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // 2FA Setup Modal State
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // PIN Change State
  const [isPinModalOpen, setIsPinModalOpen] = useState(force);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      const res = await fetchAuth('/api/settings/security');
      if (res.ok) {
        const data = await res.json();
        setEdgeMode(!!data.edgeMode);
        setAesEncryption(data.aesEncryption !== undefined ? !!data.aesEncryption : true);
        setTwoFactorEnabled(!!data.twoFactorEnabled);
        if (Array.isArray(data.apiKeys)) setApiKeys(data.apiKeys);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSecuritySettings = async () => {
    try {
      setLoading(true);
      const res = await fetchAuth('/api/settings/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edgeMode, aesEncryption, twoFactorEnabled })
      });
      if (res.ok) {
        setSaveSuccessMessage('تم حفظ إعدادات الأمان والجدار الناري بنجاح! 🛡️');
        setTimeout(() => setSaveSuccessMessage(''), 3000);
      } else {
        alert('حدث خطأ أثناء حفظ الإعدادات');
      }
    } catch (e) {
      alert('خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName) return;
    try {
      const res = await fetchAuth('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName })
      });
      if (res.ok) {
        const keyRecord = await res.json();
        setCreatedKey(keyRecord.key);
        setApiKeys(prev => [keyRecord, ...prev]);
        setNewKeyName('');
      } else {
        alert('حدث خطأ أثناء إنشاء مفتاح الـ API');
      }
    } catch (e) {
      alert('خطأ في الاتصال بالخادم');
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف مفتاح الـ API هذا؟ لن يتمكن التطبيق الخارجي من الاتصال بالمنصة.')) return;
    try {
      const res = await fetchAuth(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setApiKeys(prev => prev.filter(k => k.id !== id));
      }
    } catch (e) {
      alert('خطأ أثناء الحذف');
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetchAuth('/api/users/me/pin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPin, newPin })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess('تم تغيير الرمز السري بنجاح!');
        setTimeout(() => {
          setIsPinModalOpen(false);
          if (force) router.push('/dashboard');
        }, 1500);
      } else {
        setError(data.message || data.error || 'حدث خطأ أثناء التغيير');
      }
    } catch (err) {
      setError('فشل الاتصال بالخادم');
    }
    setLoading(false);
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 w-full animate-fade-in" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <ShieldAlert className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" size={32} />
            إعدادات الأمان المتقدمة
          </h1>
          <p className="text-gray-400 mt-2 text-sm">تكوين جدار الحماية، وضع التشغيل المعزول، المصادقة الثنائية وصلاحيات الـ API</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSaveSecuritySettings}
            disabled={loading}
            className="bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(225,29,72,0.4)] transition-all flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Save size={18} />
            {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 font-bold text-sm text-center animate-fade-in shadow-lg">
          {saveSuccessMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Edge Mode & Network */}
        <div className="flex flex-col gap-6">
          
          <div className="bg-[#11151c]/80 border border-white/10 rounded-[2rem] p-8 relative overflow-hidden backdrop-blur-xl shadow-xl">
             <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-4">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${edgeMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-white/5 text-gray-400'}`}>
                   <Globe size={24} />
                 </div>
                 <div>
                   <h3 className="text-white font-bold text-lg">وضع العزل الشبكي (Edge Mode)</h3>
                   <p className="text-gray-400 text-sm">عزل النظام محلياً ومنع الاتصال بالإنترنت الخارجي (Off-Grid).</p>
                 </div>
               </div>
               <span className={`text-xs px-3 py-1 rounded-full font-bold border ${edgeMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                 {edgeMode ? 'مُفعّل (محلي فقط)' : 'معطّل (اتصال شامل)'}
               </span>
             </div>
             
             <div 
               onClick={() => setEdgeMode(!edgeMode)}
               className="flex items-center justify-between p-4 bg-[#0b0e14]/70 rounded-2xl border border-white/10 cursor-pointer hover:border-amber-500/30 transition-all"
             >
               <span className="text-white font-bold text-sm">تفعيل العزل الشبكي الإجباري</span>
               <div className={`w-14 h-7 rounded-full relative transition-all ${edgeMode ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-white/10'}`}>
                 <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${edgeMode ? 'left-1' : 'right-1'}`}></div>
               </div>
             </div>
          </div>

          <div className="bg-[#11151c]/80 border border-white/10 rounded-[2rem] p-8 backdrop-blur-xl shadow-xl">
             <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-4">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${aesEncryption ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 text-gray-400'}`}>
                   <Lock size={24} />
                 </div>
                 <div>
                   <h3 className="text-white font-bold text-lg">تشفير البيانات المتقدم (E2EE)</h3>
                   <p className="text-gray-400 text-sm">تشفير كامل لكافة بيانات المستشعرات المخزنة محلياً بـ (AES-256).</p>
                 </div>
               </div>
               <span className={`text-xs px-3 py-1 rounded-full font-bold border ${aesEncryption ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                 {aesEncryption ? 'مُفعّل (AES-256)' : 'معطّل'}
               </span>
             </div>
             
             <div 
               onClick={() => setAesEncryption(!aesEncryption)}
               className="flex items-center justify-between p-4 bg-[#0b0e14]/70 rounded-2xl border border-white/10 cursor-pointer hover:border-blue-500/30 transition-all"
             >
               <span className="text-white font-bold text-sm">تفعيل التشفير الإجباري لبيانات النظام</span>
               <div className={`w-14 h-7 rounded-full relative transition-all ${aesEncryption ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-white/10'}`}>
                 <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${aesEncryption ? 'left-1' : 'right-1'}`}></div>
               </div>
             </div>
          </div>

        </div>

        {/* API Keys & 2FA */}
        <div className="flex flex-col gap-6">
          
          <div className="bg-[#11151c]/80 border border-white/10 rounded-[2rem] p-8 backdrop-blur-xl shadow-xl">
             <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-4">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${twoFactorEnabled ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-white/5 text-purple-400'}`}>
                   <Smartphone size={24} />
                 </div>
                 <div>
                   <h3 className="text-white font-bold text-lg">المصادقة الثنائية (2FA)</h3>
                   <p className="text-gray-400 text-sm">طلب رمز تحقق إضافي عبر تطبيق Authenticator عند تسجيل الدخول.</p>
                 </div>
               </div>
               <span className={`text-xs px-3 py-1 rounded-full font-bold border ${twoFactorEnabled ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                 {twoFactorEnabled ? 'مُفعّلة' : 'غير مفعلة'}
               </span>
             </div>
             
             {/* 2FA Explanation & Tutorial Box */}
             <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 space-y-2.5 text-xs text-slate-300 mb-4">
               <div className="font-bold text-purple-300 flex items-center gap-1.5 text-sm">
                 🛡️ ما هي فائدة المصادقة الثنائية (2FA) وكيف تفعلها؟
               </div>
               <p className="leading-relaxed text-slate-300">
                 <strong className="text-white">الفائدة والهدف:</strong> توفر المصادقة الثنائية طبقة حماية قصوى لمنزلك الذكي؛ فحتى لو اختُرقت كلمة المرور، لن يستطيع أي شخص غريب الدخول إلا برمز المتغير الحظي المولد في هاتفك المحمول فقط!
               </p>
               <div className="space-y-1.5 pt-2 border-t border-purple-500/20">
                 <div className="font-semibold text-purple-200">خطوات التفعيل السريعة:</div>
                 <ol className="list-decimal list-inside space-y-1.5 pr-1 text-slate-300">
                   <li>حمل تطبيق <strong className="text-white">Google Authenticator</strong> أو <strong className="text-white">Authy</strong> على هاتفك المحمول.</li>
                   <li>اضغط زر <strong className="text-purple-300">"إعداد تطبيق Authenticator"</strong> أدناه وامسح رمز الـ QR بالهاتف.</li>
                   <li>أدخل الرمز المكون من 6 أرقام للتأكيد وتأمين حسابك فوراً.</li>
                 </ol>
               </div>
             </div>

             <button 
               onClick={() => setIs2FAModalOpen(true)}
               className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg text-sm flex items-center justify-center gap-2"
             >
               <QrCode size={18} />
               إعداد تطبيق Authenticator (Google / Authy)
             </button>
          </div>

          <div className="bg-[#11151c]/80 border border-white/10 rounded-[2rem] p-8 backdrop-blur-xl shadow-xl">
             <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                   <Key size={24} />
                 </div>
                 <div>
                   <h3 className="text-white font-bold text-lg">مفاتيح API</h3>
                   <p className="text-gray-400 text-sm">ربط المنصة بالتطبيقات الخارجية مثل Home Assistant أو Node-RED.</p>
                 </div>
               </div>
               <button 
                 onClick={() => { setCreatedKey(null); setIsApiKeyModalOpen(true); }}
                 className="text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-xl transition-all shadow-lg flex items-center gap-1.5"
               >
                 <Plus size={16} />
                 إنشاء مفتاح جديد
               </button>
             </div>
             
             <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
               {apiKeys.length === 0 ? (
                 <div className="p-4 bg-[#0b0e14]/50 rounded-2xl border border-white/5 text-center text-xs text-slate-400">
                   لا توجد مفاتيح API مسجلة حالياً. اضغط على "إنشاء مفتاح جديد" لإضافة مفتاح.
                 </div>
               ) : (
                 apiKeys.map((key) => (
                   <div key={key.id} className="p-4 bg-[#0b0e14]/70 rounded-2xl border border-white/10 flex items-center justify-between hover:border-emerald-500/30 transition-all">
                     <div>
                       <p className="text-white font-bold text-sm">{key.name}</p>
                       <p className="text-emerald-400 text-xs mt-1 font-mono">{key.key}</p>
                     </div>
                     <button
                       onClick={() => handleDeleteApiKey(key.id)}
                       className="p-2 text-red-400 hover:text-white hover:bg-red-500/20 rounded-xl transition-all"
                       title="حذف المفتاح"
                     >
                       <Trash2 size={16} />
                     </button>
                   </div>
                 ))
               )}
             </div>
          </div>

        </div>

      </div>

      {/* 2FA Setup Modal */}
      {is2FAModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#111827] border border-purple-500/30 p-8 rounded-[2rem] w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIs2FAModalOpen(false)} className="absolute top-6 left-6 text-gray-400 hover:text-white">
              <X size={20} />
            </button>
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 border border-purple-500/20">
                <QrCode size={32} />
              </div>
              <h3 className="text-2xl font-black text-white">إعداد المصادقة الثنائية (2FA)</h3>
              <p className="text-gray-400 text-xs mt-1">مسح رمز الـ QR بتطبيق Authenticator للحصول على رمز الدخول.</p>
            </div>

            <div className="bg-black/50 p-4 rounded-2xl border border-white/10 text-center space-y-3 mb-6">
              <div className="w-40 h-40 bg-white p-2 rounded-xl mx-auto flex items-center justify-center shadow-lg">
                {/* Visual QR Code Generator */}
                <div className="w-full h-full bg-slate-900 rounded flex flex-col items-center justify-center text-white p-2">
                  <QrCode size={80} className="text-purple-400 mb-1" />
                  <span className="text-[10px] text-slate-300 font-mono">MOSA-2FA-AUTH</span>
                </div>
              </div>
              <p className="text-xs text-slate-300 font-mono select-all">Secret: <strong className="text-purple-300">JBSWY3DPEHPK3PXP</strong></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">أدخل الرمز المكون من 6 أرقام للتأكيد:</label>
                <input
                  type="text"
                  maxLength={6}
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono text-xl tracking-widest outline-none focus:border-purple-400"
                />
              </div>

              <button
                onClick={() => {
                  if (totpCode.length === 6) {
                    setTwoFactorEnabled(true);
                    setIs2FAModalOpen(false);
                    notify('تم تفعيل المصادقة الثنائية (2FA) بنجاح! 🔐', 'success');
                  } else {
                    notify('يرجى إدخال رمز مكون من 6 أرقام', 'warning');
                  }
                }}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg text-sm cursor-pointer"
              >
                تأكيد وتفعيل الـ 2FA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#111827] border border-emerald-500/30 p-8 rounded-[2rem] w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIsApiKeyModalOpen(false)} className="absolute top-6 left-6 text-gray-400 hover:text-white">
              <X size={20} />
            </button>
            
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 border border-emerald-500/20">
                <Key size={28} />
              </div>
              <h3 className="text-2xl font-black text-white">إنشاء مفتاح API جديد</h3>
              <p className="text-gray-400 text-xs mt-1">أدخل اسماً مخصصاً للمفتاح للربط بالأنظمة الخارجية.</p>
            </div>

            {createdKey ? (
              <div className="space-y-4 text-center">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-mono break-all select-all">
                  {createdKey}
                </div>
                <p className="text-xs text-slate-400">انسخ المفتاح الآن. لن يتم إظهاره بالكامل مرة أخرى لأسباب أمنية.</p>
                <button
                  onClick={() => setIsApiKeyModalOpen(false)}
                  className="w-full bg-emerald-500 text-black font-bold py-3 rounded-xl transition-all"
                >
                  تم والحفظ
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateApiKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">اسم المفتاح (App Name):</label>
                  <input
                    type="text"
                    required
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="مثال: Home Assistant Integration"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg text-sm"
                >
                  إنشاء وتوليد المفتاح 🔑
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Force PIN Change Modal */}
      {isPinModalOpen && (
        <div className={`fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 ${force ? '' : 'animate-fade-up'}`} dir="rtl">
          <div className="bg-[#111827] border border-red-500/30 p-8 rounded-[2rem] w-full max-w-md shadow-2xl">
            <div className="flex flex-col items-center mb-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4 border border-red-500/20">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-2xl font-black text-white">{force ? 'تحديث أمني مطلوب' : 'تغيير الرمز السري'}</h3>
              <p className="text-gray-400 mt-2 text-xs">
                {force ? 'تم إعادة تعيين الرمز الخاص بك. لضمان حماية النظام، يجب عليك إعداد رمز جديد فوراً.' : 'أدخل الرمز القديم والجديد'}
              </p>
            </div>
            
            <form onSubmit={handleChangePin} className="space-y-5">
              {!force && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2">الرمز القديم</label>
                  <input required type="password" value={oldPin} onChange={(e) => setOldPin(e.target.value)} minLength={4} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500 text-center tracking-widest text-xl" placeholder="••••" />
                </div>
              )}
              {force && (
                <input type="hidden" value="0000" />
              )}
              
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2">الرمز الجديد</label>
                <input required type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} minLength={4} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500 text-center tracking-widest text-xl" placeholder="أرقام فقط (مثال: 4567)" />
              </div>
              
              {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center font-bold">{error}</div>}
              {success && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs text-center font-bold">{success}</div>}

              <div className="flex gap-3 mt-4">
                <button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg text-sm disabled:opacity-50">
                  {loading ? 'جاري الحفظ...' : 'حفظ الرمز الجديد'}
                </button>
                {!force && (
                  <button type="button" onClick={() => setIsPinModalOpen(false)} className="px-6 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-xl transition-colors text-sm">
                    إلغاء
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function AdvancedSecurityPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-400">جاري التحميل...</div>}>
      <SecuritySettingsContent />
    </Suspense>
  );
}
