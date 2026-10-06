"use client";

import { useState, useEffect } from 'react';
import { 
  ShieldAlert, Clock, AlertTriangle, Trash2, Cpu, 
  Settings, HelpCircle, Activity, Search, Filter, Info, Save, Calendar
} from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { confirmAction, notify } from '@/store/useConfirmStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';

interface LogEntry {
  id: string;
  message: string;
  timestamp: Date | string;
  type: 'AUTOMATION' | 'SYSTEM' | 'USER_ACTION' | 'AI';
  details?: string;
}

export function ActivityLog({ logs: initialLogs }: { logs?: any[] }) {
  const [logsList, setLogsList] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const isEn = useRuntimeStore(s => s.lang) === 'en';
  
  // Log Retention Policy State
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [isSavingRetention, setIsSavingRetention] = useState(false);

  const storeLogs = useSmartHomeStore(s => s.activityLogs);

  useEffect(() => {
    loadLogsData();
    loadRetentionSettings();
  }, []);

  useEffect(() => {
    if (storeLogs && storeLogs.length > 0) {
      setLogsList(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newEntries = storeLogs.filter(s => s.id && !existingIds.has(s.id));
        if (newEntries.length === 0) return prev;
        return [...newEntries, ...prev] as LogEntry[];
      });
    }
  }, [storeLogs]);

  const loadLogsData = async () => {
    setLoading(true);
    try {
      const res = await fetchAuth('/api/logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLogsList(data);
        }
      }
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadRetentionSettings = async () => {
    try {
      const res = await fetchAuth('/api/logs/retention');
      if (res.ok) {
        const data = await res.json();
        if (data.retentionDays) setRetentionDays(data.retentionDays);
      }
    } catch (e) {
      console.error('Failed to load retention settings:', e);
    }
  };

  const handleClearLogs = () => {
    confirmAction({
      title: 'مسح جميع السجلات 🗑️',
      message: 'هل أنت متأكد من مسح كافة سجلات النظام وقراءات الـ ESP32 نهائياً؟',
      subMessage: 'لا يمكن استرجاع السجلات والقراءات السابقة بعد تأكيد المسح.',
      variant: 'danger',
      confirmText: 'نعم، مسح جميع السجلات',
      cancelText: 'إلغاء',
      onConfirm: async () => {
        try {
          const res = await fetchAuth('/api/logs', { method: 'DELETE' });
          if (res.ok) {
            notify('تم مسح كافة السجلات من قاعدة البيانات بنجاح! 🧹', 'success');
            setLogsList([]);
          } else {
            notify('حدث خطأ أثناء المسح', 'error');
          }
        } catch (e) {
          notify('خطأ في الاتصال بالخادم', 'error');
        }
      }
    });
  };

  const handleSaveRetention = async (newDays: number) => {
    setIsSavingRetention(true);
    setRetentionDays(newDays);
    try {
      const res = await fetchAuth('/api/logs/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: newDays })
      });
      const data = await res.json();
      if (res.ok) {
        notify(`تم تفعيل الحذف التلقائي للسجلات القديمة بعد ${newDays} يوم بنجاح! 🧹`, 'success');
        loadLogsData();
      }
    } catch (e) {
      notify('حدث خطأ أثناء حفظ إعدادات الاحتفاظ بالسجلات', 'error');
    } finally {
      setIsSavingRetention(false);
    }
  };

  // Extended filtering by category tab
  const filteredLogs = logsList.filter(l => {
    const textMatch = (l.message || '').includes(searchTerm) || (l.details || '').includes(searchTerm);
    if (!textMatch) return false;

    if (filterType === 'ALL') return true;
    if (filterType === 'TOGGLE') return (l.message || '').includes('تشغيل') || (l.message || '').includes('إطفاء') || (l.message || '').includes('مفتاح');
    if (filterType === 'LOGIN') return (l.message || '').includes('تسجيل الدخول') || (l.message || '').includes('دخول');
    if (filterType === 'ESP32') return (l.message || '').includes('ESP32') || (l.message || '').includes('اتصال') || l.type === 'SYSTEM';
    if (filterType === 'AUTOMATION') return l.type === 'AUTOMATION' || (l.message || '').includes('الأتمتة');
    return l.type === filterType;
  });

  const toggleCount = logsList.filter(l => (l.message || '').includes('تشغيل') || (l.message || '').includes('إطفاء')).length;
  const loginCount = logsList.filter(l => (l.message || '').includes('تسجيل الدخول')).length;
  const espCount = logsList.filter(l => (l.message || '').includes('ESP32') || (l.message || '').includes('اتصال')).length;

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Top Control Header & Summary Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Activity className="text-emerald-400" size={28} />
            سجلات النظام والتاريخ الحية
          </h2>
          <p className="text-gray-400 text-xs mt-1">تتبع أحداث تشغيل لوحات الـ ESP32 وإجراءات المستخدمين والتنبيهات</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleClearLogs}
            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs shadow-lg"
          >
            <Trash2 size={16} />
            حذف كافة السجلات من قاعدة البيانات
          </button>
        </div>
      </div>

      {/* Retention & Auto-Delete Settings Control Banner */}
      <div className="bg-gradient-to-r from-[#111827] via-[#1a2333] to-[#111827] border border-blue-500/20 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Calendar size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              إعدادات مدة الاحتفاظ بالسجلات والحذف التلقائي
            </h3>
            <p className="text-gray-400 text-xs mt-1">حدد كم يوم يتم حفظ التحديثات الأخيرة قبل إسقاطها وحذفها تلقائياً لتوفير المساحة</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-xs text-gray-400 font-bold whitespace-nowrap">الاحتفاظ لمدة:</span>
          <select 
            value={retentionDays}
            onChange={(e) => handleSaveRetention(Number(e.target.value))}
            disabled={isSavingRetention}
            className="bg-black/60 border border-blue-500/40 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value={1}>1 يوم (24 ساعة)</option>
            <option value={7}>7 أيام (أسبوع واحد)</option>
            <option value={14}>14 يوم (أسبوعين)</option>
            <option value={30}>30 يوم (شهر كامل)</option>
            <option value={90}>90 يوم (3 أشهر)</option>
            <option value={365}>365 يوم (سنة كاملة)</option>
          </select>
        </div>
      </div>

      {/* 📊 Control Bar Table & Filter Buttons */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-4 md:p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <span className="text-white font-bold text-sm flex items-center gap-2">
            <Filter size={18} className="text-cyan-400" />
            جدول التحكم وتصنيف الأوامر الحية
          </span>
          <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            بث لحظي مباشر (Socket.IO)
          </span>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'ALL', label: 'جميع السجلات', count: logsList.length, color: 'blue' },
            { id: 'TOGGLE', label: 'أوامر التشغيل والإطفاء', count: toggleCount, color: 'emerald' },
            { id: 'LOGIN', label: 'تسجيلات الدخول', count: loginCount, color: 'purple' },
            { id: 'ESP32', label: 'لوحات الـ ESP32', count: espCount, color: 'cyan' },
            { id: 'AUTOMATION', label: 'الأتمتة التلقائية', count: logsList.filter(l => l.type === 'AUTOMATION').length, color: 'amber' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                filterType === tab.id
                  ? 'bg-blue-600 text-white border-blue-400 shadow-lg scale-105'
                  : 'bg-black/40 text-gray-400 border-white/10 hover:border-white/20 hover:text-white'
              }`}
            >
              {tab.label}
              <span className="px-2 py-0.5 rounded-md text-[10px] bg-white/10 font-mono">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative pt-2">
          <Search className="absolute right-3.5 top-5 text-gray-500" size={18} />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث في تفاصيل السجل (مثال: admin، المطبخ 4/5، ESP32، تسجيل الدخول)..."
            className="w-full bg-black/60 border border-white/10 rounded-2xl pr-10 pl-4 py-3 text-xs text-white outline-none focus:border-blue-500 font-bold"
          />
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">جاري تحميل السجلات...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-500 bg-white/5 border border-white/10 rounded-3xl">
            لا توجد سجلات مطابقة للبحث حالياً.
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="p-5 rounded-2xl bg-[#11151c]/90 border border-white/10 hover:border-white/20 transition-all flex items-start gap-4 shadow-lg">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                log.type === 'AUTOMATION' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                log.type === 'SYSTEM' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                'bg-purple-500/10 border-purple-500/30 text-purple-400'
              }`}>
                {log.type === 'AUTOMATION' ? <Activity size={20} /> : log.type === 'SYSTEM' ? <Cpu size={20} /> : <Settings size={20} />}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-white font-bold text-sm">{log.message}</h4>
                  <span className="text-[11px] text-gray-400 bg-white/5 px-2.5 py-1 rounded-md font-mono flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(log.timestamp).toLocaleTimeString(isEn ? 'en-US' : 'ar-EG')}
                  </span>
                </div>
                {log.details && (
                  <p className="text-gray-400 text-xs leading-relaxed bg-black/30 p-2.5 rounded-xl border border-white/5 mt-2 font-mono">
                    {log.details}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
