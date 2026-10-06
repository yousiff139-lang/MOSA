'use client';
import { useState } from 'react';
import { Play, Clock, Activity, ArrowDown } from 'lucide-react';

export default function AutomationBuilder() {
  const [blocks, setBlocks] = useState([
    { id: '1', type: 'trigger', title: 'إذا تم رصد حركة', icon: <Activity size={18} /> },
    { id: '2', type: 'condition', title: 'وكان الوقت مساءً', icon: <Clock size={18} /> },
    { id: '3', type: 'action', title: 'شغّل إضاءة الغرفة', icon: <Play size={18} /> },
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">باني الأتمتة البصري (Visual Builder)</h1>
            <p className="text-slate-400 mt-1">قم بسحب وإفلات الشروط لتكوين قواعد ذكية معقدة</p>
          </div>
          <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20">
            حفظ وتفعيل
          </button>
        </header>

        <div className="flex gap-8">
          {/* Sidebar Tools */}
          <div className="w-64 bg-slate-900 border border-slate-800 rounded-2xl p-4 h-[600px] shadow-xl">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">الأدوات (اسحب للإضافة)</h3>
            
            <div className="space-y-3">
              <div className="p-3 border border-dashed border-blue-500/50 bg-blue-500/10 rounded-xl text-blue-300 cursor-grab flex items-center gap-3">
                <Activity size={18} /> <span>حساس حركة (Trigger)</span>
              </div>
              <div className="p-3 border border-dashed border-amber-500/50 bg-amber-500/10 rounded-xl text-amber-300 cursor-grab flex items-center gap-3">
                <Clock size={18} /> <span>شرط زمني (Time)</span>
              </div>
              <div className="p-3 border border-dashed border-purple-500/50 bg-purple-500/10 rounded-xl text-purple-300 cursor-grab flex items-center gap-3">
                <Clock size={18} /> <span>تأخير (Delay)</span>
              </div>
              <div className="p-3 border border-dashed border-emerald-500/50 bg-emerald-500/10 rounded-xl text-emerald-300 cursor-grab flex items-center gap-3">
                <Play size={18} /> <span>تشغيل جهاز (Action)</span>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-12 flex flex-col items-center min-h-[600px] relative overflow-hidden">
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

            {blocks.map((block, idx) => (
              <div key={block.id} className="relative z-10 flex flex-col items-center">
                <div className={`w-80 p-5 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center gap-4 ${
                  block.type === 'trigger' ? 'bg-blue-500/10 border-blue-500/30' :
                  block.type === 'condition' ? 'bg-amber-500/10 border-amber-500/30' :
                  'bg-emerald-500/10 border-emerald-500/30'
                }`}>
                  <div className={`p-2 rounded-xl ${
                    block.type === 'trigger' ? 'bg-blue-500/20 text-blue-400' :
                    block.type === 'condition' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {block.icon}
                  </div>
                  <span className="font-medium text-lg">{block.title}</span>
                </div>
                
                {idx < blocks.length - 1 && (
                  <div className="py-4 text-slate-600 animate-pulse">
                    <ArrowDown size={24} />
                  </div>
                )}
              </div>
            ))}
            
            <div className="mt-8 pt-8 w-80 border-t-2 border-dashed border-slate-800 flex justify-center text-slate-500">
              أفلت كتلة هنا للمتابعة...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
