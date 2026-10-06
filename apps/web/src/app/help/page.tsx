"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HelpCircle, BookOpen, Wifi, ShieldAlert, Cpu, 
  MessageSquare, ChevronDown, ChevronUp, Search, Phone,
  Sparkles, Globe, Zap, Radio, Layers, CheckCircle2,
  Terminal, Smartphone, Lock, RefreshCw, Key, ExternalLink,
  LifeBuoy, Mail, Copy, Check
} from 'lucide-react';

interface FAQItemProps {
  id: string;
  category: 'quickstart' | 'ai' | 'matter' | 'hardware' | 'energy' | 'security' | 'developer';
  question: string;
  answer: string;
  tag: string;
}

const FAQS_LIST: FAQItemProps[] = [
  // ── 1. Quickstart & Local Architecture ──
  {
    id: 'faq-1',
    category: 'quickstart',
    tag: 'البداية السريعة 🚀',
    question: 'هل يمكنني التحكم بالمنزل الذكي عند انقطاع الإنترنت الخارجي؟',
    answer: 'نعم بنسبة 100%! منصة MOSA مصممة وفق معمارية "المحلي أولاً" (Local-First Architecture). طالما أن هاتفك أو جهاز التابلت متصل بشبكة الراوتر المنزلية (Wi-Fi)، يمكنك تشغيل وإطفاء الإنارة، التكييف، تشغيل السيناريوهات، وقراءة الحساسات دون الحاجة لأي اتصال بالإنترنت الخارجي.'
  },
  {
    id: 'faq-2',
    category: 'quickstart',
    tag: 'البداية السريعة 🚀',
    question: 'ماذا أفعل إذا انقطع اتصال لوحة التحكم (ESP32) بالإنترنت أو تم تغيير كلمة سر الراوتر؟',
    answer: 'إذا فقدت لوحة التحكم الاتصال بالراوتر لمدة 3 دقائق متواصلة، ستقوم تلقائياً بتفعيل وضع بث الطوارئ (Emergency AP Mode).\n1. ابحث في شبكات الواي فاي بجوالك عن شبكة باسم "MOSA-SmartNode-XXXX" واتصل بها.\n2. افتح المتصفح على العنوان التلقائي (http://192.168.4.1).\n3. اختر اسم شبكتك المنزلية الجديدة وأدخل كلمة المرور واضغط "حفظ"، وستعود اللوحة للعمل فوراً.'
  },
  {
    id: 'faq-3',
    category: 'quickstart',
    tag: 'البداية السريعة 🚀',
    question: 'كيف أضيف المنصة كتطبيق مثبت على شاشة الآيفون أو الأندرويد أو التابلت المعلق؟',
    answer: 'المنصة تدعم تقنية PWA (Progressive Web App):\n• على هواتف iPhone (متصفح Safari): اضغط على زر المشاركة (Share) ثم اختر "إضافة إلى الصفحة الرئيسية" (Add to Home Screen).\n• على هواتف Android والشاشات اللوحية: اضغط على القائمة (ثلاث نقاط) في Chrome واختر "تثبيت التطبيق" (Install App).'
  },

  // ── 2. AI & Voice Assistant ──
  {
    id: 'faq-4',
    category: 'ai',
    tag: 'المساعد الذكي 🤖',
    question: 'كيف يتفوق المساعد الصوتي في MOSA على المساعدات العالمية مثل Alexa و Google Assistant؟',
    answer: 'يتميز مساعد MOSA الذكي بعدة قدرات استثنائية مصممة خصيصاً للمنزل العربي:\n1. الأوامر المركبة المتعددة: يمكنك قول جملة واحدة مثل: "طفي إنارة الصالة وشغل المكيف على 22 وشغل إذاعة القرآن الكريم" وسيقوم بتفكيك الجملة وتنفيذ كل الأوامر في نفس اللحظة بالتوازي.\n2. الذاكرة السياقية والضمائر: يفهم الضمائر مثل "طفيها"، "سويها 20"، "شغلها" معتمداً على آخر جهاز تحدثت عنه.\n3. البث الصوتي المباشر: تشغيل إذاعة القرآن الكريم وإذاعة بغداد والمحطات الإخبارية فورياً داخل لوحة القيادة.\n4. الموجز الصوتي اليومي (Daily Briefing): عند قول "صباح الخير" أو "الموجز اليومي"، يلقي عليك تقريراً صوتياً متكاملاً بدرجات حرارة الغرف، استهلاك الواط، وحالة الأبواب والنظام.'
  },
  {
    id: 'faq-5',
    category: 'ai',
    tag: 'المساعد الذكي 🤖',
    question: 'كيف أستخدم الزر العائم للمساعد الصوتي الذكي في أي شاشة؟',
    answer: 'في الزاوية السفلية من أي شاشة في المنصة، يوجد زر المساعد الصوتي الأزرق الهولوغرافي 🎙️. اضغط عليه مرة واحدة وابدأ بالحديث مباشرة دون الحاجة لقول كلمة تنبيه، أو استخدم كلمة التنبيه الصوتية مثل: "يا موسى، افتح الستائر".'
  },

  // ── 3. Matter, Apple HomeKit, Google & Tuya ──
  {
    id: 'faq-6',
    category: 'matter',
    tag: 'تكاملات Matter و Apple 🌐',
    question: 'كيف أقوم بربط المنظومة بتطبيق Apple Home على iPhone أو ساعة Apple Watch؟',
    answer: '1. توجه إلى صفحة (إعدادات Matter و Apple Integrations) من القائمة الجانبية.\n2. افتح تطبيق "Home" على هاتف الآيفون واضغط على علامة (+) ثم "Add Accessory".\n3. وجّه كاميرا الآيفون إلى رمز الـ QR الظاهر على الشاشة، أو أدخل رمز الإقران اليدوي: "2024-06-2026".\n4. ستظهر كافة أجهزة وغرف ومفاتيح MOSA تلقائياً على هاتفك وساعتك مع إمكانية التحكم بها عبر Siri.'
  },
  {
    id: 'faq-7',
    category: 'matter',
    tag: 'تكاملات Matter و Apple 🌐',
    question: 'كيف أربط مقابس ومفاتيح Tuya و SmartLife السحابية بالمنظومة؟',
    answer: 'توجه إلى صفحة (مفاتيح الربط الخارجي / API Keys) أو صفحة Matter، وأدخل الـ (Access ID / Client ID) والـ (Access Secret) الخاصين بحساب المطورين من منصة iot.tuya.com، ثم اضغط "ربط ومزامنة". سيقوم النظام بجلب جميع الأجهزة السحابية ودمجها في لوحة التحكم الرئيسية.'
  },

  // ── 4. Hardware, ESP32 & Zigbee 3.0 ──
  {
    id: 'faq-8',
    category: 'hardware',
    tag: 'العتاد والشبكات 📡',
    question: 'ما هي الأجهزة المتوافقة مع شبكة Zigbee 3.0 Hub المباشرة؟',
    answer: 'تدعم المنظومة كافة حساسات ومفاتيح Zigbee 3.0 القياسية من أشهر الشركات العالمية:\n• Xiaomi / Aqara (حساسات الحركة، فتح الأبواب، درجة الحرارة والرطوبة).\n• Sonoff Zigbee (مفاتيح الإنارة والمقابس الذكية).\n• Tuya / Moes Zigbee (صمامات المياه، حساسات تسريب الغاز والمطر).\n• مصابيح ومفاتيح Philips Hue و IKEA Tradfri.\nتتميز هذه الحساسات بأنها لا تستهلك أي سعة من شبكة الواي فاي وبطاريتها تدوم من 2 إلى 3 سنوات.'
  },
  {
    id: 'faq-9',
    category: 'hardware',
    tag: 'العتاد والشبكات 📡',
    question: 'ما هي أفضل منافذ GPIO التي يجب استخدامها للريلاي في لوحات ESP32؟',
    answer: 'وفقاً لمخطط المنافذ المعتمد في المنصة (ESP32 Pinout Guide):\n• المنافذ الآمنة الموصى بها للريلاي والأحمال: GPIO 4, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33.\n• منافذ حساسة يجب تجنب استخدامها كمخرجات لأنها تتحكم في إقلاع اللوحة (Boot Strapping Pins): GPIO 0, 2, 12, 15.\n• منافذ مدخلات فقط للحساسات التناظرية: GPIO 34, 35, 36, 39.'
  },
  {
    id: 'faq-10',
    category: 'hardware',
    tag: 'العتاد والشبكات 📡',
    question: 'كيف أقوم ببرمجة لوحة ESP32 جديدة لأول مرة عبر المتصفح (USB Flasher)؟',
    answer: 'لا تحتاج لتثبيت Arduino IDE أو برامج معقدة:\n1. صل لوحة ESP32 بجهاز الكمبيوتر عبر كابل USB.\n2. افتح صفحة (ESP32 USB Programmer) من القائمة الجانبية (باستخدام متصفح Chrome أو Edge).\n3. اختر نوع اللوحة واسم شبكة الواي فاي المنزلية.\n4. اضغط على زر "Connect & Flash Code" واختر منفذ الـ COM الخاص باللوحة، وسيتم رفع النظام وضبطه في أقل من 60 ثانية!'
  },

  // ── 5. Energy, Automations & Blueprints ──
  {
    id: 'faq-11',
    category: 'energy',
    tag: 'الطاقة والأتمتة ⚡',
    question: 'كيف تساعد المنصة في تقليل فاتورة الكهرباء وحماية الأسلاك من الحمل الزائد؟',
    answer: 'من خلال ميزتين أساسيتين:\n1. ميزة قواطع الحمل الزائد (Power Surge Cutoff): ترصد استهلاك الواط الكلي للمنزل في الوقت الفعلي، وتفصل الأجهزة غير الضرورية (مثل سخان الماء ومضخات الحديقة) تلقائياً إذا تجاوز الاستهلاك 3500 واط.\n2. قوالب الأتمتة الموفرة للطاقة (Eco Blueprints): مثل سيناريو الموازن الحراري للمكيف، وإطفاء إنارة الممرات والغرف تلقائياً بعد 5 دقائق من عدم وجود حركة.'
  },
  {
    id: 'faq-12',
    category: 'energy',
    tag: 'الطاقة والأتمتة ⚡',
    question: 'ما هي قوالب الأتمتة الجاهزة (Blueprints) وكيف أطبقها بنقرة واحدة؟',
    answer: 'قوالب الأتمتة هي سيناريوهات ذكية متكاملة ومبرمجة مسبقاً (مثل وضع النوم الشامل، روتين الاستيقاظ مع الشروق، حارس مكافحة التسلل، والري الذكي بحساس رطوبة التربة). توجه إلى صفحة (قوالب الأتمتة Blueprints) واضغط على زر "تفعيل بالمنزل" بجانب أي قالب ليتم حفظه وتشغيله فوراً.'
  },

  // ── 6. Security, Users & Recovery ──
  {
    id: 'faq-13',
    category: 'security',
    tag: 'الحماية والأمان 🛡️',
    question: 'كيف يمكنني استعادة رمز الدخول PIN أو كلمة المرور في حال نسيانها؟',
    answer: 'في شاشة الدخول الرئيسية، اضغط على "استعادة كلمة المرور". أدخل البريد الإلكتروني المسجل لمالك المنزل، وسيقوم السيرفر بإرسال رمز تحقق مؤقت (OTP) مكون من 6 أرقام. أدخل الرمز في الشاشة لتعيين رمز PIN جديد فورياً.'
  },
  {
    id: 'faq-14',
    category: 'security',
    tag: 'الحماية والأمان 🛡️',
    question: 'ما هو "التأكيد المزدوج" وكيف يحمي النظام من الحذف الخاطئ؟',
    answer: 'لحماية المنظومة من الحذف غير المقصود أو عبث الأطفال، تتطلب الإجراءات الحساسة (مثل إعادة ضبط المصنع، حذف لوحة تحكم، أو مسح قاعدة البيانات) كتابة كلمة تأكيد باللغة العربية مثل كلمة "فرمتة" داخل الحقل المخصص قبل السماح بالتنفيذ.'
  },

  // ── 7. Developer, Runtime & API ──
  {
    id: 'faq-15',
    category: 'developer',
    tag: 'المطورين والـ API 💻',
    question: 'ما هي ميزة "برمجة النظام اللحظية" (Runtime Programming)؟',
    answer: 'تسمح لمدير المنظومة بتعديل نصوص الواجهات، تفعيل أو إيقاف الميزات البرمجية (Feature Flags)، وتخصيص عناصر القائمة الجانبية وبثها فوراً لجميع أجهزة التابلت والشاشات المعلقة في المنزل عبر WebSockets دون الحاجة لإعادة بناء (Rebuild) أو ريستارت للسيرفر.'
  },
  {
    id: 'faq-16',
    category: 'developer',
    tag: 'المطورين والـ API 💻',
    question: 'كيف أتحكم بالأجهزة برمجياً من تطبيق خارجي عبر REST API؟',
    answer: 'توفر المنصة واجهات RESTful API كاملة وسريعة:\n• جلب حالة الأجهزة: GET http://localhost/api/devices\n• تشغيل/إطفاء جهاز: POST http://localhost/api/devices/:id/toggle\n• إرسال أمر صوتي نصي: POST http://localhost/api/ai/chat\nيمكنك الاطلاع على كافة النماذج وأكواد curl الجاهزة في صفحة (أدوات المطورين / Developer Console).'
  }
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-1');
  const [copiedPhone, setCopiedPhone] = useState(false);

  const toggleFaq = (id: string) => {
    setOpenFaqId(prev => prev === id ? null : id);
  };

  const filteredFaqs = FAQS_LIST.filter(faq => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = query === '' || 
      faq.question.toLowerCase().includes(query) || 
      faq.answer.toLowerCase().includes(query) ||
      faq.tag.toLowerCase().includes(query);
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCopyPhone = () => {
    navigator.clipboard.writeText('+964 770 000 0000');
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans" dir="rtl">
      
      {/* ── Top Futuristic Header Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-950/70 via-slate-900/90 to-indigo-950/70 border border-blue-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold mb-3">
              <BookOpen size={16} className="text-blue-400" />
              <span>مركز المعرفة والتوثيق الشامل (MOSA Master Knowledge & FAQ Center)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              مركز الدعم الفني ودليل الاستخدام الشامل
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              إرشادات تفصيلية، حلول سريعة لأي مشكلة، وشرح متكامل لكافة مميزات المنظومة من التحكم الصوتي وحتى ربط الأجهزة والبروتوكولات العالمية.
            </p>
          </div>

          {/* Quick Architect Badge */}
          <div className="flex flex-col items-end gap-1.5 shrink-0 bg-black/40 p-4 rounded-2xl border border-white/10 text-xs">
            <span className="text-slate-400">المهندس المعماري والمطور:</span>
            <span className="font-black text-white text-sm bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
              MOSA AL-KADHEM
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">● المنظومة نشطة ومحدثة (v2.4 LTS)</span>
          </div>
        </div>

        {/* ── Search Bar inside Banner ── */}
        <div className="mt-6 pt-5 border-t border-white/10 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث عن أي سؤال، بروتوكول (Matter, ESP32, Zigbee, PIN, Alexa, Flasher)..."
            className="w-full bg-[#050914] border border-white/15 focus:border-blue-400 rounded-2xl py-3.5 pr-12 pl-4 text-white text-xs sm:text-sm focus:outline-none transition-colors shadow-inner"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {[
            { id: 'all', label: '🌟 جميع الأسئلة والمواضيع' },
            { id: 'quickstart', label: '🚀 البداية السريعة' },
            { id: 'ai', label: '🤖 المساعد الصوتي (AI)' },
            { id: 'matter', label: '🌐 Matter & Apple HomeKit' },
            { id: 'hardware', label: '📡 العتاد و Zigbee و ESP32' },
            { id: 'energy', label: '⚡ الطاقة والأتمتة' },
            { id: 'security', label: '🛡️ الأمان واستعادة PIN' },
            { id: 'developer', label: '💻 المطورين والـ API' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400'
                  : 'bg-black/30 hover:bg-white/5 text-slate-400 hover:text-slate-200 border border-white/5'
              }`}
            >
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 4 Key Interactive Quick Guides Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'الربط مع ساعة Apple Watch',
            desc: 'امسح رمز Matter QR من إعدادات المنصة لتظهر أجهزتك على ساعتك وهاتفك فوراً.',
            icon: Smartphone,
            link: '/settings/matter',
            badge: 'Apple & Matter',
            color: 'from-teal-600 to-emerald-600'
          },
          {
            title: 'الأوامر الصوتية المركبة',
            desc: 'استخدم المساعد الصوتي لتنفيذ عدة أوامر في نفس اللحظة (طفي الصالة وشغل المكيف).',
            icon: Sparkles,
            link: '/ai',
            badge: 'MOSA Voice AI',
            color: 'from-purple-600 to-indigo-600'
          },
          {
            title: 'برمجة ESP32 عبر الـ USB',
            desc: 'صل اللوحة بالكمبيوتر واضغط Flash لرفع النظام في ثوانٍ دون تثبيت برامج.',
            icon: Terminal,
            link: '/flasher',
            badge: 'USB Programmer',
            color: 'from-blue-600 to-cyan-600'
          },
          {
            title: 'ترشيد وحماية الأحمال',
            desc: 'تفعيل قواطع الحمل الزائد لفصل الأجهزة الثانوية تلقائياً عند تجاوز 3500W.',
            icon: Zap,
            link: '/automations/blueprints',
            badge: 'Eco Blueprints',
            color: 'from-amber-600 to-orange-600'
          },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <a
              key={i}
              href={card.link}
              className="bg-slate-950/85 hover:bg-slate-900 border border-white/10 hover:border-blue-500/40 rounded-3xl p-5 flex flex-col justify-between space-y-3 transition-all shadow-xl group cursor-pointer"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${card.color} text-white flex items-center justify-center shadow-md`}>
                    <Icon size={20} />
                  </div>
                  <span className="text-[10px] bg-white/5 text-slate-300 px-2 py-0.5 rounded-lg border border-white/10 font-bold">
                    {card.badge}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                  {card.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {card.desc}
                </p>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-cyan-400 font-bold">
                <span>فتح الدليل التفاعلي</span>
                <span className="group-hover:-translate-x-1 transition-transform">←</span>
              </div>
            </a>
          );
        })}
      </div>

      {/* ── Main FAQ Accordion + Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: FAQ Accordion Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <HelpCircle size={18} className="text-blue-400" />
              <span>الأسئلة الشائعة والأدلة التفصيلية ({filteredFaqs.length})</span>
            </h3>
            <span className="text-xs text-slate-400">اضغط على السؤال لعرض الشرح المفصل</span>
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="bg-slate-950/60 border border-white/5 rounded-3xl p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
                <Search size={22} />
              </div>
              <h4 className="font-bold text-white text-sm">لم يتم العثور على نتائج مطابقة لبحثك</h4>
              <p className="text-xs text-slate-400">جرب البحث بكلمات أخرى مثل "ESP32", "Matter", "واي فاي", أو "PIN".</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFaqs.map((faq) => {
                const isOpen = openFaqId === faq.id;

                return (
                  <div
                    key={faq.id}
                    className={`border rounded-2xl transition-all duration-300 overflow-hidden ${
                      isOpen
                        ? 'bg-slate-900/90 border-blue-500/40 shadow-xl'
                        : 'bg-slate-950/70 hover:bg-slate-900/80 border-white/5'
                    }`}
                  >
                    <button
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full p-4 sm:p-5 flex items-start justify-between gap-4 text-right cursor-pointer"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] text-cyan-400 font-bold">{faq.tag}</span>
                        <h4 className="font-black text-sm text-white leading-snug">{faq.question}</h4>
                      </div>
                      <div className={`p-1.5 rounded-xl bg-white/5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-cyan-400 bg-cyan-500/10' : ''}`}>
                        <ChevronDown size={18} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="px-4 sm:px-5 pb-5 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line border-t border-white/5 pt-3"
                        >
                          {faq.answer}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Technical Support & Emergency Hotline */}
        <div className="space-y-6">
          
          {/* Direct Support Card */}
          <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5">
              <LifeBuoy size={20} className="text-blue-400" />
              <h3 className="font-black text-base text-white">مركز الدعم والتواصل الفني</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              إذا واجهتك أي مشكلة في التوصيلات الكهربائية أو إعدادات الشبكة، فريق الدعم الفني جاهز لمساعدتك على مدار الساعة.
            </p>

            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Phone size={16} className="text-emerald-400" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">الدعم الهاتفي المباشر:</span>
                    <strong className="text-white text-xs font-mono" dir="ltr">+964 770 000 0000</strong>
                  </div>
                </div>
                <button
                  onClick={handleCopyPhone}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedPhone ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedPhone ? 'تم النسخ' : 'نسخ'}</span>
                </button>
              </div>

              <div className="p-3.5 bg-black/40 rounded-2xl border border-white/5 flex items-center gap-2.5">
                <Mail size={16} className="text-cyan-400" />
                <div>
                  <span className="text-[10px] text-slate-400 block">البريد الإلكتروني الرسمي:</span>
                  <strong className="text-white text-xs font-mono">support@mosasmart.com</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Quick System Status Widget */}
          <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 space-y-3 shadow-xl text-xs">
            <h4 className="font-black text-white flex items-center gap-2">
              <ShieldAlert size={16} className="text-emerald-400" />
              <span>حالة المنظومة والخدمات</span>
            </h4>
            
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center text-slate-400">
                <span>محرك الأتمتة المحلي:</span>
                <span className="text-emerald-400 font-bold">يعمل بكفاءة 100%</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>بوابة MQTT Gateway:</span>
                <span className="text-emerald-400 font-bold">متصلة (Active)</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>جسر Matter & HomeKit:</span>
                <span className="text-emerald-400 font-bold">نشط ومؤمن</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>المساعد الصوتي MOSA AI:</span>
                <span className="text-cyan-400 font-bold">استجابة لحظية</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
