"use client";

import { useSmartHome } from '@/hooks/useSmartHome';
import dynamic from 'next/dynamic';

import { EnergySidebar } from '@/components/dashboard-ui/EnergySidebar';

const EnergyMonitor = dynamic(() => import('@/components/EnergyMonitor').then(mod => mod.EnergyMonitor), { 
  ssr: false,
  loading: () => <div className="h-96 w-full animate-pulse bg-white/5 rounded-3xl" />
});

export default function EnergyPage() {
  const { globalData, powerHistory } = useSmartHome();
  
  return (
    <div className="p-6 md:p-10 pb-28 md:pb-10 h-full relative flex flex-col xl:flex-row gap-6">
      <div className="flex-1">
        <EnergyMonitor globalData={globalData} powerHistory={powerHistory} />
      </div>
      <div className="w-full xl:w-96 flex-shrink-0">
        <EnergySidebar />
      </div>
    </div>
  );
}
