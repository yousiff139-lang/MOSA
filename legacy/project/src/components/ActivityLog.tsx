import { ShieldAlert, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { ActivityLog as LogType } from '../types';
import { useSmartHomeStore } from '../store/useSmartHomeStore';

interface ActivityLogProps {
  logs: LogType[];
}

export function ActivityLog({ logs }: ActivityLogProps) {
  const clearLogs = useSmartHomeStore(state => state.clearActivityLogs);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-white/10 pb-6 gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white drop-shadow-md mb-2">النظام الأمني</h2>
          <p className="text-sm text-gray-500">تاريخ التنبيهات الصادرة من حساسات الحركة - يُحفظ تلقائياً</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide w-full md:w-auto">
          {logs.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('هل أنت متأكد من حذف جميع السجلات؟')) clearLogs();
              }}
              className="flex items-center gap-2 bg-red-500 text-white shadow-lg shadow-red-500/30 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap"
            >
              <Trash2 size={18} />
              حذف السجل
            </button>
          )}
        </div>
      </header>

      <div className="animate-fade-in relative">
        <div className="glass-panel rounded-3xl p-6 md:p-8 shadow-xl">
          {logs.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10 shadow-inner">
                <ShieldAlert size={48} className="text-gray-400 dark:text-gray-500 drop-shadow-md" />
              </div>
              <p className="text-xl font-bold text-gray-700 dark:text-gray-300">لا يوجد أي حركات مسجلة</p>
              <p className="text-gray-500 dark:text-gray-400 mt-2">النظام آمن ولم يتم رصد أي اختراق.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 bg-black/5 dark:bg-black/20 rounded-2xl border-l-4 border-l-red-500 border border-white/5 transition-all hover:bg-black/10 dark:hover:bg-white/5 hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-red-500/20 p-3 rounded-full text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                        {log.message}
                      </h3>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mt-1">
                        <Clock size={14} />
                        <span dir="ltr">{new Date(log.timestamp).toLocaleString('ar-EG')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
