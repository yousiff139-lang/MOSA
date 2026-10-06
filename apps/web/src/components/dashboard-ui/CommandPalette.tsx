"use client";
import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { Search, Lightbulb, Activity, Home, Zap, Server } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (pathname?.startsWith('/auth') || pathname?.startsWith('/setup')) {
    return null;
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" dir="rtl">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full max-w-xl mx-4 bg-[#11141c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <Command className="w-full text-white bg-transparent" loop>
              <div className="flex items-center px-4 border-b border-white/10">
                <Search size={20} className="text-gray-400 ml-3" />
                <Command.Input 
                  placeholder="ابحث عن جهاز، صفحة، أو أمر... (مثال: أطفئ كل شيء)" 
                  className="w-full bg-transparent text-white placeholder:text-gray-500 py-5 outline-none font-medium text-lg"
                />
              </div>

              <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
                <Command.Empty className="py-6 text-center text-sm text-gray-500">لا توجد نتائج.</Command.Empty>

                <Command.Group heading="تحكم سريع (Quick Actions)" className="px-2 text-xs text-gray-500 font-medium mb-1 mt-2">
                  <Command.Item 
                    onSelect={() => runCommand(() => alert('تم إطفاء كل الإضاءة!'))}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer aria-selected:bg-white/10 aria-selected:text-white transition-colors text-sm text-gray-300"
                  >
                    <Lightbulb size={16} className="text-amber-400" /> إطفاء جميع الإضاءة
                  </Command.Item>
                  <Command.Item 
                    onSelect={() => runCommand(() => alert('تم تفعيل وضع السينما!'))}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer aria-selected:bg-white/10 aria-selected:text-white transition-colors text-sm text-gray-300"
                  >
                    <Zap size={16} className="text-blue-400" /> تفعيل وضع "ليلة سينمائية"
                  </Command.Item>
                </Command.Group>

                <div className="h-px bg-white/10 my-2 mx-2" />

                <Command.Group heading="انتقال سريع (Navigation)" className="px-2 text-xs text-gray-500 font-medium mb-1">
                  <Command.Item 
                    onSelect={() => runCommand(() => router.push('/dashboard'))}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer aria-selected:bg-white/10 aria-selected:text-white transition-colors text-sm text-gray-300"
                  >
                    <Home size={16} /> لوحة التحكم (Dashboard)
                  </Command.Item>
                  <Command.Item 
                    onSelect={() => runCommand(() => router.push('/automations/flow'))}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer aria-selected:bg-white/10 aria-selected:text-white transition-colors text-sm text-gray-300"
                  >
                    <Activity size={16} /> الأتمتة البصرية (Flow)
                  </Command.Item>
                  <Command.Item 
                    onSelect={() => runCommand(() => router.push('/superadmin'))}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer aria-selected:bg-white/10 aria-selected:text-white transition-colors text-sm text-gray-300"
                  >
                    <Server size={16} className="text-red-400" /> شاشة الإدارة العليا (God Mode)
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
