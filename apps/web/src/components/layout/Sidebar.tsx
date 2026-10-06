"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import { useTranslation } from '@/hooks/useTranslation';
import * as Icons from 'lucide-react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';


// Structured feature list by logical categories
const FULL_FEATURES_LIST = [
  // Category 1: Workspace & Dashboard
  { title: "sidebar.header.dashboard", isHeader: true, icon: "LayoutDashboard", badgeColor: "from-blue-500 to-cyan-500" },
  { title: "sidebar.dashboard", href: "/", icon: "Home" },
  { title: "sidebar.floorplan", href: "/floorplan", icon: "Layers" },
  { title: "sidebar.watch_mode", href: "/watch", icon: "Smartphone" },

  // Category 2: Smart Devices & Control
  { title: "sidebar.header.devices", isHeader: true, icon: "Cpu", badgeColor: "from-emerald-500 to-teal-500" },
  { title: "sidebar.devices", href: "/devices", icon: "Cpu" },
  { title: "sidebar.rooms", href: "/rooms", icon: "Grid" },
  { title: "sidebar.lighting_curtains", href: "/lighting", icon: "Lightbulb" },
  { title: "sidebar.climate", href: "/appliances", icon: "Thermometer" },
  { title: "sidebar.smart_tv", href: "/tv", icon: "Tv" },
  { title: "sidebar.audio_speakers", href: "/audio", icon: "Volume2" },
  { title: "sidebar.locks_cameras", href: "/security", icon: "Camera" },
  { title: "sidebar.irrigation_pumps", href: "/irrigation", icon: "Droplets" },
  { title: "sidebar.discovery", href: "/discovery", icon: "Search" },
  { title: "sidebar.registry", href: "/devices/registry", icon: "Layers" },

  // Category 3: Artificial Intelligence & Automations
  { title: "sidebar.header.intelligence", isHeader: true, icon: "Sparkles", badgeColor: "from-purple-500 to-pink-500" },
  { title: "sidebar.ai_assistant", href: "/ai", icon: "Sparkles" },
  { title: "ملصقات NFC الذكية", href: "/nfc", icon: "Radio" },
  { title: "sidebar.blueprints", href: "/automations/blueprints", icon: "BookOpen" },
  { title: "sidebar.automations", href: "/automations", icon: "Server" },
  { title: "sidebar.scenes", href: "/scenes", icon: "Puzzle" },
  { title: "sidebar.node_builder", href: "/automations/flow", icon: "GitMerge" },

  // Category 4: Analytics & Energy Reports
  { title: "sidebar.header.analytics", isHeader: true, icon: "BarChart3", badgeColor: "from-amber-500 to-orange-500" },
  { title: "sidebar.energy", href: "/analytics", icon: "Zap" },
  { title: "sidebar.logs", href: "/logs", icon: "Activity" },
  { title: "sidebar.reports", href: "/reports", icon: "BarChart3" },

  // Category 5: Infrastructure & Firmware OTA
  { title: "sidebar.header.infrastructure", isHeader: true, icon: "Network", badgeColor: "from-indigo-500 to-blue-600" },
  { title: "sidebar.edge_nodes", href: "/infrastructure/nodes", icon: "Server" },
  { title: "sidebar.zigbee", href: "/zigbee", icon: "Radio" },
  { title: "sidebar.network_topology", href: "/infrastructure/topology", icon: "Network" },
  { title: "sidebar.mqtt_gateway", href: "/infrastructure/mqtt", icon: "Radio" },
  { title: "sidebar.system_health", href: "/infrastructure/health", icon: "Activity" },
  { title: "sidebar.esp_flasher", href: "/flasher", icon: "Terminal" },
  { title: "sidebar.firmware_ota", href: "/ota", icon: "Cpu" },
  { title: "sidebar.mosa_os", href: "/settings/ota", icon: "RefreshCw" },

  // Category 6: Administration & System Settings
  { title: "sidebar.header.administration", isHeader: true, icon: "Shield", badgeColor: "from-rose-500 to-red-600" },
  { title: "sidebar.users", href: "/admin/users", icon: "Users" },
  { title: "sidebar.member_permissions", href: "/settings/members", icon: "Shield" },
  { title: "sidebar.matter_integrations", href: "/settings/matter", icon: "Globe" },
  { title: "sidebar.developer_tools", href: "/developer", icon: "Code" },
  { title: "sidebar.api_keys", href: "/settings/api-keys", icon: "Key" },
  { title: "sidebar.billing", href: "/billing", icon: "CreditCard" },
  { title: "sidebar.system_runtime", href: "/admin/runtime", icon: "Sliders" },
  { title: "sidebar.security", href: "/admin/security", icon: "ShieldCheck" },
  { title: "sidebar.marketplace", href: "/settings/plugins", icon: "Puzzle" },
  { title: "sidebar.connection_info", href: "/settings/info", icon: "Info" },
  { title: "sidebar.esp_pinout", href: "/settings/pinout", icon: "Cpu" },
  { title: "sidebar.settings", href: "/settings", icon: "Settings" },
  { title: "sidebar.help_support", href: "/help", icon: "HelpCircle" },
  { title: "sidebar.partner_portal", href: "/partner", icon: "Briefcase", role: "SUPER_OWNER" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { isSidebarOpen, setSidebarOpen } = useRuntimeStore();
  const user = useSmartHomeStore(state => state.user);
  const branding = useSmartHomeStore(state => state.branding);
  const performanceMode = useSmartHomeStore(state => state.performanceMode);
  const setPerformanceMode = useSmartHomeStore(state => state.setPerformanceMode);

  // Search filter query
  const [searchQuery, setSearchQuery] = useState('');

  // Default open sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "sidebar.header.dashboard": true,
    "sidebar.header.devices": true,
    "sidebar.header.intelligence": true,
    "sidebar.header.analytics": false,
    "sidebar.header.infrastructure": false,
    "sidebar.header.administration": false
  });

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // Group features by header and apply search filter
  const groupedFeatures = useMemo(() => {
    const groups: { header: any, items: any[] }[] = [];
    let currentGroup: any = null;

    const userRole = (user?.role || '').toUpperCase();
    const isSuperAdminOrOwner = userRole === 'SUPER_OWNER' || userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'DEVELOPER';
    const isRestrictedUser = userRole === 'RESTRICTED' || userRole === 'GUEST' || userRole === 'BLOCKED';

    const sectionPermissions = (user as any)?.sectionPermissions || (user as any)?.restrictions?.sectionPermissions || {
      workspace: true,
      lighting: true,
      climate: true,
      security: false,
      irrigation: false,
      automations: false,
      energy: true,
      infrastructure: false,
      system: false
    };

    const query = searchQuery.trim().toLowerCase();

    FULL_FEATURES_LIST.forEach(item => {
      if (item.isHeader) {
        if (currentGroup && currentGroup.items.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = { header: item, items: [] };
      } else {
        if (!currentGroup) return;

        // 🛡️ STRICT ROLE-BASED ACCESS CONTROL (RBAC)
        // Technical, Firmware Flasher, OTA, MQTT, and System Administration are strictly hidden from non-admin Family Members
        if (!isSuperAdminOrOwner) {
          // Hide Category 5 (Infrastructure & Firmware OTA) completely from Family Members
          if (currentGroup.header.title === "sidebar.header.infrastructure") return;

          // Technical routes in other categories hidden from Family Members
          const technicalPaths = [
            '/flasher', '/ota', '/settings/ota', '/developer', 
            '/admin/users', '/settings/members', '/settings/matter', 
            '/settings/api-keys', '/billing', '/admin/runtime', 
            '/admin/security', '/settings/pinout', '/discovery', 
            '/devices/registry', '/automations/flow', '/logs'
          ];
          if (technicalPaths.some(p => item.href === p || item.href?.startsWith(`${p}/`))) return;
        }

        // Specific item role restriction
        if (item.role && userRole !== item.role) return;

        // Restricted User Permissions Check
        if (isRestrictedUser) {
          if (currentGroup.header.title === "sidebar.header.dashboard" && sectionPermissions.workspace === false) return;
          if (currentGroup.header.title === "sidebar.header.infrastructure" && !sectionPermissions.infrastructure) return;
          if (currentGroup.header.title === "sidebar.header.administration" && !sectionPermissions.system) return;

          if (item.href === '/lighting' && sectionPermissions.lighting === false) return;
          if (item.href === '/appliances' && sectionPermissions.climate === false) return;
          if (item.href === '/security' && !sectionPermissions.security) return;
          if (item.href === '/irrigation' && !sectionPermissions.irrigation) return;
          if ((item.href === '/analytics' || item.href === '/reports' || item.href === '/logs') && sectionPermissions.energy === false) return;
          if ((item.href === '/automations' || item.href === '/automations/flow' || item.href === '/scenes' || item.href === '/ai') && !sectionPermissions.automations) return;
        }

        // Search text matching
        if (query) {
          const itemText = t(item.title).toLowerCase();
          const headerText = t(currentGroup.header.title).toLowerCase();
          if (!itemText.includes(query) && !headerText.includes(query)) return;
        }

        currentGroup.items.push(item);
      }
    });

    if (currentGroup && currentGroup.items.length > 0) {
      groups.push(currentGroup);
    }
    return groups;
  }, [user, searchQuery, t]);

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <aside className={`flex flex-col bg-[#080d1a] border-white/10 border shadow-[0_0_50px_rgba(0,0,0,0.8)] fixed inset-y-0 right-0 z-50 h-full my-0 w-[85vw] max-w-[320px] rounded-l-3xl rounded-r-none lg:rounded-[2rem] lg:my-4 lg:relative lg:h-[calc(100vh-2rem)] lg:z-40 transition-all duration-300 shrink-0 overflow-hidden ${
        isSidebarOpen 
          ? 'translate-x-0 opacity-100 lg:w-[305px] lg:mx-4 pointer-events-auto' 
          : 'translate-x-full lg:translate-x-0 lg:w-0 opacity-0 m-0 border-0 p-0 pointer-events-none'
      }`}>
        
        {/* Sidebar Header / Branding */}
        <div className="p-4 border-b border-white/5" dir="rtl">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-cyan-500/10 border border-white/10 shadow-lg hover:border-blue-500/30 transition-all duration-300">
             <div className="flex items-center gap-3 min-w-0">
               {branding?.logoUrl ? (
                 <img src={branding.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-xl shadow-lg shrink-0 border border-white/10" />
               ) : (
                 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-white/20 shrink-0">
                    <Icons.Command size={22} className="animate-pulse" />
                 </div>
               )}
               <div className="flex flex-col min-w-0">
                 <span className="text-white text-sm font-black tracking-wide truncate">{branding?.platformName || 'Mosa Smart Platform'}</span>
                 <span className="text-[9px] text-cyan-400 font-black uppercase tracking-widest mt-0.5">ENTERPRISE IOT ENGINE</span>
               </div>
             </div>
             <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10 shrink-0">
               <Icons.X size={22} />
             </button>
          </div>
        </div>

        {/* Quick Filter Search Bar */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative flex items-center">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث في القائمة..."
              dir="rtl"
              className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-blue-500/50 rounded-xl py-2.5 pr-10 pl-8 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-right font-medium"
            />
            <Icons.Search size={15} className="absolute right-3.5 text-white/40 pointer-events-none" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-3 text-white/40 hover:text-white transition-colors"
              >
                <Icons.X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-2.5" dir="rtl">
          {groupedFeatures.map((group, index) => {
            if (group.items.length === 0) return null;
            
            // Auto open sections when searching
            const isOpen = searchQuery ? true : openSections[group.header.title];
            const HeaderIcon = group.header.icon ? (Icons as any)[group.header.icon] : Icons.ChevronRight;
            
            return (
              <div key={`group-${index}`} className="flex flex-col bg-white/[0.015] border border-white/[0.03] rounded-2xl p-1.5 transition-all">
                {/* Accordion Category Header */}
                <button 
                  onClick={() => toggleSection(group.header.title)}
                  className="flex items-center justify-between w-full text-white/70 hover:text-white transition-colors px-3 py-2.5 rounded-xl group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {HeaderIcon && (
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${group.header.badgeColor || 'from-blue-500 to-indigo-500'} flex items-center justify-center text-white shadow-sm shrink-0`}>
                        <HeaderIcon size={13} />
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-100 tracking-wide truncate text-right">
                      {t(group.header.title)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      {group.items.length}
                    </span>
                    <Icons.ChevronDown size={14} className={`text-white/40 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-400' : ''}`} />
                  </div>
                </button>
                
                {/* Category Items List */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden space-y-1 pt-1"
                    >
                      {group.items.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href || ''));
                        const IconComponent = item.icon ? (Icons as any)[item.icon] : null;

                        return (
                           <Link 
                             key={item.title} 
                             href={item.comingSoon ? '#' : (item.href || '#')}
                             onClick={() => {
                               if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                                 setSidebarOpen(false);
                               }
                             }}
                             style={isActive && !item.comingSoon ? {
                               backgroundColor: 'var(--primary-dark-bg)',
                               borderColor: 'var(--primary-glow)',
                               boxShadow: '0 0 15px var(--primary-glow)'
                             } : {}}
                             className={`group/item relative flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-300 border ${
                               isActive && !item.comingSoon
                                 ? 'text-white border' 
                                 : 'border-transparent text-slate-300 hover:text-white hover:bg-white/[0.05]'
                             }`}
                           >
                             {isActive && !item.comingSoon && (
                               <div 
                                 className="absolute right-0 top-1.5 bottom-1.5 w-1 rounded-full shadow-lg"
                                 style={{ backgroundColor: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }}
                                />
                             )}
                             <div className="flex items-center gap-3 min-w-0">
                               {IconComponent && (
                                 <IconComponent 
                                   size={18} 
                                   style={isActive && !item.comingSoon ? { color: 'var(--primary)', filter: 'drop-shadow(0 0 6px var(--primary-glow))' } : {}}
                                   className={`transition-all duration-200 shrink-0 ${isActive && !item.comingSoon ? '' : 'text-slate-400 group-hover/item:scale-110 group-hover/item:text-slate-100'}`} 
                                   strokeWidth={2}
                                 />
                               )}
                               <span className={`font-medium text-xs leading-normal text-right truncate ${isActive && !item.comingSoon ? 'text-white font-bold' : ''}`}>
                                 {t(item.title)}
                               </span>
                             </div>
                             {item.comingSoon && (
                               <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 shrink-0">
                                 قريباً
                               </span>
                             )}
                           </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* User Profile Footer Card - Aligned exactly like TopBar */}
        {user && (
          <div className="mx-3 mb-2 p-3 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-cyan-500/10 border border-white/10 rounded-2xl flex items-center justify-between hover:border-cyan-500/40 hover:bg-white/[0.06] transition-all duration-300 cursor-pointer shadow-md group" dir="rtl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] border border-white/20 font-black text-sm shrink-0 group-hover:scale-105 transition-transform duration-300">
                {(user.name || user.username || 'U')[0].toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-white text-sm font-bold truncate leading-none mb-1">
                  {user.name || user.username}
                </span>
                <span className="text-[9px] text-cyan-400 font-black uppercase tracking-wider">
                  {user.role === 'SUPER_OWNER' ? 'المالك الرئيسي' :
                   user.role === 'ADMIN' ? 'مسؤول (ADMIN)' :
                   user.role === 'MEMBER' ? 'عضو (MEMBER)' :
                   user.role === 'RESTRICTED' ? 'مستخدم مقيد' :
                   user.role === 'GUEST' ? 'زائر (GUEST)' :
                   user.role || 'مستخدم'}
                </span>
              </div>
            </div>
            <Icons.ChevronLeft size={16} className="text-white/30 group-hover:text-cyan-400 group-hover:-translate-x-1 transition-all shrink-0" />
          </div>
        )}

        {/* Power Mode & Logout Controls */}
        <div className="p-3.5 border-t border-white/5 bg-[#060a14] flex flex-col gap-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]" dir="rtl">
          <div className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                performanceMode === 'normal' 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {performanceMode === 'normal' ? <Icons.Sparkles size={14} /> : <Icons.Leaf size={14} />}
              </div>
              <div className="flex flex-col">
                <span className="text-white text-xs font-bold">نمط الأداء والمظهر</span>
                <span className="text-[10px] font-bold mt-0.5 flex items-center gap-1">
                  {performanceMode === 'normal' ? (
                    <span className="text-cyan-300">الوضع العالي (مظهر فاخر)</span>
                  ) : (
                    <span className="text-emerald-400">توفير الطاقة (أقل جهد)</span>
                  )}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => {
                const nextMode = performanceMode === 'eco' ? 'normal' : 'eco';
                setPerformanceMode(nextMode);
                if (typeof window !== 'undefined') localStorage.setItem('performanceMode', nextMode);
              }}
              title={performanceMode === 'normal' ? 'التبديل إلى وضع توفير الطاقة' : 'التبديل إلى الوضع العالي الفاخر'}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors relative flex items-center cursor-pointer shadow-inner ${
                performanceMode === 'normal' 
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 justify-end' 
                  : 'bg-emerald-600 justify-start'
              }`}
            >
              <div className="w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-transform">
                {performanceMode === 'normal' ? (
                  <Icons.Sparkles className="text-blue-600" size={10} />
                ) : (
                  <Icons.Leaf className="text-emerald-700" size={10} />
                )}
              </div>
            </button>
          </div>

          <button
            onClick={() => {
              setSidebarOpen(false);
              const pwaBtn = document.getElementById('pwa-install-btn');
              if (pwaBtn) pwaBtn.click();
            }}
            className="w-full mb-2 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 text-blue-300 border border-blue-500/30 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-98"
          >
            <Icons.Smartphone size={15} className="text-blue-400" />
            <span>تثبيت التطبيق على الهاتف (PWA)</span>
          </button>

          <button
            onClick={async () => {
              if (typeof window !== 'undefined') {
                try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('mosa_user');
                localStorage.removeItem('mosa_ui_mode');
                document.cookie = 'token=; Max-Age=0; path=/;';
                document.cookie = 'access_token=; Max-Age=0; path=/;';
                window.location.href = '/auth/login';
              }
            }}
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Icons.LogOut size={14} />
            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}
