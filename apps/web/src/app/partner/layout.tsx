'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Paintbrush, Settings, LogOut, ArrowRight, ShieldCheck } from 'lucide-react';

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'نظرة عامة والتحليلات', href: '/partner', icon: LayoutDashboard },
    { name: 'إدارة العقارات والمنازل', href: '/partner/tenants', icon: Users },
    { name: 'الهوية البصرية والشعار', href: '/partner/branding', icon: Paintbrush },
    { name: 'إعدادات العضوية والأمان', href: '/partner/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-white font-sans dir-rtl" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950/90 border-l border-white/10 flex flex-col backdrop-blur-2xl shrink-0">
        
        {/* Brand Header */}
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-cyan-500/20">
            M
          </div>
          <div>
            <h1 className="text-base font-black tracking-wide text-white">
              بوابة الشركاء المتقدمة
            </h1>
            <p className="text-[10px] text-cyan-400 font-mono">B2B Management Portal</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-xs ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span className="flex-1 text-right">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Link to Dashboard */}
        <div className="p-4 border-t border-white/10">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-cyan-300 hover:bg-white/5 rounded-2xl transition-all text-xs font-bold border border-transparent hover:border-white/10"
          >
            <ArrowRight className="w-4 h-4 text-cyan-400" />
            <span>العودة للوحة التحكم الرئيسية</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Body */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-6 bg-gradient-to-b from-[#0a0f1e] via-[#0d1427] to-[#0a0f1e]">
        {children}
      </main>
    </div>
  );
}
