"use client";

import React from 'react';
import { useConfirmStore, ModalVariant } from '@/store/useConfirmStore';
import { AlertTriangle, ShieldAlert, RotateCw, CheckCircle2, Info, X, Loader2 } from 'lucide-react';

export default function GlobalConfirmModal() {
  const { isOpen, options, isLoading, close, setLoading, toasts, removeToast } = useConfirmStore();

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.alert = (msg: string) => {
        const text = String(msg || '');
        let type: 'success' | 'error' | 'warning' | 'info' = 'info';
        if (text.includes('نجاح') || text.includes('تم') || text.includes('✓') || text.includes('بواسطة')) {
          type = 'success';
        } else if (text.includes('خطأ') || text.includes('فشل') || text.includes('محظور')) {
          type = 'error';
        } else if (text.includes('تنبيه') || text.includes('تحذير') || text.includes('غير مضاف')) {
          type = 'warning';
        }
        useConfirmStore.getState().showToast(text, type);
      };
    }
  }, []);

  const handleConfirm = async () => {
    if (!options) return;
    try {
      setLoading(true);
      await options.onConfirm();
    } catch (err) {
      console.error('Action error', err);
    } finally {
      close();
    }
  };

  const getVariantStyles = (variant: ModalVariant = 'danger') => {
    switch (variant) {
      case 'reboot':
      case 'info':
        return {
          bgGlow: 'from-cyan-500/20 via-blue-500/10 to-transparent',
          border: 'border-cyan-500/40',
          topLine: 'from-cyan-500 via-blue-500 to-indigo-500',
          iconBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
          icon: <RotateCw className="w-7 h-7 animate-spin-slow" />,
          btn: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-500/25',
          titleColor: 'text-cyan-300'
        };
      case 'warning':
        return {
          bgGlow: 'from-amber-500/20 via-amber-500/10 to-transparent',
          border: 'border-amber-500/40',
          topLine: 'from-amber-500 via-yellow-400 to-amber-600',
          iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          icon: <AlertTriangle className="w-7 h-7" />,
          btn: 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white shadow-amber-500/25',
          titleColor: 'text-amber-300'
        };
      case 'success':
        return {
          bgGlow: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
          border: 'border-emerald-500/40',
          topLine: 'from-emerald-500 via-teal-400 to-emerald-600',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          icon: <CheckCircle2 className="w-7 h-7" />,
          btn: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25',
          titleColor: 'text-emerald-300'
        };
      case 'danger':
      default:
        return {
          bgGlow: 'from-red-500/20 via-red-500/10 to-transparent',
          border: 'border-red-500/40',
          topLine: 'from-red-500 via-rose-500 to-pink-600',
          iconBg: 'bg-red-500/20 text-red-400 border-red-500/30',
          icon: <ShieldAlert className="w-7 h-7" />,
          btn: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-500/25',
          titleColor: 'text-red-300'
        };
    }
  };

  const v = options ? getVariantStyles(options.variant) : null;

  return (
    <>
      {/* Floating Toast Notification Container (Top Center - Below TopBar) */}
      <div className="fixed top-20 sm:top-24 inset-x-0 z-[10000] flex flex-col items-center gap-3 pointer-events-none px-4" dir="rtl">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3.5 px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl border text-xs font-bold transition-all transform animate-bounce-short max-w-lg w-full justify-between relative overflow-hidden ${
              t.type === 'error'
                ? 'bg-slate-950/90 border-red-500/40 text-red-100 border-r-4 border-r-red-500 shadow-red-500/10'
                : t.type === 'warning'
                ? 'bg-slate-950/90 border-amber-500/40 text-amber-100 border-r-4 border-r-amber-500 shadow-amber-500/10'
                : t.type === 'info'
                ? 'bg-slate-950/90 border-cyan-500/40 text-cyan-100 border-r-4 border-r-cyan-500 shadow-cyan-500/10'
                : 'bg-slate-950/90 border-emerald-500/40 text-emerald-100 border-r-4 border-r-emerald-500 shadow-emerald-500/10'
            }`}
          >
            {/* Soft Ambient Glow */}
            <div className={`absolute -right-10 top-0 bottom-0 w-24 pointer-events-none opacity-20 bg-gradient-to-l ${
              t.type === 'error' ? 'from-red-500' :
              t.type === 'warning' ? 'from-amber-500' :
              t.type === 'info' ? 'from-cyan-500' : 'from-emerald-500'
            } to-transparent`} />

            <div className="flex items-center gap-3.5 relative z-10">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                t.type === 'error' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                t.type === 'warning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                t.type === 'info' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {t.type === 'error' && <ShieldAlert size={18} />}
                {t.type === 'warning' && <AlertTriangle size={18} />}
                {t.type === 'info' && <Info size={18} />}
                {t.type === 'success' && <CheckCircle2 size={18} />}
              </div>
              <span className="leading-relaxed text-sm font-semibold">
                {typeof t.message === 'object' && t.message !== null 
                  ? ((t.message as any).title ? `${(t.message as any).title}: ${(t.message as any).message || ''}` : ((t.message as any).message || JSON.stringify(t.message)))
                  : String(t.message || '')}
              </span>
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 relative z-10 shrink-0 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Center Confirmation Modal */}
      {isOpen && options && v && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          dir="rtl"
        >
          <div
            className={`bg-[#0c1017]/95 border ${v.border} rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)] relative animate-scale-up`}
          >
            {/* Top Glowing Bar */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${v.topLine}`} />

            {/* Inner Glowing Backdrop */}
            <div className={`absolute top-0 inset-x-0 h-32 bg-gradient-to-b ${v.bgGlow} pointer-events-none`} />

            <div className="p-6 md:p-8 space-y-6 relative z-10">
              {/* Header Icon & Title */}
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl ${v.iconBg} border flex items-center justify-center shrink-0 shadow-lg`}>
                  {v.icon}
                </div>

                <div className="space-y-1.5 flex-1">
                  <h3 className={`text-lg font-bold ${v.titleColor}`}>
                    {options.title || 'تأكيد الإجراء'}
                  </h3>
                  <p className="text-sm text-gray-200 font-medium leading-relaxed">
                    {options.message}
                  </p>
                  {options.subMessage && (
                    <p className="text-xs text-gray-400 leading-relaxed mt-1">
                      {options.subMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className={`flex-1 ${v.btn} font-bold py-3 px-5 rounded-2xl shadow-lg transition-all text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>جاري التنفيذ...</span>
                    </>
                  ) : (
                    <span>{options.confirmText || 'نعم، تأكيد التنفيذ'}</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (options.onCancel) options.onCancel();
                    close();
                  }}
                  disabled={isLoading}
                  className="px-5 py-3 bg-white/10 hover:bg-white/20 text-gray-300 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  {options.cancelText || 'إلغاء'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
