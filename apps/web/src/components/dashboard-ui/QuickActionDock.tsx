"use client";

import { motion } from 'framer-motion';
import { PowerOff, Moon, Film, Sun } from 'lucide-react';

export function QuickActionDock() {
  const actions = [
    { id: 'off', icon: PowerOff, label: 'إطفاء الكل', color: 'text-red-500 hover:bg-red-500/20' },
    { id: 'sleep', icon: Moon, label: 'النوم', color: 'text-indigo-400 hover:bg-indigo-500/20' },
    { id: 'movie', icon: Film, label: 'السينما', color: 'text-purple-400 hover:bg-purple-500/20' },
    { id: 'morning', icon: Sun, label: 'الصباح', color: 'text-amber-400 hover:bg-amber-500/20' },
  ];

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, type: 'spring' }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
    >
      <div className="bg-[#121826]/80 backdrop-blur-2xl border border-white/10 p-2 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button 
              key={action.id}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all ${action.color} group`}
            >
              <Icon size={24} className="mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-2">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
