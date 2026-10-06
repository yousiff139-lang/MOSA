"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, CheckCircle2, ShieldCheck, Zap, Server, 
  Cpu, Users, Layers, Award, Clock, RefreshCw
} from 'lucide-react';
import { fetchAuth, useSmartHomeStore } from '@/store/useSmartHomeStore';

export default function BillingPage() {
  const router = useRouter();
  const devices = useSmartHomeStore(s => s.devices);
  const [billingStatus, setBillingStatus] = useState<any>({
    status: 'ACTIVE_LIFETIME',
    plan: 'MOSA Enterprise Unlimited',
    maxDevices: 999999,
    isPaid: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuth('/api/billing/status')
      .then(res => res.json())
      .then(data => {
        if (data) setBillingStatus(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto min-h-screen space-y-8 font-sans pb-32" dir="rtl">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/70 border border-emerald-500/30 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-black font-black flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Award size={36} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white">حالة الترخيص والاشتراك</h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black px-3 py-1 rounded-full">
                  رخصة نشطة مدى الحياة ⚡
                </span>
              </div>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">
                المنصة تعمل بنظام المعالجة المحلية المستقلة (Off-Grid High Availability) بلا قيود
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Details & Resource Quotas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#11151c]/90 border border-white/10 rounded-3xl p-6 shadow-xl space-y-2">
          <div className="flex items-center gap-2.5 text-xs text-slate-400 font-bold">
            <Cpu size={18} className="text-emerald-400" />
            <span>الأجهزة والمتحكمات:</span>
          </div>
          <div className="text-2xl font-black text-white">{devices.length} <span className="text-xs text-slate-400 font-normal">/ غير محدود</span></div>
          <p className="text-[11px] text-emerald-400 font-bold">✓ تشمل جميع وحدات ESP32 و Zigbee</p>
        </div>

        <div className="bg-[#11151c]/90 border border-white/10 rounded-3xl p-6 shadow-xl space-y-2">
          <div className="flex items-center gap-2.5 text-xs text-slate-400 font-bold">
            <Server size={18} className="text-cyan-400" />
            <span>نمط التشغيل:</span>
          </div>
          <div className="text-2xl font-black text-white">Off-Grid <span className="text-xs text-cyan-400 font-normal">Local Core</span></div>
          <p className="text-[11px] text-cyan-400 font-bold">✓ استقلالية تامة عن السحابة الخارجية</p>
        </div>

        <div className="bg-[#11151c]/90 border border-white/10 rounded-3xl p-6 shadow-xl space-y-2">
          <div className="flex items-center gap-2.5 text-xs text-slate-400 font-bold">
            <ShieldCheck size={18} className="text-purple-400" />
            <span>التحديثات والأمان:</span>
          </div>
          <div className="text-2xl font-black text-white">Full OTA <span className="text-xs text-purple-400 font-normal">Included</span></div>
          <p className="text-[11px] text-purple-400 font-bold">✓ ترقيات السوفتوير والـ AI مجاناً</p>
        </div>
      </div>

      {/* Feature Checklist */}
      <div className="bg-[#11151c]/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <h3 className="text-base font-black text-white pb-3 border-b border-white/10">
          الميزات المتاحة في نسختك الحالية:
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            'معالجة محلية بنسبة 100% دون الحاجة لإنترنت خارجي',
            'دعم كامل لبروتوكولات Matter 1.3 و Apple HomeKit و Google Home',
            'مساعد صوتي ذكي (Roro AI) مع فهم اللهجة العربية والإنجليزية',
            'توليد وبرمجة ملصقات NFC الذكية عبر المتصفح مباشرة',
            'نظام أمان متكامل مع وضع الطوارئ والـ PIN المشفر',
            'حرق السوفتوير عبر USB WebSerial وترقيات OTA عن بُعد'
          ].map((feat, i) => (
            <div key={i} className="flex items-center gap-3 p-3.5 bg-black/40 border border-white/5 rounded-2xl">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200">{feat}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={() => router.push('/settings')}
            className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-black rounded-2xl text-xs transition-all shadow-lg cursor-pointer hover:scale-105"
          >
            العودة للإعدادات العامة
          </button>
        </div>
      </div>

    </div>
  );
}
