import React from 'react';
import { Providers } from '../../Providers'; // Wait, Providers is wrapped in layout.tsx globally? No, it's inside `src/app/Providers.tsx`. Let's just import global providers if needed.
import { BrandingProvider } from '@/components/BrandingProvider';

export default function RestrictedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black transition-colors duration-500" dir="rtl" style={{ backgroundColor: 'var(--color-bg, #0a0f1e)' }}>
      {/* Top Header */}
      <header className="h-16 glass-effect border-b border-white/5 px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: 'var(--color-primary, #3b82f6)' }}>
            M
          </div>
          <span className="text-white font-bold tracking-wider">منزلك الذكي</span>
        </div>
        <div className="text-sm text-zinc-400">
          وضع الاستخدام المبسط
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 md:p-10 max-w-5xl mx-auto">
        {children}
      </main>
    </div>
  );
}
