/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
// @ts-nocheck

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutGrid, Plus, Settings, Cpu, Wifi, WifiOff, 
  Sun, Moon, MapPin, Activity, ShieldAlert, Map, 
  Code, Tv, Info, Sparkles, SlidersHorizontal, 
  ShieldCheck, HelpCircle, User, Zap, Volume2, Thermometer, X, Radio, Layers
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import { motion, AnimatePresence } from 'framer-motion';

export function Sidebar() {
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const { user, uiMode, setUiMode, toggleUiMode, isConnected } = useSmartHomeStore();
  const { isSidebarOpen, setSidebarOpen } = useRuntimeStore();

  const userRole = (user?.role || '').toUpperCase();
  const isRestrictedUser = userRole.includes('RESTRICTED') || userRole === 'GUEST';
  const isSimple = uiMode === 'simple';

  // 🏡 1. Simple Mode Menu Configuration (For Parents / Elders / Family Members)
  const simpleSidebarConfig = [
    {
      group: null,
      items: [
        { id: '/', icon: LayoutGrid, label: t('sidebar.dashboard') },
      ]
    },
    {
      group: t('sidebar.home_control'),
      items: [
        { id: '/devices', icon: Zap, label: t('sidebar.lighting_switches') },
        { id: '/rooms', icon: MapPin, label: t('sidebar.rooms') },
        { id: '/appliances', icon: Thermometer, label: t('sidebar.appliances') },
        { id: '/tv', icon: Tv, label: t('sidebar.tv') },
        { id: '/scenes', icon: Sun, label: t('sidebar.scenes') },
        { id: '/security', icon: ShieldCheck, label: t('sidebar.security') },
        { id: '/audio', icon: Volume2, label: t('sidebar.audio') },
        { id: '/ai', icon: Sparkles, label: t('sidebar.ai_assistant') },
      ]
    },
    {
      group: t('sidebar.settings_help'),
      items: [
        { id: '/settings', icon: Settings, label: t('sidebar.settings') },
        { id: '/help', icon: HelpCircle, label: t('sidebar.help') },
      ]
    }
  ];

  // ⚙️ 2. Full Mode Menu Configuration (For Technical Admin / Developers)
  const fullSidebarConfig = [
    {
      group: null,
      items: [
        { id: '/', icon: LayoutGrid, label: t('sidebar.dashboard') },
        { id: '/floorplan', icon: Layers, label: t('sidebar.floorplan') },
      ]
    },
    {
      group: t('sidebar.devices_spaces'),
      items: [
        { id: '/devices', icon: Cpu, label: t('sidebar.devices') },
        { id: '/rooms', icon: MapPin, label: t('sidebar.rooms') },
        { id: '/appliances', icon: Thermometer, label: t('sidebar.appliances') },
        { id: '/tv', icon: Tv, label: t('sidebar.tv') },
        { id: '/audio', icon: Volume2, label: t('sidebar.audio') },
        ...(isRestrictedUser ? [] : [{ id: '/registry', icon: Plus, label: t('sidebar.registry') }])
      ]
    },
    ...(isRestrictedUser ? [] : [
      {
        group: t('sidebar.intelligence'),
        items: [
          { id: '/automations', icon: Settings, label: t('sidebar.automations') },
          { id: '/scenes', icon: Sun, label: t('sidebar.scenes') },
          { id: '/ai', icon: Sparkles, label: t('sidebar.ai_assistant') },
        ]
      },
      {
        group: t('sidebar.analytics'),
        items: [
          { id: '/energy', icon: Activity, label: t('sidebar.energy') },
          { id: '/logs', icon: Activity, label: t('sidebar.logs') },
          { id: '/reports', icon: LayoutGrid, label: t('sidebar.reports') },
        ]
      },
      {
        group: t('sidebar.infrastructure'),
        items: [
          { id: '/edge-nodes', icon: Cpu, label: t('sidebar.edge_nodes') },
          { id: '/mqtt-gateway', icon: Wifi, label: t('sidebar.mqtt_gateway') },
          { id: '/builder', icon: Code, label: t('sidebar.builder') },
          { id: '/system-health', icon: ShieldAlert, label: t('sidebar.system_health') },
        ]
      },
      {
        group: t('sidebar.administration'),
        items: [
          { id: '/users', icon: Settings, label: t('sidebar.users') },
          { id: '/security', icon: ShieldAlert, label: t('sidebar.security') },
          { id: '/billing', icon: Activity, label: t('sidebar.billing') },
        ]
      },
      {
        group: t('sidebar.system'),
        items: [
          { id: '/settings', icon: Settings, label: t('sidebar.settings') },
          { id: '/settings/info', icon: Info, label: t('sidebar.connection_info') },
          { id: '/settings/pinout', icon: Cpu, label: t('sidebar.pinout') },
          { id: '/settings/matter', icon: Plus, label: t('sidebar.matter') },
          { id: '/developer', icon: Code, label: t('sidebar.developer') },
          { id: '/marketplace', icon: Plus, label: t('sidebar.marketplace') },
          { id: '/advanced-security', icon: ShieldAlert, label: t('sidebar.advanced_security') },
        ]
      }
    ])
  ];

  const activeSidebarConfig = isSimple ? simpleSidebarConfig : fullSidebarConfig;

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Branding Header */}
      <div className="p-5 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)] border border-white/10">
            <Cpu size={20} className="text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-black text-white tracking-tight">MOSA Smart</h1>
            <span className="text-[10px] text-cyan-400 font-bold">
              {isSimple ? t('sidebar.family_mode') : t('sidebar.tech_mode')}
            </span>
          </div>
        </div>

        {/* Close Button on Mobile Drawer */}
        <button 
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Close Sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Links Scroll Container */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        {activeSidebarConfig.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.group && (
              <h2 className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400/80 mb-1.5">
                {section.group}
              </h2>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.id;
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.id}
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setSidebarOpen(false);
                      }
                    }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all group ${
                      active
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-black'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    <IconComponent
                      size={18}
                      className={`transition-colors shrink-0 ${
                        active ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-300'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                    {active && (
                      <span className="ltr:ml-auto rtl:mr-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Area: Mode Switcher & Connectivity */}
      <div className="p-3.5 space-y-2.5 border-t border-white/10 bg-black/20 shrink-0">
        {/* 🔄 UI Mode Switcher */}
        <button 
          onClick={toggleUiMode}
          className={`w-full p-2.5 rounded-2xl border transition-all flex items-center justify-between shadow-lg ${
            isSimple 
              ? 'bg-gradient-to-r from-blue-600/20 to-cyan-500/20 border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30' 
              : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
          }`}
          title={t('sidebar.click_to_switch')}
        >
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-xl border ${isSimple ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-white/10 border-white/10 text-slate-400'}`}>
              <SlidersHorizontal size={13} />
            </div>
            <div className="text-start">
              <span className="text-[11px] font-black text-white block">
                {isSimple ? t('sidebar.family_mode') : t('sidebar.tech_mode')}
              </span>
              <span className="text-[9px] text-slate-400">{t('sidebar.click_to_switch')}</span>
            </div>
          </div>
          <span className={`w-2 h-2 rounded-full ${isSimple ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-500'}`} />
        </button>

        {/* Connectivity Status & Language Switch */}
        <div className="bg-white/5 rounded-2xl px-3 py-2 flex items-center justify-between border border-white/5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} />
            <span className="text-slate-300 font-bold">{isConnected ? t('sidebar.connected') : t('sidebar.disconnected')}</span>
          </div>
          <button 
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="text-[10px] font-black text-cyan-400 hover:text-cyan-300 px-2 py-1 bg-white/5 rounded-lg border border-white/10"
          >
            {language === 'ar' ? 'English' : 'عربي'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (>= lg: 1024px) */}
      <aside className="hidden lg:flex w-64 xl:w-72 flex-col relative z-20 m-4 rounded-3xl glass-panel overflow-hidden shadow-2xl transition-all duration-300 bg-[#0d1322]/95 border border-white/10 shrink-0">
        {renderSidebarContent()}
      </aside>

      {/* Mobile & Tablet Slide-Over Drawer (< lg: 1024px) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Slide-over Panel */}
            <motion.aside
              initial={{ x: language === 'ar' ? 300 : -300 }}
              animate={{ x: 0 }}
              exit={{ x: language === 'ar' ? 300 : -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-72 max-w-[85vw] h-full bg-[#0d1322] border-r border-white/10 shadow-2xl z-10 flex flex-col"
            >
              {renderSidebarContent()}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
