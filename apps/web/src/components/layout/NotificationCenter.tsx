"use client";

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, ShieldAlert, CheckCircle, Info, Zap, Cpu, ArrowRight, Trash2 } from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import Link from 'next/link';

interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'ALERT' | 'SUCCESS' | 'INFO' | 'DEVICE' | 'SYSTEM';
  timestamp: number | string | Date;
  read: boolean;
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const activityLogs = useSmartHomeStore(state => state.activityLogs);
  const socket = useSmartHomeStore(state => state.socket);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('mosa_read_notification_ids');
        return new Set(stored ? JSON.parse(stored) : []);
      } catch {
        return new Set();
      }
    }
    return new Set();
  });

  const lang = useRuntimeStore(state => state.lang);
  const isEn = lang === 'en';

  // Re-register socket listener when socket becomes available
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (logEntry: any) => {
      if (logEntry && (logEntry.message || logEntry.details || logEntry.title || logEntry.action)) {
        // Force a store update to trigger re-render
        useSmartHomeStore.setState((state) => ({
          activityLogs: [
            {
              id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              message: logEntry.message || logEntry.action || logEntry.title,
              details: logEntry.details,
              type: logEntry.type || 'SYSTEM',
              timestamp: logEntry.timestamp || new Date().toISOString()
            },
            ...state.activityLogs
          ].slice(0, 500)
        }));
      }
    };

    socket.on('notification', handleNotification);
    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket]);

  // Merge activityLogs from store into unified notifications
  const allNotifications: SystemNotification[] = useMemo(() => {
    const rawList = [...(activityLogs || [])];
    const seenIds = new Set<string>();
    const list: SystemNotification[] = [];

    for (const item of rawList) {
      const id = String(item.id || item.timestamp || Math.random());
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const msg = item.message || item.details || item.title || '';
      let type: SystemNotification['type'] = 'INFO';
      let title = isEn ? 'System Update' : 'تنبيه النظام';

      if (item.type === 'AUTOMATION' || msg.includes('أتمتة') || msg.includes('automation')) {
        type = 'SUCCESS';
        title = isEn ? 'Automation Triggered' : 'تشغيل أتمتة';
      } else if (msg.includes('ESP') || msg.includes('جهاز') || msg.includes('device') || item.type === 'DEVICE') {
        type = 'DEVICE';
        title = isEn ? 'Device Activity (ESP)' : 'نشاط الأجهزة (ESP)';
      } else if (item.type === 'ALERT' || msg.includes('تحذير') || msg.includes('alert') || msg.includes('خطر')) {
        type = 'ALERT';
        title = isEn ? 'Security Alert' : 'تنبيه أمني';
      } else if (item.type === 'SYSTEM' || msg.includes('نظام') || msg.includes('system')) {
        type = 'SYSTEM';
        title = isEn ? 'MOSA OS Event' : 'حدث المنظومة';
      }

      list.push({
        id,
        title: item.title || title,
        message: msg,
        type,
        timestamp: item.timestamp || Date.now(),
        read: readIds.has(id)
      });
    }

    list.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    return list.slice(0, 30);
  }, [activityLogs, readIds, isEn]);

  const unreadCount = allNotifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const updated = new Set(readIds);
    allNotifications.forEach(n => updated.add(n.id));
    setReadIds(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('mosa_read_notification_ids', JSON.stringify(Array.from(updated).slice(-200)));
      } catch {}
    }
  };

  const handleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
  };

  return (
    <div className="relative">
      {/* 🔔 Standalone Notification Bell Button */}
      <button 
        id="topbar-notification-btn"
        onClick={handleOpen}
        className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 hover:border-cyan-400/50 flex items-center justify-center text-cyan-300 hover:text-white transition-all duration-300 shadow-sm hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] group shrink-0 active:scale-95 cursor-pointer"
        title={isEn ? "Live Notifications & Alerts" : "مركز الإشعارات والتنبيهات الحية"}
        aria-label="Notification Center"
      >
        <Bell size={17} className="transition-transform duration-300 group-hover:scale-110 text-cyan-300 group-hover:text-cyan-200" />
        
        {/* Dynamic Badge Counter */}
        {unreadCount > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(244,63,94,0.9)] border-2 border-[#090e17] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : (
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
        )}
      </button>

      {/* Dropdown Modal Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click-outside backdrop */}
            <div 
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" 
              onClick={() => setIsOpen(false)} 
            />

            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className={`absolute top-full mt-2.5 ${isEn ? 'right-0' : 'left-0'} w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-slate-950/95 border border-cyan-500/30 rounded-3xl p-4 shadow-2xl backdrop-blur-2xl z-50 text-start overflow-hidden`}
              dir={isEn ? 'ltr' : 'rtl'}
            >
              {/* Drawer Header */}
              <div className="p-3 border-b border-white/10 flex justify-between items-center bg-white/[0.02] rounded-2xl mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Bell size={14} />
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-white">
                    {isEn ? 'Live Notification Center' : 'مركز الإشعارات والتنبيهات الحية'}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllRead}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all cursor-pointer"
                    >
                      {isEn ? 'Mark all read' : 'تحديد كمقروء'}
                    </button>
                  )}
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              {/* Notification Items List */}
              <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {allNotifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20">
                      <Bell size={18} />
                    </div>
                    <p className="text-slate-300 font-bold">{isEn ? 'No notifications yet' : 'لا توجد تنبيهات حالياً'}</p>
                    <p className="text-[10px] text-emerald-400 font-mono">
                      {isEn ? 'All systems operating normally 🟢' : 'جميع أنظمة المنزل تعمل بكفاءة عالية 🟢'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {allNotifications.map((notif) => {
                      const timeStr = notif.timestamp 
                        ? new Date(notif.timestamp).toLocaleTimeString(isEn ? 'en-US' : 'ar-EG', { hour: '2-digit', minute: '2-digit' })
                        : (isEn ? 'Now' : 'الآن');

                      return (
                        <div 
                          key={notif.id}
                          className={`p-3 rounded-2xl border transition-all ${
                            !notif.read 
                              ? 'bg-gradient-to-r from-blue-950/50 to-slate-900/80 border-cyan-500/40 shadow-md' 
                              : 'bg-white/[0.02] border-white/5 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="shrink-0 mt-0.5">
                              {notif.type === 'ALERT' && <ShieldAlert size={16} className="text-rose-400 animate-pulse" />}
                              {notif.type === 'DEVICE' && <Cpu size={16} className="text-amber-400" />}
                              {notif.type === 'SUCCESS' && <CheckCircle size={16} className="text-emerald-400" />}
                              {notif.type === 'SYSTEM' && <Zap size={16} className="text-purple-400" />}
                              {notif.type === 'INFO' && <Info size={16} className="text-cyan-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="text-xs font-bold text-white truncate">{notif.title}</span>
                                <span className="text-[9px] text-slate-400 font-mono shrink-0">{timeStr}</span>
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed break-words">{notif.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Drawer Footer Link to Full Logs */}
              <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center text-xs">
                <Link 
                  href="/logs"
                  onClick={() => setIsOpen(false)}
                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors text-[11px]"
                >
                  <span>{isEn ? 'View all system logs & history' : 'عرض جميع السجلات والتنبيهات'}</span>
                  <ArrowRight size={13} className={isEn ? '' : 'rotate-180'} />
                </Link>
                <span className="text-[10px] text-slate-500">
                  {allNotifications.length} {isEn ? 'events' : 'أحداث'}
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
