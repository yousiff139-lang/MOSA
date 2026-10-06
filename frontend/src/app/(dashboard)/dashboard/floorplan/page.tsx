'use client';

import dynamic from 'next/dynamic';
import { Map } from 'lucide-react';

const FloorPlanCanvas = dynamic(() => import('@/components/floorplan/FloorPlanCanvas'), {
  ssr: false,
  loading: () => <div className="h-[700px] bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500">جاري تحميل المخطط...</div>
});

export default function FloorPlanPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <Map className="text-purple-400" size={32} />
          المخطط الهندسي التفاعلي
        </h1>
      </div>
      
      <FloorPlanCanvas />
    </div>
  );
}
