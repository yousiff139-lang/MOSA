"use client";

import { useRuntimeStore } from '@/store/useRuntimeStore';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { useLanguage } from '@/context/LanguageContext';
import { Search, Sparkles, User, Palette } from 'lucide-react';
import { HomeSwitcher } from './HomeSwitcher';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { VoiceAssistantModal } from '../VoiceAssistantModal';
import { NotificationCenter } from './NotificationCenter';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Icons from 'lucide-react';

export function TopBar() {
  const { lang, setLang, isSidebarOpen, setSidebarOpen } = useRuntimeStore();
  const { t } = useLanguage();
  const user = useSmartHomeStore(state => state.user);
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);

  const handleOpenSearch = () => {
    // Trigger CommandPalette search modal
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') setDeferredPrompt(null);
    } else {
      setIsPwaModalOpen(true);
    }
  };

  return (
    <>
      <VoiceAssistantModal 
        isOpen={isVoiceAssistantOpen} 
        onClose={() => setIsVoiceAssistantOpen(false)} 
      />

      <header className="h-14 sm:h-16 border-b border-slate-800 bg-[#090e17] z-30 sticky top-0 shadow-md relative shrink-0">
        {/* Dynamic Glowing Ambient Top Accent Line */}
        <div 
          className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-500 z-50 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)',
            boxShadow: '0 0 10px var(--primary)'
          }}
        />
        <div className="flex items-center justify-between h-full px-3 sm:px-8">
          
          {/* Right Side (in RTL) - Home Switcher & Menu */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-all focus:outline-none shrink-0"
              title={t('topbar.menu')}
            >
              <Icons.Menu size={22} />
            </button>
            <div className="hidden sm:block">
              <HomeSwitcher />
            </div>
            <div className="sm:hidden flex items-center gap-1.5 truncate">
              <span className="text-white text-xs font-black truncate">Mosa Smart</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            </div>
          </div>

          {/* Search Bar - Active Global Search Palette Launcher */}
          <div 
            onClick={handleOpenSearch}
            className="hidden md:flex flex-1 max-w-xl mx-8 relative group cursor-pointer"
          >
             <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-hover:text-cyan-400 transition-colors duration-300" />
             <input 
               type="text" 
               readOnly
               placeholder={t('topbar.search_placeholder')}
               className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-2.5 pl-12 pr-5 text-sm text-white cursor-pointer group-hover:border-cyan-500/40 group-hover:bg-white/[0.06] placeholder-white/30 transition-all duration-300 shadow-inner"
             />
          </div>

          {/* Actions & Profile (Control Strip) */}
          <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
            
            {/* Install Mobile PWA App Button - Always visible on mobile and desktop */}
            <button 
              id="pwa-install-btn"
              onClick={handleInstallPWA}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 hover:from-blue-500/30 hover:to-indigo-500/30 text-blue-300 border border-blue-500/40 rounded-xl sm:rounded-2xl transition-all text-xs font-bold shadow-[0_0_12px_rgba(59,130,246,0.25)] hover:scale-105 active:scale-95 shrink-0"
              title={t('topbar.install_app')}
            >
              <Icons.Smartphone size={15} className="text-blue-400 shrink-0 animate-pulse" />
              <span className="inline text-[11px] sm:text-xs font-bold">{t('topbar.install_app')}</span>
            </button>

            {/* AI Assistant Glowing Button */}
            <button 
              onClick={() => setIsVoiceAssistantOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-2xl transition-all text-xs font-bold shadow-sm"
              title={t('topbar.ai_assistant')}
            >
              <Sparkles size={16} className="text-purple-400 animate-pulse shrink-0" />
              <span className="hidden sm:inline tracking-wide">{t('topbar.ai_assistant')}</span>
            </button>

            {/* 🔔 Live Notification Center (Prominent Standalone Control) */}
            <NotificationCenter />

            {/* Language & Theme Capsule */}
            <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 rounded-2xl p-0.5 sm:p-1">
              <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/70 text-xs font-bold transition-colors">
                {lang === 'ar' ? 'EN' : 'AR'}
              </button>

              <div className="hidden sm:block">
                <ThemeSwitcher />
              </div>
            </div>

            <div className="h-8 w-[1px] bg-white/10 mx-1 hidden sm:block"></div>

            {/* Active Logged-In User Profile Button */}
            <div 
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer p-1 sm:p-2 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-cyan-500/10 border border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.06] transition-all duration-300 shadow-md group"
              title="حساب المستخدم المسجل"
            >
               <div className="hidden sm:flex flex-col items-end">
                 <span className="text-sm font-bold text-white leading-none mb-1">
                   {user?.name || user?.username || 'المستخدم'}
                 </span>
                 <span className="text-[9px] text-cyan-400 font-black uppercase tracking-wider">
                   {user?.role === 'SUPER_OWNER' ? 'المالك الرئيسي' :
                    user?.role === 'ADMIN' ? 'مسؤول (ADMIN)' :
                    user?.role === 'MEMBER' ? 'عضو (MEMBER)' :
                    user?.role === 'RESTRICTED' ? 'مستخدم مقيد' :
                    user?.role === 'GUEST' ? 'زائر (GUEST)' :
                    user?.role || 'مستخدم'}
                 </span>
               </div>
               <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-white/20 font-black text-xs sm:text-sm group-hover:scale-105 transition-transform duration-300 shrink-0">
                 {(user?.name || user?.username || 'U')[0].toUpperCase()}
               </div>
            </div>

          </div>
        </div>
      </header>


      {/* 2. Logged In User Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-cyan-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-right space-y-5 animate-scale-up">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-base font-bold text-white">حساب المستخدم المسجّل</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-black shadow-lg">
                {(user?.name || user?.username || 'U')[0].toUpperCase()}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  {user?.name || user?.username || 'مستخدم مسجل'}
                </h4>
                <p className="text-xs text-cyan-400 font-bold mt-0.5">
                  {user?.role === 'SUPER_OWNER' ? 'المالك الرئيسي (Super Owner)' :
                   user?.role === 'ADMIN' ? 'مسؤول المنظومة (Admin)' :
                   user?.role === 'MEMBER' ? 'عضو أساسي (Member)' :
                   user?.role === 'RESTRICTED' ? 'مستخدم مقيد (Restricted)' :
                   user?.role === 'GUEST' ? 'حساب زائر (Guest)' :
                   user?.role || 'مستخدم (User)'}
                </p>
                {user?.id && <p className="text-[10px] text-slate-400 mt-1 font-mono">ID: {user.id}</p>}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2.5 bg-black/30 rounded-xl border border-white/5">
                <span className="text-slate-400">حالة الصلاحيات:</span>
                <span className={`font-bold ${
                  user?.role === 'RESTRICTED' || user?.role === 'GUEST' ? 'text-amber-400' :
                  user?.role === 'BLOCKED' ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  {user?.role === 'SUPER_OWNER' ? 'تحكم كامل (Super Owner)' :
                   user?.role === 'ADMIN' ? 'تحكم كامل (Admin Access)' :
                   user?.role === 'MEMBER' ? 'صلاحيات عضو (Member Access)' :
                   user?.role === 'RESTRICTED' ? 'صلاحيات مقيدة (Restricted Access)' :
                   user?.role === 'GUEST' ? 'صلاحيات زائر (Guest Access)' :
                   user?.role === 'BLOCKED' ? 'حساب محجوب (Blocked)' : 'وصول عادي'}
                </span>
              </div>
              <div className="flex justify-between p-2.5 bg-black/30 rounded-xl border border-white/5">
                <span className="text-slate-400">الجلسة النشطة:</span>
                <span className="font-bold text-cyan-300">جلسة مشفرة آمنة HMAC</span>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                إغلاق
              </button>
              <button 
                onClick={async () => {
                  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  localStorage.removeItem('mosa_user');
                  localStorage.removeItem('mosa_ui_mode');
                  document.cookie = 'token=; Max-Age=0; path=/;';
                  document.cookie = 'access_token=; Max-Age=0; path=/;';
                  window.location.href = '/auth/login';
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold border border-red-500/30"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PWA App Installation Guidance Modal */}
      {isPwaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-blue-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl text-right space-y-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Icons.Smartphone className="text-blue-400" size={20} />
                تثبيت منصة mosa كـ تطبيق (PWA)
              </h3>
              <button onClick={() => setIsPwaModalOpen(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              {/* iPhone / iPad (iOS Safari) Guidance */}
              <div className="p-4 bg-gradient-to-br from-blue-500/20 via-indigo-500/15 to-cyan-500/10 border border-blue-500/40 rounded-2xl shadow-lg space-y-2.5">
                <p className="font-black text-blue-300 flex items-center gap-2 text-sm">
                  <span>📱</span>
                  <span>خطوات التثبيت على الآيفون (iPhone Safari):</span>
                </p>
                <div className="space-y-2 text-slate-200">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">1</span>
                    <span>اضغط على زر <b>المشاركة (Share)</b> الموجود في أسفل شاشة المتصفح (مربع يخرج منه سهم للأعلى ⎋).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">2</span>
                    <span>مرر القائمة للأسفل واختر <b>(إضافة إلى الصفحة الرئيسية - Add to Home Screen ⊕)</b>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">3</span>
                    <span>اضغط <b>إضافة (Add)</b> في أعلى الزاوية، وسيظهر التطبيق بأيقونته فوراً على شاشة هاتفك مثل أي تطبيق مثبت!</span>
                  </div>
                </div>
              </div>

              {/* Android (Chrome) Guidance */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1.5">
                <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <span>🤖</span>
                  <span>لهواتف الأندرويد (Google Chrome):</span>
                </p>
                <p className="text-slate-300">اضغط على النقاط الثلاث (⋮) في زاوية المتصفح، ثم اختر <b>(تثبيت التطبيق - Install App)</b>.</p>
              </div>

              {/* PC Guidance */}
              <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-slate-400 text-[11px]">
                <span>💻 <b>للحاسوب:</b> اضغط رمز التثبيت <b>(+)</b> في شريط عنوان المتصفح بالأعلى.</span>
              </div>
            </div>

            <button 
              onClick={() => setIsPwaModalOpen(false)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all"
            >
              حسناً، سأثبته الآن 👍
            </button>
          </div>
        </div>
      )}
    </>
  );
}
