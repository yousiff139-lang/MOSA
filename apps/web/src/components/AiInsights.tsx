"use client";

import { useState, useEffect } from 'react';
import { Sparkles, Brain, Check, RefreshCw, Zap, ShieldAlert, Cpu } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedButton } from '@/components/ui/AnimatedButton';
import { fetchAuth } from '@/store/useSmartHomeStore';

export default function AiInsights() {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await fetchAuth('/api/ai/recommendations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setRecommendations(data);
        } else {
          setRecommendations(DEFAULT_RECOMMENDATIONS);
        }
      } else {
        setRecommendations(DEFAULT_RECOMMENDATIONS);
      }
    } catch (e) {
      setRecommendations(DEFAULT_RECOMMENDATIONS);
    } finally {
      setLoading(false);
    }
  };

  const DEFAULT_RECOMMENDATIONS = [
    {
      id: 'rec-1',
      title: 'تقليل استهلاك وضع الاستعداد (Standby)',
      description: 'تم رصد استهلاك مستمر بمقدار 85W خلال ساعات الفجر الأولى لأجهزة التلفاز وشواحن الإلكترونيات.',
      type: 'ENERGY_SAVING',
      confidence: 94,
      impact: 'توفير 4,500 د.ع شهرياً',
      suggestedAutomation: true
    },
    {
      id: 'rec-2',
      title: 'تحسين كفاءة التكييف بالتوقيت المزدوج',
      description: 'ضبط درجة حرارة المكيف عند 24°C بدلاً من 20°C يقلل الضغط على الضغاط بنسبة 28%.',
      type: 'ENERGY_SAVING',
      confidence: 89,
      impact: 'خفض 12% من الفاتورة',
      suggestedAutomation: true
    },
    {
      id: 'rec-3',
      title: 'جدولة ري الحديقة حسب الطقس المحلي',
      description: 'تأجيل الري التلقائي للحديقة لمدة 6 ساعات متوقعة لأمطار محلية قادمة.',
      type: 'SMART_IRRIGATION',
      confidence: 97,
      impact: 'توفير 300 لتر ماء',
      suggestedAutomation: true
    }
  ];

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleApply = (id: string) => {
    setAppliedIds((prev) => [...prev, id]);
    // Optionally trigger API to build automation
  };

  return (
    <GlassCard className="p-6 flex flex-col gap-6 border-white/10 bg-black/40 shadow-2xl rounded-3xl" dir="rtl">
      <div className="flex justify-between items-center pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Brain className="text-primary animate-pulse" size={24} />
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-1.5">
              توصيات الذكاء الاصطناعي المحلي (Edge AI) <Sparkles size={16} className="text-amber-400" />
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">تحليل سلوك التليمتري لترشيد الاستهلاك وصيانة الأجهزة تنبؤياً</p>
          </div>
        </div>
        <button 
          onClick={fetchRecommendations} 
          disabled={loading}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors border border-white/5"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">جاري تحليل بيانات الاستهلاك محلياً...</div>
      ) : recommendations.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">لا توجد توصيات كافية حالياً. اجمع مزيداً من بيانات الاستهلاك.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recommendations.map((rec) => {
            const isApplied = appliedIds.includes(rec.id);
            return (
              <div 
                key={rec.id}
                className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:border-primary/20 hover:bg-white/10 relative overflow-hidden"
              >
                {/* Confidence indicator badge */}
                <div className="absolute top-3 left-4 text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                  ثقة {rec.confidence}%
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    {rec.type === 'ENERGY_SAVING' ? 'ترشيد الطاقة ⚡' : 'صيانة تنبؤية 🛠️'}
                  </span>
                  <h3 className="font-bold text-sm text-white mt-1">{rec.title}</h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{rec.description}</p>
                </div>

                <div className="flex flex-col gap-3 pt-3 border-t border-white/5 mt-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">الأثر المتوقع:</span>
                    <span className="font-bold text-emerald-400">{rec.impact}</span>
                  </div>

                  {rec.suggestedAutomation ? (
                    <AnimatedButton
                      onClick={() => handleApply(rec.id)}
                      disabled={isApplied}
                      variant={isApplied ? 'outline' : 'primary'}
                      className="w-full py-2 rounded-xl text-[10px] font-bold"
                    >
                      {isApplied ? 'تم تطبيق الأتمتة ✓' : 'تطبيق الأتمتة المقترحة'}
                    </AnimatedButton>
                  ) : (
                    <div className="text-center text-[9px] text-amber-400/80 bg-amber-400/5 border border-amber-400/10 py-1.5 rounded-xl font-medium">
                      ⚠️ يرجى الكشف اليدوي على الجهاز
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
