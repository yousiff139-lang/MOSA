"use client";

import { useState } from 'react';
import { Responsive } from 'react-grid-layout';
// @ts-expect-error - WidthProvider namespace typings mismatch
import { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useTranslation } from '@/hooks/useTranslation';
import { Settings, Lock } from 'lucide-react';

const ResponsiveGridLayout = WidthProvider(Responsive);

export function DynamicDashboardBuilder({ initialLayouts = {}, widgets = [] }: { initialLayouts?: any, widgets?: any[] }) {
  const { t } = useTranslation();
  const [layouts, setLayouts] = useState(initialLayouts);
  const [isEditing, setIsEditing] = useState(false);

  const onLayoutChange = (layout: any, layouts: any) => {
    setLayouts(layouts);
    // Ideally save to backend or Zustand store here
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4 px-4">
        <h2 className="text-xl font-bold text-white">{t('dashboard.custom_builder')}</h2>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
            isEditing ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10'
          }`}
        >
          {isEditing ? <Lock size={16} /> : <Settings size={16} />}
          {isEditing ? t('dashboard.lock_layout') : t('dashboard.edit_layout')}
        </button>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 4, md: 3, sm: 2, xs: 1, xxs: 1 }}
        rowHeight={150}
        onLayoutChange={onLayoutChange}
        isDraggable={isEditing}
        isResizable={isEditing}
        margin={[16, 16]}
      >
        {widgets.map(widget => (
          <div key={widget.i} className="bg-white/5 rounded-[2.5rem] border border-white/5 backdrop-blur-xl overflow-hidden p-6 relative group">
            {isEditing && (
              <div className="absolute top-0 left-0 w-full h-full bg-black/40 z-10 flex items-center justify-center backdrop-blur-sm cursor-move">
                 <span className="text-white font-bold tracking-widest uppercase">{t('drag_to_move')}</span>
              </div>
            )}
            {/* Widget content rendered here based on widget.type */}
            <div className="text-white/50 flex flex-col items-center justify-center h-full">
               <span className="font-bold">{widget.title}</span>
               <span className="text-xs">{widget.type}</span>
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
