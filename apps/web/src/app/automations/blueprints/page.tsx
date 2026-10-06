"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Sparkles, Download, FileJson, CheckCircle2, Play, 
  Moon, Sun, ShieldAlert, Zap, Droplets, Flame, Thermometer,
  Layers, ArrowUpRight, Copy, Check, Clock, Plus, Sliders
} from 'lucide-react';
import { fetchAuth, useSmartHomeStore } from '@/store/useSmartHomeStore';
import { useRouter } from 'next/navigation';

interface BlueprintTemplate {
  id: string;
  title: string;
  description: string;
  category: 'COMFORT' | 'ECO' | 'SECURITY' | 'GARDEN';
  badge: string;
  badgeColor: string;
  icon: any;
  energySaving: string;
  triggers: string;
  actions: string;
  ruleConfig: any;
}

const CURATED_BLUEPRINTS: BlueprintTemplate[] = [
  {
    id: 'bp-1',
    title: '🌙 وضع النوم الشامل (Good Night Protocol)',
    description: 'عند حلول الساعة 11:30 ليلاً، يقوم النظام بإطفاء كافة الإنارة، قفل الأبواب، وضبط التكييف على 24°C وتفعيل حارس الأمان.',
    category: 'COMFORT',
    badge: 'الأكثر استخداماً 🌟',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    icon: Moon,
    energySaving: 'يوفر 25% من الطاقة الليلية',
    triggers: '⏰ الوقت: 11:30 مساءً يومياً',
    actions: '💡 إطفاء الإنارة + ❄️ ضبط التكييف 24°C + 🔒 قفل الأبواب',
    ruleConfig: {
      name: 'وضع النوم الشامل',
      triggerType: 'TIME',
      triggerConfig: { time: '23:30' },
      actions: [{ type: 'LIGHTS_ALL_OFF' }, { type: 'CLIMATE_SET', temp: 24 }, { type: 'SECURITY_ARM' }]
    }
  },
  {
    id: 'bp-2',
    title: '☀️ روتين الاستيقاظ الصباحي (Gentle Sunrise Wakeup)',
    description: 'عند شروق الشمس (6:30 صباحاً)، فتح الستائر تدريجياً، تشغيل صانعة القهوة، وتشغيل الإضاءة الهادئة ونطق الموجز الصباحي.',
    category: 'COMFORT',
    badge: 'راحة وفخامة ☕',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: Sun,
    energySaving: 'استغلال ضوء الشمس الطبيعي',
    triggers: '⏰ الوقت: 06:30 صباحاً',
    actions: '🪟 فتح الستائر + 💡 إنارة دافئة + 🔊 تشغيل الموجز الصباحي',
    ruleConfig: {
      name: 'روتين الاستيقاظ الصباحي',
      triggerType: 'TIME',
      triggerConfig: { time: '06:30' },
      actions: [{ type: 'CURTAINS_OPEN' }, { type: 'VOICE_BRIEFING' }]
    }
  },
  {
    id: 'bp-3',
    title: '⚡ الموازن الحراري وترشيد التكييف (Eco-Climate Balance)',
    description: 'إذا ارتفعت درجة حرارة الغرف عن 27°C يتم تشغيل التكييف على وضع التبريد، وعند وصولها إلى 23°C يتم إيقافه تلقائياً.',
    category: 'ECO',
    badge: 'توفير طاقة فائق 🍃',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: Thermometer,
    energySaving: 'حفظ 18% من فاتورة الكهرباء',
    triggers: '🌡️ حساس DHT22: الحرارة > 27°C',
    actions: '❄️ تشغيل المكيف على 23°C حتى تبرد الغرفة',
    ruleConfig: {
      name: 'ترشيد التكييف الذكي',
      triggerType: 'TEMPERATURE',
      triggerConfig: { operator: 'GT', value: 27 },
      actions: [{ type: 'CLIMATE_ON', temp: 23 }]
    }
  },
  {
    id: 'bp-4',
    title: '🚨 حارس مكافحة التسلل والإنذار (Intrusion Defense)',
    description: 'عند فتح أي باب أو نافذة أثناء تفعيل (وضع الخروج Away Mode)، يومض المنزل باللون الأحمر وينطلق الإنذار الصوتي الفوري.',
    category: 'SECURITY',
    badge: 'أمان وحماية 🛡️',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    icon: ShieldAlert,
    energySaving: 'حماية أمنية على مدار الساعة',
    triggers: '🚪 حساس الباب: فتح أثناء وضع الغياب',
    actions: '🚨 تشغيل صافرة الإنذار + 🔴 وميض الإضاءة + 📲 إشعار طارئ',
    ruleConfig: {
      name: 'حارس مكافحة التسلل',
      triggerType: 'PRESENCE',
      triggerConfig: { mode: 'AWAY', doorOpen: true },
      actions: [{ type: 'ALARM_TRIGGER' }, { type: 'LIGHTS_RED_ALERT' }]
    }
  },
  {
    id: 'bp-5',
    title: '💧 الري الذكي بحساس رطوبة التربة (Smart Garden Hydration)',
    description: 'فحص رطوبة تربة الحديقة كل 4 ساعات، وتشغيل مضخة الري لمدة 10 دقائق فقط إذا انخفضت الرطوبة عن 30%.',
    category: 'GARDEN',
    badge: 'ري ذكي تلقائي 🌱',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    icon: Droplets,
    energySaving: 'توفير 40% من استهلاك مياه الحديقة',
    triggers: '🌱 حساس الرطوبة: أقل من 30%',
    actions: '💧 تشغيل مضخة الري لمدة 10 دقائق ثم الإيقاف التلقائي',
    ruleConfig: {
      name: 'الري التلقائي بحساس التربة',
      triggerType: 'POWER',
      triggerConfig: { moistureLT: 30 },
      actions: [{ type: 'PUMP_ON_TIMER', durationMinutes: 10 }]
    }
  },
  {
    id: 'bp-6',
    title: '🔌 حماية الأسلاك وفصل الحمل الزائد (Power Surge Protector)',
    description: 'مراقبة سحب الواط الكلي للمنزل، وفصل الأجهزة الثانوية تلقائياً إذا تجاوز الاستهلاك 3500 واط لمنع انقطاع القاطع.',
    category: 'ECO',
    badge: 'حماية كهربائية ⚡',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: Zap,
    energySaving: 'حماية القواطع والأسلاك من الاحتراق',
    triggers: '⚡ استهلاك الطاقة > 3500W',
    actions: '🔌 فصل سخان المياه والمضخات غير الأساسية فوراً',
    ruleConfig: {
      name: 'حماية الحمل الزائد',
      triggerType: 'POWER',
      triggerConfig: { powerGT: 3500 },
      actions: [{ type: 'CUTOFF_NON_ESSENTIAL' }]
    }
  }
];

export default function BlueprintsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'GALLERY' | 'JSON'>('GALLERY');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [deployedSuccess, setDeployedSuccess] = useState<string | null>(null);
  
  // Custom JSON Importer State
  const [blueprintJson, setBlueprintJson] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleDeployBlueprint = async (bp: BlueprintTemplate) => {
    setDeployingId(bp.id);
    try {
      const res = await fetchAuth('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bp.ruleConfig.name,
          triggerType: bp.ruleConfig.triggerType,
          triggerConfig: bp.ruleConfig.triggerConfig,
          actions: bp.ruleConfig.actions,
          isActive: true
        })
      });

      if (res.ok) {
        setDeployedSuccess(bp.id);
        setTimeout(() => {
          setDeployedSuccess(null);
        }, 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeployingId(null);
    }
  };

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(blueprintJson);
      setIsImporting(true);
      const res = await fetchAuth('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });
      if (res.ok) {
        alert('تم استيراد وحفظ مسار الأتمتة بنجاح!');
        router.push('/automations');
      }
    } catch (e) {
      alert('كود JSON غير صالح. يرجى التحقق من صحة القالب.');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredBlueprints = CURATED_BLUEPRINTS.filter(b => {
    if (selectedCategory === 'ALL') return true;
    return b.category === selectedCategory;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans" dir="rtl">
      
      {/* ── Top Header Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-950/70 via-slate-900/90 to-indigo-950/70 border border-purple-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold mb-3">
              <BookOpen size={16} className="text-purple-400" />
              <span>مكتبة القوالب وسيناريوهات الأتمتة الجاهزة (Blueprints Hub)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              قوالب وسيناريوهات الأتمتة الجاهزة
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              استورد سيناريوهات ذكية متكاملة ومبرمجة مسبقاً بنقرة زر واحدة؛ لتوفير الكهرباء، حماية المنزل، وضبط المناخ التلقائي.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/10 rounded-2xl shrink-0 text-xs">
            <button
              onClick={() => setActiveTab('GALLERY')}
              className={`px-4 py-2.5 rounded-xl font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'GALLERY'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles size={16} />
              <span>المكتبة الجاهزة</span>
            </button>
            <button
              onClick={() => setActiveTab('JSON')}
              className={`px-4 py-2.5 rounded-xl font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'JSON'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileJson size={16} />
              <span>محرر كود JSON</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        {activeTab === 'GALLERY' && (
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs">
            {[
              { id: 'ALL', label: '🌟 جميع القوالب' },
              { id: 'COMFORT', label: '🌙 الراحة والنوم' },
              { id: 'ECO', label: '⚡ ترشيد الطاقة' },
              { id: 'SECURITY', label: '🛡️ الأمان والحماية' },
              { id: 'GARDEN', label: '🌱 الري والحديقة' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-purple-500/30 text-purple-200 border border-purple-400/50 shadow-sm'
                    : 'bg-black/30 hover:bg-white/5 text-slate-400 hover:text-slate-200 border border-white/5'
                }`}
              >
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content View ── */}
      {activeTab === 'GALLERY' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBlueprints.map((bp) => {
            const Icon = bp.icon;
            const isDeploying = deployingId === bp.id;
            const isSuccess = deployedSuccess === bp.id;

            return (
              <motion.div
                key={bp.id}
                whileHover={{ y: -4 }}
                className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 hover:border-purple-500/40 rounded-3xl p-6 flex flex-col justify-between transition-all shadow-xl space-y-4 relative group overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/30">
                      <Icon size={24} />
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-xl border font-bold ${bp.badgeColor}`}>
                      {bp.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-base text-white">{bp.title}</h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{bp.description}</p>
                  </div>

                  {/* Flow Pills Box */}
                  <div className="space-y-1.5 bg-black/40 p-3 rounded-2xl border border-white/5 text-[11px]">
                    <div className="text-cyan-300 font-medium truncate">
                      {bp.triggers}
                    </div>
                    <div className="text-emerald-300 font-medium truncate">
                      {bp.actions}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-emerald-400 font-bold">{bp.energySaving}</span>
                  <button
                    onClick={() => handleDeployBlueprint(bp)}
                    disabled={isDeploying}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                      isSuccess
                        ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/20'
                    }`}
                  >
                    {isSuccess ? (
                      <>
                        <Check size={14} />
                        <span>تم التفعيل بنجاح!</span>
                      </>
                    ) : (
                      <>
                        <Play size={14} />
                        <span>{isDeploying ? 'جاري التطبيق...' : 'تفعيل بالمنزل'}</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* JSON Importer View */
        <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <FileJson size={20} className="text-purple-400" />
              <span>محرر ولصق كود القالب المخصص (JSON Automation Schema)</span>
            </h3>
            <button
              onClick={() => {
                const sample = {
                  name: "Night Energy Saver",
                  triggerType: "TIME",
                  triggerConfig: { time: "01:00" },
                  actions: [{ type: "LIGHTS_OFF", all: true }]
                };
                setBlueprintJson(JSON.stringify(sample, null, 2));
              }}
              className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl font-bold hover:bg-purple-500/30 transition"
            >
              تحميل نموذج كود جاهز
            </button>
          </div>

          <textarea
            value={blueprintJson}
            onChange={e => setBlueprintJson(e.target.value)}
            placeholder='{\n  "name": "My Custom Automation",\n  "triggerType": "TIME",\n  "triggerConfig": { "time": "22:00" },\n  "actions": [{ "type": "TURN_OFF_ALL" }]\n}'
            rows={10}
            className="w-full bg-[#050914] border border-white/10 rounded-2xl p-4 text-xs font-mono text-cyan-300 focus:outline-none focus:border-purple-400 leading-relaxed"
          />

          <div className="flex justify-end pt-2">
            <button
              onClick={handleImportJson}
              disabled={isImporting || !blueprintJson.trim()}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-black text-xs transition shadow-lg shadow-purple-600/30 disabled:opacity-40 cursor-pointer"
            >
              {isImporting ? 'جاري الاستيراد والتفعيل...' : 'استيراد وتفعيل الأتمتة فورياً ✨'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
