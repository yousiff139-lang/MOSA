"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Grid, Cpu, Lightbulb, Check, ChevronLeft, ChevronRight, 
  Sparkles, Power, HelpCircle, ShieldAlert, Thermometer, Zap
} from 'lucide-react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { AnimatedButton } from '@/components/ui/AnimatedButton';
import { GlassCard } from '@/components/ui/GlassCard';

export default function SetupWizard() {
  const router = useRouter();
  const { initBackendConnection } = useSmartHomeStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Form State
  const [homeName, setHomeName] = useState('منزلي الذكي');
  const [selectedRooms, setSelectedRooms] = useState<string[]>([
    'الصالة', 'المطبخ', 'غرفة النوم'
  ]);
  
  const [newRoom, setNewRoom] = useState('');
  const [deviceType, setDeviceType] = useState('light');
  const [deviceName, setDeviceName] = useState('الإضاءة الرئيسية');
  const [deviceRoom, setDeviceRoom] = useState('الصالة');
  
  const [testDeviceState, setTestDeviceState] = useState(false);

  const availableRoomsList = [
    'الصالة', 'المطبخ', 'غرفة النوم', 'الحديقة', 'المرآب', 'الحمام', 'المكتب'
  ];

  const toggleRoomSelection = (roomName: string) => {
    if (selectedRooms.includes(roomName)) {
      if (selectedRooms.length > 1) {
        setSelectedRooms(selectedRooms.filter(r => r !== roomName));
      }
    } else {
      setSelectedRooms([...selectedRooms, roomName]);
    }
  };

  const handleAddCustomRoom = () => {
    if (newRoom.trim() && !selectedRooms.includes(newRoom.trim())) {
      setSelectedRooms([...selectedRooms, newRoom.trim()]);
      setNewRoom('');
    }
  };

  const handleFinishWizard = async () => {
    setLoading(true);
    try {
      const { fetchAuth } = await import('@/store/useSmartHomeStore');
      
      // 1. Create Home Configuration / Rooms
      // For demonstration and robustness, we seed default configurations on the server
      const setupPayload = {
        homeName,
        rooms: selectedRooms,
        firstDevice: {
          name: deviceName,
          type: deviceType,
          room: deviceRoom
        }
      };

      const res = await fetchAuth('/api/setup/wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupPayload)
      });

      if (res.ok) {
        setSuccessMsg('تم تهيئة منزلك الذكي بنجاح! جاري الانتقال...');
        // Refresh connection
        initBackendConnection();
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } else {
        // Localstorage fallback for demo or standalone
        localStorage.setItem('mosa_wizard_completed', 'true');
        setSuccessMsg('تم حفظ الإعدادات محلياً! جاري الانتقال...');
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      }
    } catch (e) {
      localStorage.setItem('mosa_wizard_completed', 'true');
      setSuccessMsg('تم التثبيت محلياً بنجاح!');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden" dir="rtl">
      {/* Background Ambient Mesh Gradients */}
      <div className="absolute top-[-20%] left-[-15%] w-[80vw] h-[80vw] rounded-full blur-[140px] opacity-20 bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-15%] w-[80vw] h-[80vw] rounded-full blur-[160px] opacity-20 bg-gradient-to-tr from-cyan-500/20 via-indigo-500/10 to-transparent pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10 text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-primary to-cyan-500 shadow-[0_0_30px_var(--primary-glow)] mb-4 border border-white/10">
          <Sparkles size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">معالج تهيئة المنزل الذكي</h1>
        <p className="text-sm text-slate-400 mt-2">خطوات بسيطة وسريعة لتأسيس غرفك وأجهزتك الأولى</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        {/* Progress Bar */}
        <div className="mb-8 px-6 flex justify-between items-center relative">
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-white/5 z-0 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-cyan-500 to-primary"
              animate={{ width: `${((step - 1) / 2) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {[1, 2, 3].map((num) => (
            <div key={num} className="relative z-10 flex flex-col items-center">
              <motion.div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border font-bold text-sm transition-all duration-300 ${
                  step >= num 
                    ? 'bg-primary border-primary text-white shadow-[0_0_15px_var(--primary-glow)]' 
                    : 'bg-slate-900 border-white/10 text-slate-500'
                }`}
                animate={{ scale: step === num ? 1.15 : 1 }}
              >
                {step > num ? <Check size={16} /> : num}
              </motion.div>
              <span className={`text-[11px] font-bold mt-2 ${step >= num ? 'text-white' : 'text-slate-500'}`}>
                {num === 1 ? 'الغرف والمنزل' : num === 2 ? 'جهازك الأول' : 'اختبار التشغيل'}
              </span>
            </div>
          ))}
        </div>

        <GlassCard className="p-8 backdrop-blur-2xl border border-white/10 bg-black/40 shadow-2xl rounded-[2.5rem]">
          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-center font-bold text-sm flex items-center justify-center gap-2"
            >
              <Check size={18} /> {successMsg}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <Home className="text-primary" size={20} /> تسمية المنزل الذكي
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">اختر اسماً فريداً للتعرف على منزلك.</p>
                  <input
                    type="text"
                    value={homeName}
                    onChange={(e) => setHomeName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent text-right"
                    placeholder="مثال: فيلا الياسمين"
                  />
                </div>

                <div className="pt-4 border-t border-white/5">
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <Grid className="text-primary" size={20} /> تحديد الغرف المتوفرة
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">اختر الغرف التي ترغب في التحكم بملحقاتها حالياً:</p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {availableRoomsList.map((room) => {
                      const isSelected = selectedRooms.includes(room);
                      return (
                        <button
                          key={room}
                          onClick={() => toggleRoomSelection(room)}
                          className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all border ${
                            isSelected 
                              ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(0,240,255,0.1)]' 
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {room}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newRoom}
                      onChange={(e) => setNewRoom(e.target.value)}
                      placeholder="إضافة غرفة مخصصة..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-2.5 px-4 text-white text-xs placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      onClick={handleAddCustomRoom}
                      className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition-colors border border-white/10"
                    >
                      إضافة
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <Cpu className="text-primary" size={20} /> تسجيل جهازك الأول
                  </h3>
                  <p className="text-xs text-slate-400 mb-6">دعنا ننشئ جهازاً تجريبياً أولاً لتجربة نظام التحكم.</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    {[
                      { id: 'light', name: 'إضاءة', icon: Lightbulb, color: 'text-amber-400 bg-amber-400/10' },
                      { id: 'ac', name: 'مكيف', icon: Thermometer, color: 'text-blue-400 bg-blue-400/10' },
                      { id: 'power', name: 'مأخذ طاقة', icon: Zap, color: 'text-emerald-400 bg-emerald-400/10' },
                      { id: 'security', name: 'حماية', icon: ShieldAlert, color: 'text-rose-400 bg-rose-400/10' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setDeviceType(t.id)}
                        className={`p-5 rounded-3xl border flex flex-col items-center justify-center gap-3 transition-all ${
                          deviceType === t.id
                            ? 'bg-primary/10 border-primary shadow-[0_0_15px_var(--primary-glow)] text-white'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className={`p-2 rounded-2xl ${t.color}`}>
                          <t.icon size={22} />
                        </div>
                        <span className="text-xs font-bold">{t.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">اسم الجهاز</label>
                      <input
                        type="text"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-2">الغرفة التابع لها</label>
                      <select
                        value={deviceRoom}
                        onChange={(e) => setDeviceRoom(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none"
                      >
                        {selectedRooms.map((room) => (
                          <option key={room} value={room}>{room}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 text-center"
              >
                <div className="flex flex-col items-center">
                  <h3 className="text-xl font-bold text-white mb-2">تجربة واختبار التحكم 💡</h3>
                  <p className="text-xs text-slate-400 mb-8">اضغط على زر التشغيل لتجربة سرعة وتفاعل النظام الزجاجي.</p>

                  {/* Device Control Card */}
                  <motion.div 
                    className={`p-8 rounded-[2rem] border transition-all duration-300 ${
                      testDeviceState 
                        ? 'bg-primary/10 border-primary shadow-[0_0_30px_var(--primary-glow)] w-64'
                        : 'bg-white/5 border-white/10 w-64'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-6">
                      <motion.div
                        animate={{ 
                          scale: testDeviceState ? [1, 1.1, 1] : 1,
                          rotate: testDeviceState ? [0, 5, -5, 0] : 0 
                        }}
                        className={`w-16 h-16 rounded-full flex items-center justify-center ${
                          testDeviceState ? 'bg-amber-400/20 text-amber-400' : 'bg-white/5 text-slate-500'
                        }`}
                      >
                        {deviceType === 'light' ? <Lightbulb size={36} /> : <Power size={36} />}
                      </motion.div>

                      <div>
                        <h4 className="font-bold text-lg text-white">{deviceName}</h4>
                        <p className="text-xs text-slate-500 mt-1">{deviceRoom}</p>
                      </div>

                      <button
                        onClick={() => setTestDeviceState(!testDeviceState)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${
                          testDeviceState
                            ? 'bg-amber-400 border-amber-400 text-black shadow-lg shadow-amber-400/40'
                            : 'bg-black/40 border-white/10 text-white hover:bg-white/5'
                        }`}
                      >
                        <Power size={20} />
                      </button>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-white/5 flex justify-between gap-4">
            {step > 1 ? (
              <AnimatedButton
                onClick={() => setStep(step - 1)}
                variant="outline"
                className="px-6 py-3 rounded-2xl flex items-center gap-2 border-white/10 text-slate-400 hover:text-white"
                disabled={loading}
              >
                السابق
              </AnimatedButton>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <AnimatedButton
                onClick={() => setStep(step + 1)}
                variant="primary"
                className="px-6 py-3 rounded-2xl flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold"
              >
                التالي <ChevronLeft size={16} />
              </AnimatedButton>
            ) : (
              <AnimatedButton
                onClick={handleFinishWizard}
                disabled={loading}
                variant="primary"
                className="px-8 py-3 rounded-2xl bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/95 hover:to-cyan-400/95 text-white font-bold shadow-lg shadow-primary/30"
              >
                {loading ? 'جاري الحفظ والتشغيل...' : 'إنهاء الإعداد والبدء'}
              </AnimatedButton>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
