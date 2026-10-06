// @ts-nocheck
"use client";

import { useRuntimeStore } from '@/store/useRuntimeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useEffect, useState } from 'react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, auroraColorsMap, darkBgMap, dynamicAmbientGradients } from '@/context/ThemeContext';
import { LayoutGrid, Home, Mic, Camera, Settings, ChevronDown, ChevronUp, Cpu, Menu, Sparkles, Grid } from 'lucide-react';
import Link from 'next/link';

function DockItem({ icon, label, href, active }: { icon: React.ReactNode; label: string; href: string; active: boolean }) {
  return (
    <Link href={href}>
      <motion.div 
        whileHover={{ y: -4, scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        className={`relative group w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-colors ${
          active 
            ? 'bg-white/15 text-white border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] shadow-lg' 
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
      >
        {icon}
        {/* Tooltip on desktop */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none bg-slate-900 text-white border border-white/10 shadow-xl hidden sm:block">
          {label}
        </div>
        {active && <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>}
      </motion.div>
    </Link>
  );
}

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const fetchRuntimeConfig = useRuntimeStore(s => s.fetchRuntimeConfig);
  const lang = useRuntimeStore(s => s.lang);
  const isEn = lang === 'en';
  const initBackendConnection = useSmartHomeStore(s => s.initBackendConnection);
  const performanceMode = useSmartHomeStore(s => s.performanceMode);
  const { isSidebarOpen, setSidebarOpen } = useRuntimeStore();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname?.startsWith('/auth') || pathname?.startsWith('/setup');
  const { accentColor, darkBackgroundHue, backgroundStyle } = useTheme();

  // State to allow user to collapse/hide the bottom dock to unblock view completely
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);

  useEffect(() => {
    if (isAuthPage) return;

    // Verify token for protected routes
    const token = typeof window !== 'undefined' ? (
      localStorage.getItem('token') ||
      document.cookie.includes('token=') ||
      document.cookie.includes('access_token=')
    ) : null;

    if (!token) {
      fetch('/api/setup/status')
        .then(res => res.json())
        .then(data => {
          if (!data.isInitialized) {
            router.replace('/setup');
          } else {
            router.replace('/auth/login');
          }
        })
        .catch(() => {
          router.replace('/auth/login');
        });
      return;
    }

    // Connect to WebSockets and fetch config when authenticated
    initBackendConnection();
    
    // Auto-close sidebar on mobile on initial load
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname, isAuthPage, router]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isEn ? 'ltr' : 'rtl';
      document.documentElement.lang = lang;
    }
  }, [lang, isEn]);

  // Auto-close sidebar on route change on mobile
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  const currentGradient = dynamicAmbientGradients[accentColor] || dynamicAmbientGradients['blue'];
  const currentMesh = performanceMode === 'eco' ? currentGradient.eco : currentGradient.normal;
  const currentBg = currentGradient.baseBg || darkBgMap[darkBackgroundHue]?.base || '#070d1a';

  return (
    <div 
      className="flex h-[100dvh] overflow-hidden text-foreground font-inter relative transition-colors duration-700" 
      style={{ backgroundColor: currentBg }}
      dir={isEn ? 'ltr' : 'rtl'}
    >
      {/* ── Ultra-Premium Cyber Ambient Background Layer (Dynamic Theme Responsive) ── */}
      {!isAuthPage && (
        <div 
          className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-colors duration-700"
          style={{ backgroundColor: currentBg }}
        >
          {/* 1. Deep Cyber Radiant Mesh (Pure CSS Radial Gradients - Transitions Smoothly on Color Change) */}
          {backgroundStyle !== 'solid' && (
            <div 
              className="absolute inset-0 z-0 pointer-events-none transition-all duration-700"
              style={{
                backgroundImage: currentMesh
              }}
            />
          )}

          {/* 2. Cyber Matrix Dot Overlay */}
          <div className="absolute inset-0 bg-cyber-dots opacity-20 pointer-events-none" />

          {/* 3. Top Horizon Cyber Glow Accent */}
          <div 
            className="absolute top-0 inset-x-0 h-[2px] opacity-90 pointer-events-none transition-all duration-500"
            style={{
              background: `linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)`,
              boxShadow: '0 0 12px var(--primary)'
            }}
          />
        </div>
      )}

      {/* Main layout wrapper at z-10 */}
      <div className="flex w-full h-full relative z-10 bg-transparent">
        {!isAuthPage && <Sidebar />}
        <div className="flex-1 flex flex-col w-full h-[100dvh] overflow-hidden relative bg-transparent min-w-0">
          {!isAuthPage && <TopBar />}
          {/* 
            The Single Primary Scroll Container
            Ample bottom padding (pb-32 on mobile, pb-40 on desktop) ensures no content is ever hidden under navigation bars
          */}
          <main 
            className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative z-10 bg-transparent"
            style={{
              paddingBottom: isAuthPage ? '0px' : 'calc(6.5rem + env(safe-area-inset-bottom, 24px))'
            }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* 1. Desktop Floating Bottom Navigation Dock */}
      {!isAuthPage && (
        <div className="hidden md:block fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
          <AnimatePresence mode="wait">
            {isDockCollapsed ? (
              <motion.button
                key="collapsed-pill"
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 20 }}
                onClick={() => setIsDockCollapsed(false)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white text-xs font-bold shadow-[0_8px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all"
                title={isEn ? 'Click to show menu' : 'اضغط لإظهار القائمة السريعة'}
              >
                <ChevronUp size={14} className="text-cyan-400" />
                <span>{isEn ? 'Show Menu' : 'إظهار القائمة السريعة'}</span>
              </motion.button>
            ) : (
              <motion.div 
                key="expanded-dock"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="flex items-center gap-2 px-4 py-2 rounded-3xl border border-white/15 bg-slate-950/95 shadow-[0_12px_40px_rgba(0,0,0,0.7)]"
              >
                <DockItem icon={<LayoutGrid size={18}/>} label={t('main_dashboard')} href="/" active={pathname === '/'} />
                <DockItem icon={<Grid size={18}/>} label={t('rooms')} href="/rooms" active={pathname === '/rooms'} />
                <DockItem icon={<Cpu size={18}/>} label={t('devices')} href="/devices" active={pathname === '/devices'} />
                <DockItem icon={<Mic size={18}/>} label={t('assistant')} href="/ai" active={pathname === '/ai'} />
                <div className="w-px h-6 mx-1 bg-white/15"></div>
                <DockItem icon={<Settings size={18}/>} label={t('settings')} href="/settings" active={pathname?.startsWith('/settings')} />
                
                {/* Collapse / Hide Toggle Button */}
                <button
                  onClick={() => setIsDockCollapsed(true)}
                  title={isEn ? 'Hide dock to unblock view' : 'إخفاء الشريط الأسفل'}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1 cursor-pointer"
                >
                  <ChevronDown size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 2. Mobile Bottom Navigation Bar — Ultra-Sleek Touch Responsive with Safe Area */}
      {!isAuthPage && (
        <nav 
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#080d1a]/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.8)] touch-manipulation transition-all"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          dir="rtl"
        >
          <div className="flex items-center justify-around h-16 px-1.5 max-w-md mx-auto">
            
            {/* Home */}
            <Link 
              href="/"
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-2xl transition-all active:scale-95 ${
                pathname === '/' ? 'text-cyan-400 font-black' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all relative ${pathname === '/' ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]' : ''}`}>
                <LayoutGrid size={19} />
                {pathname === '/' && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400" />}
              </div>
              <span className="text-[10px] mt-0.5 font-bold tracking-tight">{t('home')}</span>
            </Link>

            {/* Devices */}
            <Link 
              href="/devices"
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-2xl transition-all active:scale-95 ${
                pathname === '/devices' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all relative ${pathname === '/devices' ? 'bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : ''}`}>
                <Cpu size={19} />
                {pathname === '/devices' && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </div>
              <span className="text-[10px] mt-0.5 font-bold tracking-tight">{t('devices')}</span>
            </Link>

            {/* Rooms */}
            <Link 
              href="/rooms"
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-2xl transition-all active:scale-95 ${
                pathname === '/rooms' ? 'text-indigo-400 font-black' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all relative ${pathname === '/rooms' ? 'bg-indigo-500/20 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.4)]' : ''}`}>
                <Grid size={19} />
                {pathname === '/rooms' && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400" />}
              </div>
              <span className="text-[10px] mt-0.5 font-bold tracking-tight">{t('rooms')}</span>
            </Link>

            {/* Settings */}
            <Link 
              href="/settings"
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-2xl transition-all active:scale-95 ${
                pathname?.startsWith('/settings') ? 'text-cyan-400 font-black' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all relative ${pathname?.startsWith('/settings') ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]' : ''}`}>
                <Settings size={19} />
                {pathname?.startsWith('/settings') && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400" />}
              </div>
              <span className="text-[10px] mt-0.5 font-bold tracking-tight">{isEn ? 'Settings' : 'الإعدادات'}</span>
            </Link>

            {/* More */}
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-2xl transition-all active:scale-95 ${
                isSidebarOpen ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${isSidebarOpen ? 'bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : ''}`}>
                <Menu size={19} />
              </div>
              <span className="text-[10px] mt-0.5 font-bold tracking-tight">{isEn ? 'More' : 'المزيد'}</span>
            </button>

          </div>
        </nav>
      )}

    </div>
  );
}
