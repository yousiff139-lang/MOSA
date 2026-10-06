'use client';

import { useAuthStore } from '@/store/auth.store';
import { useRouter, usePathname } from 'next/navigation';
import { Cpu, Home, Server, Layers, Settings, LogOut, Menu, BarChart, Wifi, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { initTheme } from '@/lib/theme';
import { useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    initTheme();
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const menuItems = [
    { name: 'الرئيسية', path: '/dashboard', icon: <Home size={20} /> },
    { name: 'اكتشاف الأجهزة', path: '/discovery', icon: <Wifi size={20} /> },
    { name: 'الأجهزة', path: '/dashboard/devices', icon: <Server size={20} /> },
    { name: 'السيناريوهات', path: '/dashboard/scenes', icon: <Layers size={20} /> },
    { name: 'الأتمتة', path: '/dashboard/automations', icon: <Cpu size={20} /> },
    { name: 'التكييف', path: '/dashboard/climate', icon: <Server size={20} /> },
    { name: 'مراقبة الطاقة', path: '/energy', icon: <Zap size={20} /> },
    { name: 'سجل الحركة', path: '/dashboard/motion', icon: <Server size={20} /> },
    { name: 'التقارير', path: '/dashboard/reports', icon: <BarChart size={20} /> },
    { name: 'المخطط', path: '/dashboard/floorplan', icon: <Server size={20} /> },
    { name: 'إعدادات النظام', path: '/settings', icon: <Settings size={20} /> },
    { name: 'إدارة الأعضاء', path: '/settings/members', icon: <Settings size={20} /> },
    { name: 'هوية المنصة', path: '/settings/branding', icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-[#030712] glow-bg text-zinc-100 font-sans" dir="rtl">
      
      <aside className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col ${isCollapsed ? 'w-[88px]' : 'w-64'} glass-panel m-4 rounded-3xl border border-white/10 shadow-2xl overflow-hidden z-50 transition-all duration-300 absolute md:relative h-[calc(100vh-2rem)]`}>
        <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-3`}>
          <div className="flex items-center gap-3">
            <Cpu className="text-white w-8 h-8 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] flex-shrink-0" />
            {!isCollapsed && <h1 className="text-xl font-bold tracking-tight text-white">MOSA</h1>}
          </div>
          {!isCollapsed && (
            <button className="hidden md:block text-zinc-400 hover:text-white transition-colors" onClick={() => setIsCollapsed(true)}>
              <Menu size={20} />
            </button>
          )}
          {isCollapsed && (
            <button className="hidden md:block absolute -right-3 top-7 bg-blue-600 rounded-full p-1 text-white shadow-lg z-50" onClick={() => setIsCollapsed(false)}>
              <Menu size={16} />
            </button>
          )}
          <button className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(false)}>
            &times;
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-4 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} onClick={() => setIsMobileMenuOpen(false)}>
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`} title={isCollapsed ? item.name : undefined}>
                  <div className={isActive ? 'drop-shadow-[0_0_8px_currentColor]' : ''}>{item.icon}</div>
                  {!isCollapsed && <span className="font-medium whitespace-nowrap">{item.name}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 bg-[#0a0f1e]/50">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2`}>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{user?.username || 'المسؤول'}</p>
                <p className="text-xs text-zinc-400">{user?.role}</p>
              </div>
            )}
            <button onClick={handleLogout} className="text-zinc-400 hover:text-red-400 transition-colors p-2 rounded-xl hover:bg-red-500/10 flex-shrink-0" title={isCollapsed ? 'تسجيل الخروج' : undefined}>
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 glass-panel border-b border-white/10">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="text-zinc-100" />
            </button>
            <h1 className="text-lg font-bold text-white">MOSA</h1>
          </div>
          <button onClick={handleLogout} className="text-zinc-400">
             <LogOut size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
