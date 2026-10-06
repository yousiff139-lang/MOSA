"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Droplets, Power, Timer, Sprout, CloudRain, Clock, Trash2, Plus, Gauge,
  Check, AlertCircle, Play, Pause, RefreshCw, X
} from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import AddDeviceModal from '@/components/dashboard-ui/AddDeviceModal';
import { createPortal } from 'react-dom';

interface Schedule {
  id: string;
  name: string;
  schedule: string;
  actions: any[];
}

export default function IrrigationPage() {
  const devices = useSmartHomeStore(state => state.devices);
  const toggleDevice = useSmartHomeStore(state => state.toggleDevice);
  const initBackendConnection = useSmartHomeStore(state => state.initBackendConnection);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [irrigationToast, setIrrigationToast] = useState('');
  
  // Soil Moisture threshold configuration per pump ID
  const [pumpThresholds, setPumpThresholds] = useState<Record<string, { threshold: number; sensorId: string; autoMode: boolean }>>({});

  // Countdown timer state per pump
  const [pumpTimers, setPumpTimers] = useState<Record<string, number>>({});

  // Schedule Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState('الري الصباحي الذكي');
  const [newScheduleTime, setNewScheduleTime] = useState('06:00');
  const [newScheduleDuration, setNewScheduleDuration] = useState('15');
  const [newSchedulePumpId, setNewSchedulePumpId] = useState('');

  // Filter pumps and soil moisture sensors
  const pumps = devices.filter(d => {
    const t = (d.type || '').toLowerCase();
    const n = (d.name || '').toLowerCase();
    return t === 'pump' || n.includes('مضخة') || n.includes('ماتور') || n.includes('ري') || n.includes('رشاش');
  });

  const moistureSensors = devices.filter(d => {
    const t = (d.type || '').toLowerCase();
    const n = (d.name || '').toLowerCase();
    return t === 'moisture' || n.includes('تربة') || n.includes('رطوبة') || n.includes('زرع');
  });

  const showToast = (msg: string) => {
    setIrrigationToast(msg);
    setTimeout(() => setIrrigationToast(''), 3000);
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      const res = await fetchAuth('/api/irrigation');
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduleName.trim() || !newSchedulePumpId) {
      showToast('يرجى تحديد اسم الجدول والمضخة');
      return;
    }

    const [hour, minute] = newScheduleTime.split(':');
    const cronExpression = `${minute || '0'} ${hour || '6'} * * *`;

    try {
      const res = await fetchAuth('/api/irrigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newScheduleName.trim(),
          schedule: cronExpression,
          deviceId: newSchedulePumpId,
          state: 'ON',
          durationMinutes: Number(newScheduleDuration) || 15
        })
      });

      if (res.ok) {
        showToast('تمت إضافة جدول الري بنجاح 🌱');
        setIsScheduleModalOpen(false);
        loadSchedules();
      }
    } catch (e) {
      console.error(e);
      showToast('فشل إضافة الجدول');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const res = await fetchAuth(`/api/irrigation/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('تم حذف الجدول بنجاح');
        loadSchedules();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updatePumpConfig = (pumpId: string | number, updates: Partial<{ threshold: number; sensorId: string; autoMode: boolean }>) => {
    setPumpThresholds(prev => ({
      ...prev,
      [String(pumpId)]: {
        ...(prev[String(pumpId)] || { threshold: 30, sensorId: '', autoMode: true }),
        ...updates
      }
    }));
    showToast('تم تحديث إعدادات الري التلقائي ✅');
  };

  const handleStartTimedWatering = (pumpId: string | number, minutes: number) => {
    toggleDevice(pumpId as any);
    setPumpTimers(prev => ({ ...prev, [String(pumpId)]: minutes * 60 }));
    showToast(`تم بدء الري لمدة ${minutes} دقيقة 💧`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8 pb-32 font-sans" dir="rtl">
      
      {/* Header Banner */}
      <header className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-emerald-950/50 via-teal-950/40 to-slate-950/80 border border-white/10 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.35)] shrink-0">
              <Droplets size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">منظومة الري والمضخات الذكية</h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">أتمتة ذكية لضخ المياه والري بناءً على حساسات رطوبة التربة الفعلية وقيم الـ ESP32</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {pumps.length > 0 && (
              <button
                onClick={() => {
                  setNewSchedulePumpId(String(pumps[0].id));
                  setIsScheduleModalOpen(true);
                }}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 font-bold rounded-2xl transition-all shadow-lg text-xs sm:text-sm cursor-pointer"
              >
                <Clock size={16} />
                <span>+ إضافة جدول زمني</span>
              </button>
            )}

            <button
              onClick={() => setIsAddOpen(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl transition-all shadow-lg text-xs sm:text-sm hover:scale-105 cursor-pointer"
            >
              <Plus size={18} />
              <span>إضافة مضخة أو حساس</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {irrigationToast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold px-4 py-3 rounded-2xl text-center shadow-lg"
        >
          {irrigationToast}
        </motion.div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Irrigation Pumps & Automatic Rules */}
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Droplets size={20} className="text-cyan-400" />
              المضخات وصمامات الري الكهربائية ({pumps.length})
            </h2>
            <span className="text-xs text-slate-400 font-medium">تحكم لحظي مباشر</span>
          </div>

          <AnimatePresence mode="popLayout">
            {pumps.map(d => {
              const pumpActive = d.state === 'ON';
              const config = pumpThresholds[d.id] || { threshold: 30, sensorId: '', autoMode: true };

              return (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative bg-[#0b101d]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 overflow-hidden shadow-2xl hover:border-cyan-500/30 transition-all"
                >
                  <div className={`absolute -top-32 -right-32 w-80 h-80 rounded-full blur-[90px] opacity-15 pointer-events-none transition-colors duration-700 ${
                    pumpActive ? 'bg-cyan-500' : 'bg-slate-700'
                  }`} />

                  <div className="relative z-10 flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        {d.name}
                      </h3>
                      <p className="text-slate-400 text-xs mt-1">
                        {(d.room as any)?.name || d.room || 'الحديقة'} • مضخة ري • منفذ ريلاي GPIO {d.pin}
                      </p>
                    </div>

                    <button 
                      onClick={() => toggleDevice(d.id.toString())}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                        pumpActive 
                          ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]' 
                          : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-white border border-white/5'
                      }`}
                      title={pumpActive ? 'إيقاف الضخ' : 'تشغيل الضخ'}
                    >
                      <Power size={22} />
                    </button>
                  </div>

                  {/* Quick Preset Timers (5m, 15m, 30m, 60m) */}
                  <div className="relative z-10 mb-4 bg-black/40 border border-white/10 p-3 rounded-2xl">
                    <span className="text-[11px] text-slate-400 font-bold block mb-2">تشغيل مؤقت بلمسة واحدة:</span>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 15, 30, 60].map(mins => (
                        <button
                          key={mins}
                          onClick={() => handleStartTimedWatering(String(d.id), mins)}
                          className="py-2 bg-white/5 hover:bg-cyan-600/30 border border-white/10 hover:border-cyan-400 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                        >
                          {mins} دقيقة
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ESP Soil Link Configuration */}
                  <div className="relative z-10 bg-black/40 border border-white/10 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-cyan-400 font-black block">إعداد الري التلقائي المعتمد على حساسات التربة</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.autoMode}
                          onChange={(e) => updatePumpConfig(d.id, { autoMode: e.target.checked })}
                          className="w-4 h-4 accent-emerald-500 rounded"
                        />
                        <span className="text-xs text-slate-300 font-bold">تفعيل الأوتوماتيك</span>
                      </label>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1 font-bold">ربط الحساس</label>
                        <select
                          value={config.sensorId}
                          onChange={(e) => updatePumpConfig(d.id, { sensorId: e.target.value })}
                          className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                        >
                          <option value="">لا يوجد حساس مرتبط</option>
                          {moistureSensors.map(sensor => (
                            <option key={sensor.id} value={sensor.id}>
                              {sensor.name} (GPIO {sensor.pin})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1 font-bold">بدء الضخ عندما تقل الرطوبة عن:</label>
                        <select
                          value={config.threshold}
                          onChange={(e) => updatePumpConfig(d.id, { threshold: Number(e.target.value) })}
                          className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                        >
                          <option value="20">أقل من 20% (تربة جافة جداً)</option>
                          <option value="30">أقل من 30% (تربة جافة)</option>
                          <option value="40">أقل من 40% (متوسط)</option>
                          <option value="50">أقل من 50% (رطوبة عالية)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {pumps.length === 0 && (
            <div className="py-14 flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
              <Droplets size={40} className="text-white/20 mb-3" />
              <p className="text-slate-400 text-xs sm:text-sm font-bold">لا توجد مضخات ري مسجلة حالياً.</p>
              <p className="text-slate-500 text-xs mt-1">أضف مضخة ري من الأعلى لربطها بمنفذ ريلاي الـ ESP32.</p>
            </div>
          )}
        </div>

        {/* Right Column: Moisture Sensors & Schedules */}
        <div className="space-y-8">
          
          {/* Soil Moisture Sensors Gauge */}
          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 px-2">
              <Gauge size={20} className="text-emerald-400" />
              حساسات رطوبة التربة ({moistureSensors.length})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {moistureSensors.map(sensor => {
                const humidityValue = (sensor as any).humidity || 38;
                const isDry = humidityValue < 30;

                return (
                  <div key={sensor.id} className="bg-[#0b101d]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 flex items-center justify-between shadow-xl">
                    <div>
                      <h4 className="font-bold text-white text-sm">{sensor.name}</h4>
                      <p className="text-slate-400 text-[10px] mt-1 font-mono">GPIO {sensor.pin} • {(sensor as any).controller?.name || 'ESP32 Node'}</p>
                      <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDry ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {isDry ? 'بحاجة للري ⚠️' : 'الرطوبة ممتازة 🌿'}
                      </span>
                    </div>

                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="32" cy="32" r="26" className="stroke-white/5 stroke-[4px] fill-transparent" />
                        <circle 
                          cx="32"
                          cy="32"
                          r="26"
                          className={`stroke-[4px] fill-transparent transition-all ${isDry ? 'stroke-orange-500' : 'stroke-emerald-500'}`}
                          strokeDasharray="163"
                          strokeDashoffset={163 - (163 * humidityValue) / 100}
                        />
                      </svg>
                      <span className="absolute text-xs font-black text-white font-mono">{humidityValue}%</span>
                    </div>
                  </div>
                );
              })}

              {moistureSensors.length === 0 && (
                <div className="col-span-2 py-10 flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
                  <p className="text-slate-400 text-xs">لا توجد حساسات رطوبة تربة مربوطة.</p>
                </div>
              )}
            </div>
          </div>

          {/* Schedules list */}
          <div className="bg-[#0b101d]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Clock size={20} className="text-purple-400"/> 
                جداول الري الزمنية التلقائية
              </h3>
            </div>
            
            <div className="space-y-3">
              {loadingSchedules ? (
                <div className="text-center text-xs text-slate-500 py-4">جاري تحميل الجداول...</div>
              ) : schedules.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-6 bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
                  لا توجد جداول زمنية مضافة حالياً.
                </div>
              ) : (
                schedules.map(sch => (
                  <div key={sch.id} className="p-4 border border-white/10 rounded-2xl flex justify-between items-center bg-black/40">
                    <div>
                      <h4 className="font-bold text-white text-sm">{sch.name.replace('irrigation_', '')}</h4>
                      <p className="text-slate-400 text-xs mt-1 font-mono">تكرار الجدول: {sch.schedule} (15 دقيقة ضخ)</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteSchedule(sch.id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors cursor-pointer"
                      title="حذف الجدول"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Add Schedule Modal */}
      <AnimatePresence>
        {isScheduleModalOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b101d] border border-emerald-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Clock size={18} className="text-emerald-400" />
                  إضافة جدول ري زمني جديد ⏰
                </h3>
                <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSchedule} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">اسم الجدول:</label>
                  <input
                    type="text"
                    required
                    value={newScheduleName}
                    onChange={(e) => setNewScheduleName(e.target.value)}
                    placeholder="مثال: الري الصباحي للحديقة"
                    className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-400 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المضخة المستهدفة:</label>
                  <select
                    value={newSchedulePumpId}
                    onChange={(e) => setNewSchedulePumpId(e.target.value)}
                    className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-400 font-bold cursor-pointer"
                  >
                    {pumps.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (GPIO {p.pin})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">وقت البدء اليومي:</label>
                    <input
                      type="time"
                      value={newScheduleTime}
                      onChange={(e) => setNewScheduleTime(e.target.value)}
                      className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">مدة الري (بالدقائق):</label>
                    <input
                      type="number"
                      value={newScheduleDuration}
                      onChange={(e) => setNewScheduleDuration(e.target.value)}
                      min="1"
                      max="120"
                      className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-400 font-bold"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t border-white/10">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-lg cursor-pointer"
                  >
                    حفظ وتفعيل الجدول 🌱
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      <AddDeviceModal 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        onSuccess={() => {
          setIsAddOpen(false);
          initBackendConnection();
        }}
      />
    </div>
  );
}
