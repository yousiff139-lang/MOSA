'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Palette, Type, Layout, Image as ImageIcon, Save, CheckCircle2 } from 'lucide-react';
import { useBranding } from '@/components/BrandingProvider';
import { PermissionGuard } from '@/components/PermissionGuard';
import { motion } from 'framer-motion';

export default function BrandingPage() {
  const { branding, isLoading } = useBranding();
  
  const [formData, setFormData] = useState({
    platformName: branding.platformName || '',
    platformNameAr: branding.platformNameAr || '',
    colorPrimary: branding.colorPrimary || '#3b82f6',
    colorBackground: branding.colorBackground || '#0a0f1e',
    showEnergyModule: branding.showEnergyModule ?? true,
    showAutomation: true,
    customDomain: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      // In a real app, this would PUT to /api/branding and then re-fetch
      // For the preview, we just update CSS directly
      const root = document.documentElement;
      root.style.setProperty('--color-primary', formData.colorPrimary);
      root.style.setProperty('--color-bg', formData.colorBackground);
      
      setTimeout(() => setSaved(false), 3000);
    }, 1000);
  };

  return (
    <PermissionGuard require="SUPER_OWNER" fallback={<div className="p-12 text-center text-red-400">لا تملك صلاحية (Super Owner) للوصول إلى إعدادات الهوية.</div>}>
      <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-700" dir="rtl">
        <div className="flex justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white drop-shadow-md">هوية المنصة (White-Label)</h1>
            <p className="text-sm text-zinc-400 mt-1">تخصيص العلامة التجارية، الألوان، والميزات للعملاء</p>
          </div>
          
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className={`rounded-xl shadow-lg transition-all ${saved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#3b82f6] hover:bg-[#2563eb]'} text-white`}
          >
            {isSaving ? 'جاري الحفظ...' : saved ? <><CheckCircle2 size={18} className="ml-2"/> تم الحفظ بنجاح</> : <><Save size={18} className="ml-2"/> حفظ التغييرات</>}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Settings Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Identity & Text */}
            <Card className="glass-card border-[#1e293b] rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><Type size={18} className="text-blue-400"/> الهوية والنصوص</CardTitle>
                <CardDescription className="text-zinc-400">أسماء المنصة وعناوينها كما تظهر للعميل النهائي.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-300">اسم المنصة (عربي)</label>
                    <Input 
                      value={formData.platformNameAr} 
                      onChange={e => setFormData({...formData, platformNameAr: e.target.value})}
                      className="bg-[#111827] border-[#1e293b] text-white rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-300">اسم المنصة (إنجليزي)</label>
                    <Input 
                      value={formData.platformName} 
                      onChange={e => setFormData({...formData, platformName: e.target.value})}
                      className="bg-[#111827] border-[#1e293b] text-white rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-300">النطاق المخصص (Custom Domain)</label>
                  <Input 
                    placeholder="مثال: smart.alrashid.com"
                    value={formData.customDomain} 
                    onChange={e => setFormData({...formData, customDomain: e.target.value})}
                    className="bg-[#111827] border-[#1e293b] text-white rounded-xl"
                  />
                  <p className="text-xs text-zinc-500">يجب إضافة سجل DNS من نوع CNAME يوجه إلى خوادمنا.</p>
                </div>
              </CardContent>
            </Card>

            {/* Colors & Branding */}
            <Card className="glass-card border-[#1e293b] rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><Palette size={18} className="text-purple-400"/> الألوان الأساسية</CardTitle>
                <CardDescription className="text-zinc-400">اختر الألوان التي تتناسب مع هوية شركتك.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-300">اللون الأساسي (Primary)</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={formData.colorPrimary} 
                        onChange={e => setFormData({...formData, colorPrimary: e.target.value})}
                        className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                      <span className="text-mono text-zinc-400">{formData.colorPrimary}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-300">لون الخلفية (Background)</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={formData.colorBackground} 
                        onChange={e => setFormData({...formData, colorBackground: e.target.value})}
                        className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                      <span className="text-mono text-zinc-400">{formData.colorBackground}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features Toggle */}
            <Card className="glass-card border-[#1e293b] rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><Layout size={18} className="text-emerald-400"/> الميزات الظاهرة</CardTitle>
                <CardDescription className="text-zinc-400">قم بتفعيل أو تعطيل ميزات معينة بناءً على الباقة المباعة للعميل.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-[#1e293b]">
                  <div>
                    <h3 className="text-white font-medium">مراقبة الطاقة (Energy Monitoring)</h3>
                    <p className="text-sm text-zinc-500">إظهار صفحة إحصائيات الكهرباء</p>
                  </div>
                  <Switch 
                    checked={formData.showEnergyModule} 
                    onCheckedChange={c => setFormData({...formData, showEnergyModule: c})} 
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-[#1e293b]">
                  <div>
                    <h3 className="text-white font-medium">محرك الأتمتة (Automation Engine)</h3>
                    <p className="text-sm text-zinc-500">إظهار صفحات الـ Routines و Scenes</p>
                  </div>
                  <Switch 
                    checked={formData.showAutomation} 
                    onCheckedChange={c => setFormData({...formData, showAutomation: c})} 
                  />
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Live Preview Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><ImageIcon size={18}/> معاينة حية</h2>
              
              <motion.div 
                className="w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                style={{ backgroundColor: formData.colorBackground }}
                animate={{ backgroundColor: formData.colorBackground }}
                transition={{ duration: 0.5 }}
              >
                {/* Mock Header */}
                <div className="h-12 border-b border-white/5 flex items-center px-4 gap-2">
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
                  </div>
                  <div className="flex-1 text-center text-xs text-zinc-500 font-mono">
                    {formData.customDomain || 'smart.local'}
                  </div>
                </div>

                {/* Mock App Content */}
                <div className="p-6 space-y-4 relative min-h-[400px]">
                  {/* Decorative Glow based on primary color */}
                  <div 
                    className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[50px] opacity-20 pointer-events-none"
                    style={{ backgroundColor: formData.colorPrimary }}
                  />

                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-bold">{formData.platformNameAr || 'المنصة'}</h3>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs text-white">M</div>
                  </div>

                  {/* Mock Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="w-6 h-6 rounded-md mb-2 flex items-center justify-center" style={{ backgroundColor: `${formData.colorPrimary}33` }}>
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: formData.colorPrimary }}></div>
                      </div>
                      <div className="h-2 w-12 bg-white/10 rounded mb-1"></div>
                      <div className="h-2 w-8 bg-white/5 rounded"></div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="w-6 h-6 rounded-md mb-2 flex items-center justify-center bg-white/5"></div>
                      <div className="h-2 w-12 bg-white/10 rounded mb-1"></div>
                      <div className="h-2 w-8 bg-white/5 rounded"></div>
                    </div>
                  </div>

                  {/* Mock Button */}
                  <div 
                    className="w-full mt-6 py-2 rounded-lg text-center text-white text-xs font-medium"
                    style={{ backgroundColor: formData.colorPrimary }}
                  >
                    تطبيق الإعدادات
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

        </div>
      </div>
    </PermissionGuard>
  );
}
