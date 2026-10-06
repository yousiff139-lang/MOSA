'use client';

import React, { useState, useEffect } from 'react';
import { 
  Save, Image as ImageIcon, Palette, Globe, UploadCloud, 
  CheckCircle2, ShieldCheck, Sparkles, Sliders, Info, Smartphone,
  Layers, Check, Eye, RefreshCw
} from 'lucide-react';
import { fetchAuth, useSmartHomeStore } from '@/store/useSmartHomeStore';
import { notify } from '@/store/useConfirmStore';

const COLOR_PRESETS = [
  { name: 'نيون سايبر (Cyber Cyan)', hex: '#06b6d4', ring: 'cyan' },
  { name: 'أزرق ملكي (Royal Blue)', hex: '#3b82f6', ring: 'blue' },
  { name: 'زمردي داكن (Emerald Mint)', hex: '#10b981', ring: 'emerald' },
  { name: 'بنفسجي فاخر (Deep Purple)', hex: '#8b5cf6', ring: 'purple' },
  { name: 'ذهبي أوبسيديان (Obsidian Gold)', hex: '#f59e0b', ring: 'amber' },
  { name: 'قرمزي فائق (Crimson Red)', hex: '#ef4444', ring: 'red' },
];

export default function BrandingPage() {
  const [primaryColor, setPrimaryColor] = useState('#06b6d4');
  const [platformName, setPlatformName] = useState('MOSA Smart Platform');
  const [customDomain, setCustomDomain] = useState('mosa.home.local');
  const [logoUrl, setLogoUrl] = useState('');
  const [loginBgUrl, setLoginBgUrl] = useState('');
  const [pwaShortName, setPwaShortName] = useState('MOSA Smart');
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Live interactive preview states
  const [previewToggle, setPreviewToggle] = useState(true);

  const user = useSmartHomeStore(s => s.user);

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      const res = await fetchAuth(`/api/branding`);
      if (res.ok) {
        const data = await res.json();
        if (data.platformName) setPlatformName(data.platformName);
        if (data.colorPrimary) setPrimaryColor(data.colorPrimary);
        if (data.customDomain) setCustomDomain(data.customDomain);
        if (data.logoUrl) setLogoUrl(data.logoUrl);
        if (data.loginBgUrl) setLoginBgUrl(data.loginBgUrl);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSavedSuccess(false);
    try {
      const homeId = user?.homeId || 'default-home';
      await fetchAuth(`/api/branding/${homeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformName, colorPrimary: primaryColor, customDomain, logoUrl, loginBgUrl })
      });
      
      setSavedSuccess(true);
      notify({ type: 'success', title: 'تم الحفظ', message: 'تم تحديث وتطبيق الهوية البصرية بنجاح!' });
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      notify({ type: 'error', title: 'خطأ', message: 'فشل حفظ الهوية البصرية' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const homeId = user?.homeId || 'default-home';
      const res = await fetchAuth(`/api/branding/${homeId}/logo`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setLogoUrl(data.url || URL.createObjectURL(file));
      } else {
        setLogoUrl(URL.createObjectURL(file));
      }
      notify({ type: 'success', title: 'تم الرفع', message: 'تم تحميل الشعار بنجاح!' });
    } catch (err) {
      setLogoUrl(URL.createObjectURL(file));
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 text-right dir-rtl font-sans pb-24" dir="rtl">
      
      {/* Page Title & Explanation Header */}
      <div className="bg-gradient-to-r from-cyan-950/60 via-slate-900 to-blue-950/60 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
                <Palette size={24} />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">تخصيص الهوية البصرية وإدارة الشركاء (White-Label)</h1>
                <p className="text-xs sm:text-sm text-cyan-300/80 font-mono mt-0.5">Enterprise Visual Branding & Multi-Theme Engine</p>
              </div>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed mt-2">
              💡 <b>ما هي الغاية من هذه الصفحة؟</b> تمكنك هذه اللوحة من تخصيص مظهر وشعار ونطاق منصة المنزل الذكي الخاصة بك. يمكنك تغيير اسم المنصة، إضافة شعارك الخاص (Logo)، وتحديد ألوان الواجهة والنطاق المحلي بحرية كاملة.
            </p>
          </div>

          <button 
            onClick={handleSave}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 hover:scale-105 active:scale-95 shrink-0"
          >
            <Save size={18} />
            <span>{loading ? 'جاري الحفظ...' : 'حفظ التغييرات الهيكلية ✨'}</span>
          </button>
        </div>

        {savedSuccess && (
          <div className="mt-4 p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-300 font-bold text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={18} />
            <span>تم تمكين وتحديث بيانات الهوية البصرية بنجاح على السيرفر!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1 & 2: General Info & Platform Identity */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Identity & Domains */}
          <div className="bg-slate-950/80 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <Globe className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-base font-bold text-white">1. هوية واسم المنصة المحلية</h3>
                <p className="text-xs text-slate-400">تخصيص الاسم المعروض بالنظام والعنوان الإلكتروني</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">اسم المنصة المخصص (Platform Name)</label>
                <input 
                  type="text" 
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  placeholder="مثال: منزل آل أحمد الذكي / Mosa Smart Platform"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-cyan-500 focus:bg-white/[0.08] transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">يظهر في أعلى الشريط الجانبي وشريط العنوان.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">النطاق الخاص أو عنوان الـ IP المحلي (Custom Domain)</label>
                <input 
                  type="text" 
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="مثال: mosa.home.local أو 192.168.1.100"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-cyan-500 focus:bg-white/[0.08] transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">عنوان الربط السريع المباشر للسيرفر دون إنترنت.</p>
              </div>
            </div>
          </div>

          {/* 2. Visual Assets & Logo */}
          <div className="bg-slate-950/80 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <ImageIcon className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="text-base font-bold text-white">2. الشعارات والصور (Brand Assets)</h3>
                <p className="text-xs text-slate-400">رفع أو ربط الشعار الرسمي للمنزل أو المؤسسة</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">رابط الشعار الرسمي (Logo URL)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                    placeholder="https://... أو /uploads/logo.png"
                    className="flex-1 px-4 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <label className="px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-2xl transition-all cursor-pointer flex items-center justify-center font-bold text-xs gap-2 shrink-0">
                    <UploadCloud size={16} /> رفع صورة
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">رابط خلفية شاشة الدخول (Login Background URL)</label>
                <input 
                  type="text" 
                  value={loginBgUrl}
                  onChange={e => setLoginBgUrl(e.target.value)}
                  placeholder="https://... أو خلفية زجاجية افتراضية"
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Mobile PWA Integration */}
          <div className="bg-slate-950/80 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-white">3. تطبيق الويب التثبيتي (PWA App Manifest)</h3>
                <p className="text-xs text-slate-400">تخصيص مظهر التطبيق عند التثبيت على هواتف أندرويد وiOS</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">الاسم المختصر على الشاشة الرئيسية (Short Name)</label>
              <input 
                type="text" 
                value={pwaShortName}
                onChange={e => setPwaShortName(e.target.value)}
                placeholder="MOSA Home"
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

        </div>

        {/* Column 3: Color Themes & Real-Time Live Preview */}
        <div className="space-y-6">

          {/* Theme Color Picker */}
          <div className="bg-slate-950/80 border border-white/10 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <Palette className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-base font-bold text-white">4. ألوان الثيم النيون</h3>
                <p className="text-xs text-slate-400">تأثيرات الإضاءة والأزرار بالواجهة</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">اللون الأساسي (Primary Color)</label>
                <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/10 rounded-2xl">
                  <input 
                    type="color" 
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-white font-mono text-xs font-bold bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex-1 text-center">
                    {primaryColor}
                  </span>
                </div>
              </div>

              {/* Quick Curated Color Presets */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2">تنسيقات نيون جاهزة ومختارة:</label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c.hex}
                      onClick={() => setPrimaryColor(c.hex)}
                      className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                        primaryColor.toLowerCase() === c.hex.toLowerCase() 
                          ? 'bg-white/10 border-white text-white shadow-lg' 
                          : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: c.hex }} />
                      <span className="text-[9px] font-bold truncate max-w-full">{c.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Live UI Mockup Card */}
          <div className="bg-slate-950/80 border border-cyan-500/30 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-4">
            <h4 className="text-xs font-bold text-cyan-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Eye size={15} /> معاينة مباشرة لمظهر المنصة:
              </span>
              <span className="text-[10px] text-slate-400 font-normal">تحديث حي</span>
            </h4>

            {/* Interactive Mockup Component */}
            <div className="p-4 bg-black/60 rounded-2xl border border-white/10 space-y-3 shadow-2xl">
              
              {/* Header Preview */}
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="w-5 h-5 object-contain" /> : 'M'}
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-white leading-tight">{platformName}</p>
                    <p className="text-[9px] font-mono text-cyan-400">{customDomain}</p>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>

              {/* Sample Device Toggle Card Preview */}
              <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">إنارة الصالة الرئيسية</span>
                  <span className="text-[9px] text-slate-400">ESP32 Relay • مفعّل</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewToggle(!previewToggle)}
                  className={`w-10 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shadow`}
                  style={{ backgroundColor: previewToggle ? primaryColor : '#334155' }}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${previewToggle ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Action Button Preview */}
              <button 
                type="button"
                className="w-full py-2 text-center rounded-xl text-xs font-bold text-white shadow-lg transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: primaryColor }}
              >
                تطبيق الإجراء السريع ✨
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
