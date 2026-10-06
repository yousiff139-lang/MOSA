'use client';

import { useState, useEffect } from 'react';
import { 
  Save, Play, Code, Box, ShieldAlert, CheckCircle2, 
  Trash2, RefreshCw, Sparkles, Layers, ToggleLeft, ToggleRight, X
} from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';

export default function PluginsAppStore() {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pluginName, setPluginName] = useState('Smart Light Automation Hook');
  const [pluginDesc, setPluginDesc] = useState('إضافة مخصصة للاستجابة السريعة لأحداث الحركة');
  const [toastMessage, setToastMessage] = useState('');

  const [code, setCode] = useState(`// كود إضافة مخصصة تعمل في بيئة V8 Sandbox المعزولة
mosa.onEvent('motion_detected', (payload) => {
  if (payload.value > 50) {
    mosa.publishMqtt('mosa/cmd/light1', JSON.stringify({ action: 'TOGGLE', state: 'ON' }));
  }
});
`);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const loadPlugins = async () => {
    setLoading(true);
    try {
      const res = await fetchAuth('/api/plugins');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setPlugins(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  const handleSaveAndRun = async () => {
    if (!pluginName.trim() || !code.trim()) {
      showToast('يرجى كتابة اسم الإضافة والكود');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetchAuth('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pluginName,
          version: '1.0.0',
          description: pluginDesc,
          author: 'Admin',
          code: code,
          isActive: true
        })
      });

      if (res.ok) {
        showToast('تم تفعيل وتشغيل الإضافة بنجاح في V8 Sandbox! ⚡');
        loadPlugins();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'فشل تشغيل الإضافة');
      }
    } catch (e) {
      showToast('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePlugin = async (id: string) => {
    try {
      const res = await fetchAuth(`/api/plugins/${id}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        const updated = await res.json();
        setPlugins(prev => prev.map(p => p.id === id ? { ...p, isActive: updated.isActive } : p));
        showToast(updated.isActive ? 'تم تفعيل الإضافة ⚡' : 'تم إيقاف الإضافة ⏸️');
      }
    } catch {
      showToast('فشل تبديل حالة الإضافة');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white p-4 sm:p-8 font-sans pb-32" dir="rtl">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm border border-purple-400 flex items-center gap-2">
          <Sparkles size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      <header className="mb-8 border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Box size={28} />
            </div>
            <span>متجر الإضافات ومحرر الـ Sandbox (V8 Engine)</span>
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            اكتب وشغّل أكواد JavaScript مخصصة للتحكم بالمنظومة داخل بيئة معزولة وآمنة تماماً
          </p>
        </div>

        <button 
          onClick={loadPlugins} 
          className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Code Editor Workspace */}
        <div className="lg:col-span-8 border border-white/10 rounded-3xl overflow-hidden bg-[#121620] shadow-2xl">
          <div className="p-4 border-b border-white/10 bg-black/40 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text"
                value={pluginName}
                onChange={(e) => setPluginName(e.target.value)}
                placeholder="اسم الإضافة"
                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none focus:border-purple-500"
              />
              <input 
                type="text"
                value={pluginDesc}
                onChange={(e) => setPluginDesc(e.target.value)}
                placeholder="وصف الإضافة"
                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-slate-300 text-xs outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <Code size={16} className="text-purple-400" />
                <span>index.js (V8 Isolate Script)</span>
              </div>
              
              <button 
                onClick={handleSaveAndRun}
                disabled={isSaving}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-5 py-2 rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer hover:scale-105 disabled:opacity-50"
              >
                <Play size={14} />
                <span>{isSaving ? 'جاري التشغيل...' : 'حفظ وتشغيل الإضافة فوراً'}</span>
              </button>
            </div>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-[400px] bg-transparent text-emerald-400 p-5 font-mono text-xs focus:outline-none resize-none leading-relaxed"
            spellCheck="false"
          />
        </div>

        {/* Right: Active Plugins List & Sandbox Info */}
        <div className="lg:col-span-4 space-y-5">
          
          <div className="bg-[#121620] border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-black text-white flex items-center justify-between pb-2 border-b border-white/10">
              <span className="flex items-center gap-2">
                <Layers size={16} className="text-purple-400" />
                الإضافات المثبتة والنشطة
              </span>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">
                {plugins.length} إضافات
              </span>
            </h3>

            <div className="space-y-2.5">
              {plugins.map(p => (
                <div 
                  key={p.id}
                  className="bg-black/40 border border-white/5 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="truncate">
                    <h4 className="text-xs font-black text-white truncate">{p.name}</h4>
                    <p className="text-[10px] text-slate-400 truncate">{p.description || 'v1.0.0'}</p>
                  </div>

                  <button
                    onClick={() => handleTogglePlugin(p.id)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                      p.isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {p.isActive ? 'نشط ⚡' : 'معطل'}
                  </button>
                </div>
              ))}

              {plugins.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  لا توجد إضافات مخصصة مثبتة بعد.
                </div>
              )}
            </div>
          </div>

          <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-3xl space-y-2">
            <h3 className="font-black text-xs text-amber-400 flex items-center gap-2">
              <ShieldAlert size={16} /> بيئة تشغيل آمنة (V8 Sandbox Protection)
            </h3>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              تعمل الأكواد في حاوية Isolate معزولة تماماً ولا تمتلك صلاحية الوصول إلى ملفات النظام الحساسة أو قواعد البيانات مباشرة لمنع أي ثغرات برمجية.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
