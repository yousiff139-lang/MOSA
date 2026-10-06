"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radio, Mic, Tag, Zap, Moon, X, Sparkles, Volume2, ShieldCheck, Check
} from 'lucide-react';
import Link from 'next/link';
import { SmartIntercom } from '@/components/dashboard/SmartIntercom';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { mosaSound, speakMosaVoice } from '@/lib/mosaVoice';

export default function MobileQuickDock() {
  const [isIntercomOpen, setIsIntercomOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optToast, setOptToast] = useState<string | null>(null);

  const handleQuickOptimize = async () => {
    setIsOptimizing(true);
    mosaSound.playSuccessChime();
    try {
      const res = await fetchAuth('/api/ai/optimize-energy', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setOptToast(data.message || 'تم ترشيد الطاقة بنجاح ⚡');
        speakMosaVoice('تم ترشيد الطاقة وإطفاء الأحمال غير المشغولة');
        setTimeout(() => setOptToast(null), 4000);
      }
    } catch {} finally {
      setIsOptimizing(false);
    }
  };

  const handleQuickSleep = async () => {
    mosaSound.playSuccessChime();
    try {
      const res = await fetchAuth('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'تفعيل وضع النوم' })
      });
      const data = await res.json();
      setOptToast('تم تفعيل وضع النوم الهادئ 🌙✨');
      speakMosaVoice(data.reply_arabic || 'تم تفعيل وضع النوم، أحلاماً سعيدة');
      setTimeout(() => setOptToast(null), 4000);
    } catch {}
  };

  return (
    <>
      {/* Toast Notification */}
      <AnimatePresence>
        {optToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-bold px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-2 max-w-sm text-center"
            dir="rtl"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
            <span>{optToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Dynamic Bottom Action Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] sm:w-auto font-sans" dir="rtl">
        <div className="bg-slate-950/85 border border-slate-800/80 backdrop-blur-2xl rounded-full p-2 shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex items-center justify-between gap-1.5 ring-1 ring-white/10">
          
          {/* 1. Intercom Button */}
          <button
            onClick={() => setIsIntercomOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-800"
            title="إنتركم وبث صوتي"
          >
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">الإنتركم</span>
          </button>

          {/* 2. NFC Studio Button */}
          <Link
            href="/nfc"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-800"
            title="ملصقات NFC الذكية"
          >
            <Tag className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">NFC</span>
          </Link>

          {/* 3. Center Voice AI Link */}
          <Link
            href="/ai"
            className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 text-white shadow-lg shadow-cyan-500/30 hover:scale-105 transition-transform"
            title="مساعد الذكاء الاصطناعي (MOSA AI)"
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
          </Link>

          {/* 4. Instant Eco Saver */}
          <button
            onClick={handleQuickOptimize}
            disabled={isOptimizing}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition-all border border-slate-800 disabled:opacity-50"
            title="ترشيد الطاقة الفوري"
          >
            <Zap className={`w-4 h-4 text-emerald-400 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">ترشيد</span>
          </button>

          {/* 5. Quick Sleep Mode */}
          <button
            onClick={handleQuickSleep}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-indigo-300 hover:text-indigo-200 text-xs font-bold transition-all border border-slate-800"
            title="وضع النوم السريع"
          >
            <Moon className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">نوم</span>
          </button>
        </div>
      </div>

      {/* Multi-Room Intercom Modal */}
      <AnimatePresence>
        {isIntercomOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div className="max-w-xl w-full relative">
              <button
                onClick={() => setIsIntercomOpen(false)}
                className="absolute -top-12 left-0 p-2 bg-slate-800 text-slate-300 hover:text-white rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <SmartIntercom />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
