// apps/web/src/components/BottomNav.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Cpu, Sparkles, Settings } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navItems = [
    { href: '/',         icon: Home,     label: t('home') },
    { href: '/devices',  icon: Cpu,      label: t('devices') },
    { href: '/scenes',   icon: Sparkles, label: t('scenes') },
    { href: '/settings', icon: Settings, label: t('settings') },
  ];

  if (pathname?.startsWith('/auth') || pathname?.startsWith('/setup')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#11151c]/95 backdrop-blur border-t border-white/5 md:hidden z-50 shadow-2xl safe-bottom" dir="rtl">
      <div className="flex justify-around py-2">
        {navItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${
                isActive ? 'text-[#00f0ff]' : 'text-gray-400 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-bold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
