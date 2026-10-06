'use client';

import Link from 'next/link';
import { OTADashboard } from '@/components/dashboard-ui/OTADashboard';
import { Cpu, RefreshCw } from 'lucide-react';
import { useRuntimeStore } from '@/store/useRuntimeStore';

export default function OTAPage() {
  const lang = useRuntimeStore(s => s.lang);
  const isEn = lang === 'en';

  return (
    <div className="p-6 md:p-10 pb-28 md:pb-10 h-full relative space-y-6" dir={isEn ? 'ltr' : 'rtl'}>
      {/* Top Header Switcher */}
      <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 w-fit">
        <Link 
          href="/ota" 
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all"
        >
          <Cpu size={16} />
          {isEn ? 'Firmware OTA' : 'سوفتوير الأجهزة (Firmware OTA)'}
        </Link>
        <Link 
          href="/settings/ota" 
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-bold text-xs transition-all"
        >
          <RefreshCw size={16} />
          {isEn ? 'MOSA OS Engine' : 'تحديث المنصة (MOSA OS Engine)'}
        </Link>
      </div>

      <OTADashboard />
    </div>
  );
}
