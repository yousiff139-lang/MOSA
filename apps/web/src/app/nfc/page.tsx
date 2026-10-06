"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radio, Sparkles, Plus, Trash2, Copy, Check, QrCode, Smartphone,
  Zap, Moon, Sun, Lock, Coffee, Flame, ShieldCheck, RefreshCw, ExternalLink,
  Tag, Info, Layers
} from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';

interface NFCTag {
  id: string;
  name: string;
  token: string;
  actionType: 'SCENE' | 'DEVICE_TOGGLE' | 'AC_TEMP' | 'LOCK_DOOR' | 'CUSTOM_MACRO';
  targetId?: string;
  location?: string;
  createdAt: string;
  lastTappedAt?: string;
  tapCount: number;
}

const PRESET_TAG_TEMPLATES = [
  { name: '🌙 ملصق طاولة السرير (وضع النوم)', actionType: 'SCENE', location: 'غرفة النوم', icon: Moon, desc: 'إطفاء كل الإنارات وتشغيل السبلت على 24°C وقفل الأبواب' },
  { name: '🚪 ملصق باب الشارع (مغادرة المنزل)', actionType: 'LOCK_DOOR', location: 'المدخل الخارجي', icon: Lock, desc: 'قفل الأقفال الذكية وتفعيل وضع الأمان' },
  { name: '☕ ملصق ماكينة القهوة (روتين الصباح)', actionType: 'DEVICE_TOGGLE', location: 'المطبخ', icon: Coffee, desc: 'تشغيل سخان المياه وإنارة المطبخ' },
  { name: '❄️ ملصق الصالة (تبريد سريع 20°C)', actionType: 'AC_TEMP', location: 'الصالة الرئيسية', icon: Zap, desc: 'تشغيل السبالت على وضع التبريد الفوري' },
];

export default function NFCTagsPage() {
  const [tags, setTags] = useState<NFCTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNfcWriting, setIsNfcWriting] = useState(false);
  const [nfcWriteStatus, setNfcWriteStatus] = useState<string | null>(null);

  // New Tag Form State
  const [newTagName, setNewTagName] = useState('');
  const [newActionType, setNewActionType] = useState<'SCENE' | 'DEVICE_TOGGLE' | 'AC_TEMP' | 'LOCK_DOOR'>('SCENE');
  const [newLocation, setNewLocation] = useState('غرفة النوم');

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setLoading(true);
    try {
      const res = await fetchAuth('/api/nfc/tags');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) setTags(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const res = await fetchAuth('/api/nfc/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName,
          actionType: newActionType,
          location: newLocation
        })
      });
      if (res.ok) {
        setIsCreateModalOpen(false);
        setNewTagName('');
        loadTags();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الملصق؟')) return;
    try {
      const res = await fetchAuth(`/api/nfc/tags/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTags(prev => prev.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyTriggerUrl = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/api/nfc/trigger/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // Web NFC Write Implementation for Android / Mobile Chrome
  const handleWritePhysicalTag = async (tag: NFCTag) => {
    if (typeof window === 'undefined' || !('NDEFReader' in window)) {
      alert('ميزة كتابة NFC عبر المتصفح مدعومة حالياً على هواتف Android عبر متصفح Chrome. يمكنك أيضاً نسخ الرابط وبرمجته بأي تطبيق NFC Writer مجاني.');
      return;
    }

    setIsNfcWriting(true);
    setNfcWriteStatus('يرجى ملامسة ملصق الـ NFC بظهر الهاتف الآن... 📱🏷️');

    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.write({
        records: [
          {
            recordType: 'url',
            data: `${window.location.origin}/api/nfc/trigger/${tag.token}`
          }
        ]
      });
      setNfcWriteStatus('تمت كتابة وبرمجة ملصق الـ NFC بنجاح! ✅🎉');
      setTimeout(() => {
        setIsNfcWriting(false);
        setNfcWriteStatus(null);
      }, 3000);
    } catch (error: any) {
      setNfcWriteStatus(`فشلت الكتابة: ${error.message || 'تأكد من تفعيل NFC بهاتفك'}`);
      setTimeout(() => setIsNfcWriting(false), 3500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans pb-28" dir="rtl">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl p-6 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-600 to-red-600 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-4 ring-amber-500/20">
              <Radio className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-amber-100 to-amber-400">
                  استوديو ملصقات NFC الذكية
                </h1>
                <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold rounded-full flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" />
                  Instant Tap & Go
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1">
                برمج ملصقات NFC الذكية لتنفيذ السيناريوهات والأوامر الفورية بملامسة الهاتف فقط
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء ملصق ذكي جديد</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Presets Quick Templates */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            قوالب ملصقات سريعة وجاهزة للاستخدام
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRESET_TAG_TEMPLATES.map((tmpl, idx) => {
              const Icon = tmpl.icon;
              return (
                <div
                  key={idx}
                  className="bg-slate-900/70 border border-slate-800/80 hover:border-amber-500/40 rounded-3xl p-5 shadow-xl transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-sm text-white">{tmpl.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tmpl.desc}</p>
                  </div>
                  <button
                    onClick={() => {
                      setNewTagName(tmpl.name);
                      setNewActionType(tmpl.actionType as any);
                      setNewLocation(tmpl.location);
                      setIsCreateModalOpen(true);
                    }}
                    className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>استخدام القالب</span>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Registered NFC Tags List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-cyan-400" />
              الملصقات المسجلة في منزلك ({tags.length})
            </h2>
            <button onClick={loadTags} className="text-slate-400 hover:text-white p-1">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">جاري تحميل ملصقات الـ NFC...</div>
          ) : tags.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-12 text-center">
              <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="font-bold text-white text-base">لا توجد ملصقات NFC مسجلة حتى الآن</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                يمكنك إنشاء ملصق ذكي ولصقه على السرير أو الباب للتحكم بالأجهزة بلمسة واحدة من هاتفك.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {tags.map((tag) => (
                <motion.div
                  key={tag.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all relative overflow-hidden"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-3 py-1 bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-bold rounded-full">
                        {tag.location || 'المنزل'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        مرات اللمس: {tag.tapCount || 0}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-white mb-1">{tag.name}</h3>
                    <div className="text-xs text-slate-400 mb-4 font-mono truncate">
                      الرمز: {tag.token}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => handleWritePhysicalTag(tag)}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>برمجة الملصق الفيزيائي (NFC Write)</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyTriggerUrl(tag.token)}
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                      >
                        {copiedToken === tag.token ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedToken === tag.token ? 'تم النسخ!' : 'نسخ رابط اللمس'}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all"
                        title="حذف الملصق"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* NFC Write Overlay Modal */}
      <AnimatePresence>
        {isNfcWriting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Radio className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">جاري برمجة ملصق الـ NFC</h3>
              <p className="text-sm text-slate-300">{nfcWriteStatus}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  إنشاء ملصق NFC ذكي جديد
                </h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">اسم الملصق</label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="مثال: وضع النوم بجانب السرير"
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">نوع الإجراء عند اللمس</label>
                <select
                  value={newActionType}
                  onChange={(e) => setNewActionType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="SCENE">تفعيل مشهد أو سيناريو كامل</option>
                  <option value="DEVICE_TOGGLE">تبديل حالة جهاز (تشغيل / إطفاء)</option>
                  <option value="AC_TEMP">ضبط التكييف والتبريد الفوري</option>
                  <option value="LOCK_DOOR">قفل وتأمين الأبواب</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">موقع الملصق الفيزيائي</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="مثال: غرفة النوم، المدخل الخارجي، المطبخ"
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700 transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  حفظ وتوليد الرمز
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
