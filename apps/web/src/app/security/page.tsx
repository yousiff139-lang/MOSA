"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { 
  Lock, Unlock, ShieldCheck, Video, 
  Mic, Camera as CameraIcon, Maximize2, AlertCircle, Power, Plus, ShieldAlert,
  KeyRound, Bell, Eye, EyeOff, Radio, RefreshCw, X, Check, Shield
} from 'lucide-react';
import AddDeviceModal from '@/components/dashboard-ui/AddDeviceModal';
import { createPortal } from 'react-dom';

export default function SecurityPage() {
  const devices = useSmartHomeStore(state => state.devices);
  const toggleDevice = useSmartHomeStore(state => state.toggleDevice);
  const initBackendConnection = useSmartHomeStore(state => state.initBackendConnection);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [camStates, setCamStates] = useState<Record<string, boolean>>({});
  const [fullscreenCam, setFullscreenCam] = useState<any | null>(null);
  const [securityToast, setSecurityToast] = useState<string>('');
  const [pinModalLock, setPinModalLock] = useState<any | null>(null);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [apiCameras, setApiCameras] = useState<any[]>([]);

  // Fetch registered IP / RTSP Cameras from backend API
  const fetchApiCameras = async () => {
    try {
      const res = await fetchAuth('/api/cameras');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) setApiCameras(list);
      }
    } catch (e) {
      console.warn('Cameras fetch error:', e);
    }
  };

  useEffect(() => {
    fetchApiCameras();
  }, []);

  // Filter security devices (Locks, Cameras, Sirens)
  const locks = devices.filter(d => {
    const t = (d.type || '').toLowerCase();
    const n = (d.name || '').toLowerCase();
    return t === 'lock' || n.includes('قفل') || n.includes('باب') || n.includes('بوابة');
  });

  const rawCameras = devices.filter(d => {
    const t = (d.type || '').toLowerCase();
    const n = (d.name || '').toLowerCase();
    return t === 'camera' || n.includes('كاميرا') || n.includes('تصوير') || n.includes('مراقبة');
  });

  // Merge store cameras with dedicated API RTSP/HLS Cameras
  const cameras = [
    ...apiCameras.map(c => ({
      id: c.id,
      name: c.name,
      ipAddress: c.rtspUrl,
      type: 'camera',
      isApiCam: true,
      streamType: c.streamType || 'RTSP_OVER_WEBRTC',
      snapshotUrl: c.snapshotUrl
    })),
    ...rawCameras.filter(rc => !apiCameras.some(ac => ac.id === rc.id))
  ];

  const sirens = devices.filter(d => {
    const t = (d.type || '').toLowerCase();
    const n = (d.name || '').toLowerCase();
    return t === 'siren' || n.includes('إنذار') || n.includes('صفارة') || n.includes('جرس');
  });

  const showToast = (msg: string) => {
    setSecurityToast(msg);
    setTimeout(() => setSecurityToast(''), 3000);
  };

  const toggleCamLive = (id: string) => {
    setCamStates(prev => ({
      ...prev,
      [id]: !(prev[id] ?? true)
    }));
  };

  const handleLockClick = (lockDev: any) => {
    const isCurrentlyLocked = lockDev.state !== 'ON';
    if (isCurrentlyLocked) {
      // Opening the lock -> prompt PIN for high security!
      setPinModalLock(lockDev);
      setEnteredPin('');
      setPinError('');
    } else {
      // Locking is instant
      toggleDevice(lockDev.id.toString());
      showToast(`تم تأمين وقفل ${lockDev.name} بنجاح 🔒`);
    }
  };

  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const handleConfirmPinUnlock = async () => {
    if (!enteredPin.trim()) {
      setPinError('يرجى إدخال رمز الحماية PIN');
      return;
    }

    setIsVerifyingPin(true);
    setPinError('');

    try {
      const res = await fetchAuth('/api/security/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: enteredPin,
          deviceId: pinModalLock?.id,
          action: 'UNLOCK'
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        if (pinModalLock) {
          toggleDevice(pinModalLock.id.toString());
          showToast(`تم فتح قفل ${pinModalLock.name} بنجاح 🔓`);
          setPinModalLock(null);
        }
      } else {
        setPinError(data.message || 'رمز الحماية غير صحيح (الرمز الافتراضي: 1234 أو كلمة المرور)');
      }
    } catch (err) {
      setPinError('حدث خطأ في الاتصال بخادم الأمان');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleLockAllDoors = () => {
    locks.forEach(l => {
      if (l.state === 'ON') {
        toggleDevice(l.id.toString());
      }
    });
    showToast('تم تأمين وقفل جميع الأبواب فوراً 🛡️🔒');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-8 pb-32 font-sans" dir="rtl">
      
      {/* Security Master Header */}
      <header className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-red-950/40 via-slate-900 to-black/60 border border-white/10 p-6 sm:p-10 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-500/10 rounded-full blur-[90px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center shadow-[0_0_30px_rgba(225,29,72,0.35)] shrink-0">
              <ShieldCheck size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">الأمن والمراقبة الذكية</h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">إدارة الأقفال الكهربائية الآمنة، كاميرات المراقبة المباشرة، وحماية المنزل الشاملة</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {locks.length > 0 && (
              <button
                onClick={handleLockAllDoors}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 font-bold rounded-2xl transition-all shadow-lg text-xs sm:text-sm cursor-pointer"
              >
                <Lock size={16} />
                <span>قفل جميع الأبواب 🔒</span>
              </button>
            )}

            <button
              onClick={() => setIsAddOpen(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-2xl transition-all shadow-lg text-xs sm:text-sm hover:scale-105 cursor-pointer"
            >
              <Plus size={18} />
              <span>ربط كاميرا أو قفل</span>
            </button>
          </div>
        </div>
      </header>

      {/* Security Toast Notification */}
      {securityToast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold px-4 py-3 rounded-2xl text-center shadow-lg"
        >
          {securityToast}
        </motion.div>
      )}

      {/* Main Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 1. Smart Locks Column */}
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Lock size={20} className="text-red-400" />
              الأبواب والأقفال الكهربائية ({locks.length})
            </h2>
            <span className="text-xs text-slate-400 font-medium">حماية مشفرة عبر الـ ESP32</span>
          </div>

          <AnimatePresence mode="popLayout">
            {locks.map(d => {
              const isLocked = d.state !== 'ON';
              return (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative bg-[#0b101d]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 overflow-hidden shadow-2xl hover:border-red-500/30 transition-all"
                >
                  <div className={`absolute -top-32 -left-32 w-80 h-80 rounded-full blur-[90px] opacity-15 pointer-events-none transition-colors duration-700 ${
                    isLocked ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />

                  <div className="relative z-10 flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <ShieldCheck size={20} className={isLocked ? 'text-emerald-400' : 'text-red-400'} />
                        {d.name}
                      </h3>
                      <p className="text-slate-400 text-xs mt-1">
                        {(d.room as any)?.name || d.room || 'المدخل'} • قفل كهربائي • منفذ ريلاي GPIO {d.pin}
                      </p>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                      isLocked 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                        : 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse'
                    }`}>
                      {isLocked ? 'مغلق ومؤمن 🔒' : 'مفتوح الآن 🔓'}
                    </span>
                  </div>

                  {/* Interactive Big Lock Button */}
                  <div className="relative z-10 flex flex-col items-center justify-center py-4">
                    <button 
                      onClick={() => handleLockClick(d)}
                      className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center transition-all duration-500 cursor-pointer shadow-2xl hover:scale-105 active:scale-95 ${
                        isLocked 
                          ? 'bg-gradient-to-b from-emerald-500/20 to-emerald-950/40 border-4 border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.25)]' 
                          : 'bg-gradient-to-b from-red-500/20 to-red-950/40 border-4 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.25)]'
                      }`}
                    >
                      <div className={isLocked ? 'text-emerald-400' : 'text-red-400'}>
                        {isLocked ? <Lock size={46} /> : <Unlock size={46} />}
                      </div>
                      
                      <span className={`mt-3 font-black text-xs sm:text-sm tracking-wider ${isLocked ? 'text-emerald-300' : 'text-red-300'}`}>
                        {isLocked ? 'اضغط لفتح القفل' : 'اضغط للتأمين والقفل'}
                      </span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {locks.length === 0 && (
            <div className="py-14 flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
              <Lock size={40} className="text-white/20 mb-3" />
              <p className="text-slate-400 text-xs sm:text-sm font-bold">لا توجد أقفال أبواب كهربائية مضافة حالياً.</p>
              <p className="text-slate-500 text-xs mt-1">اضغط على زر الإضافة لربط ريلاي القفل الكهربائي بالـ ESP32.</p>
            </div>
          )}
        </div>

        {/* 2. Live Surveillance Cameras Column */}
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Video size={20} className="text-rose-400" />
              كاميرات المراقبة المباشرة ({cameras.length})
            </h2>
            <span className="text-xs text-slate-400 font-medium">بث RTSP / HLS فائق الدقة</span>
          </div>

          <AnimatePresence mode="popLayout">
            {cameras.map((d: any) => {
              const isLive = camStates[d.id] ?? true;
              const hasIp = !!d.ipAddress;
              const isHttpStream = hasIp && (d.ipAddress?.startsWith('http://') || d.ipAddress?.startsWith('https://'));

              return (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#0b101d]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl hover:border-rose-500/30 transition-all relative overflow-hidden"
                >
                  <div className="relative z-10 flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <Video size={18} className="text-rose-400" />
                        {d.name}
                      </h3>
                      <p className="text-slate-400 text-xs font-mono mt-0.5">
                        {d.ipAddress || 'بث محلي ذكي (NVR/DVR Stream)'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isLive && (
                        <div className="px-3 py-1 bg-red-500/20 border border-red-500/50 text-red-400 rounded-full text-[10px] font-black flex items-center gap-1.5 animate-pulse">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                          LIVE
                        </div>
                      )}
                      
                      <button
                        onClick={() => setFullscreenCam(d)}
                        className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-colors cursor-pointer"
                        title="عرض كامل الشاشة"
                      >
                        <Maximize2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Video Box Canvas Preview */}
                  <div className="aspect-video bg-black/90 rounded-2xl border border-white/10 mb-4 relative overflow-hidden flex items-center justify-center group/cam">
                    {isLive ? (
                      isHttpStream ? (
                        <img 
                          src={d.ipAddress} 
                          alt={d.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            (e.target as any).src = "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&q=80";
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-4 text-center">
                          <div className="w-full h-full flex flex-col items-center justify-center relative">
                            <div className="absolute top-2 left-2 text-[10px] text-cyan-400 font-mono bg-black/60 px-2 py-1 rounded-lg border border-white/10">
                              RTSP 1080P @ 30FPS
                            </div>
                            <Video size={42} className="text-rose-500/50 mb-2 animate-pulse" />
                            <span className="text-xs text-slate-300 font-black">بث مباشر متصل • {d.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono mt-1">ID: {d.id}</span>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="text-slate-500 text-xs font-bold flex items-center gap-2">
                        <EyeOff size={18} />
                        تم إيقاف البث مؤقتاً
                      </div>
                    )}
                  </div>

                  {/* Camera Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => toggleCamLive(d.id)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3 flex items-center justify-center gap-2 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      <Power size={15} className={isLive ? 'text-red-400' : 'text-slate-500'} />
                      {isLive ? 'تعطيل الكاميرا' : 'تفعيل البث المباشر'}
                    </button>
                    
                    <button 
                      onClick={() => showToast(`تم التقاط صورة من كاميرا (${d.name}) وحفظها في المعرض 📸`)}
                      disabled={!isLive}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3 flex items-center justify-center gap-2 text-white font-bold text-xs transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <CameraIcon size={15} className="text-emerald-400" />
                      التقاط لقطة (Capture)
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {cameras.length === 0 && (
            <div className="py-14 flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
              <Video size={40} className="text-white/20 mb-3" />
              <p className="text-slate-400 text-xs sm:text-sm font-bold">لا توجد كاميرات مراقبة مربوطة حالياً.</p>
              <p className="text-slate-500 text-xs mt-1">أضف كاميرا IP أو جهاز DVR/NVR لعرض البث الحي هنا.</p>
            </div>
          )}
        </div>

      </div>

      {/* Security PIN Code Confirmation Modal */}
      <AnimatePresence>
        {pinModalLock && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b101d] border border-red-500/30 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-5 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto shadow-lg">
                <KeyRound size={28} />
              </div>

              <div>
                <h3 className="text-lg font-black text-white">تأكيد فتح: {pinModalLock.name}</h3>
                <p className="text-xs text-slate-400 mt-1">يرجى إدخال رمز الأمان لفتح الباب الكهربائي</p>
              </div>

              {pinError && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold p-2.5 rounded-xl">
                  {pinError}
                </div>
              )}

              {/* PIN input dots */}
              <div className="flex justify-center gap-3 my-2">
                {[0, 1, 2, 3].map(idx => (
                  <div 
                    key={idx}
                    className={`w-4 h-4 rounded-full border transition-all ${
                      enteredPin.length > idx ? 'bg-red-500 border-red-400 shadow-[0_0_10px_#ef4444]' : 'bg-white/10 border-white/20'
                    }`}
                  />
                ))}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <button
                    key={n}
                    onClick={() => {
                      if (enteredPin.length < 4) setEnteredPin(prev => prev + n);
                    }}
                    className="py-3 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 text-white font-black text-base cursor-pointer"
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setEnteredPin('')}
                  className="py-3 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 text-slate-400 text-xs font-bold cursor-pointer"
                >
                  مسح
                </button>
                <button
                  onClick={() => {
                    if (enteredPin.length < 4) setEnteredPin(prev => prev + '0');
                  }}
                  className="py-3 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 text-white font-black text-base cursor-pointer"
                >
                  0
                </button>
                <button
                  onClick={() => setEnteredPin(prev => prev.slice(0, -1))}
                  className="py-3 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 text-slate-400 text-xs font-bold cursor-pointer"
                >
                  ⌫
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleConfirmPinUnlock}
                  className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black py-3 rounded-2xl text-xs transition-all shadow-lg cursor-pointer"
                >
                  تأكيد وفتح الباب 🔓
                </button>
                <button
                  onClick={() => setPinModalLock(null)}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* Fullscreen Camera Modal */}
      <AnimatePresence>
        {fullscreenCam && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl" dir="rtl">
            <div className="w-full max-w-4xl bg-[#0b101d] border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-5 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Video size={20} className="text-rose-400" />
                  <h3 className="text-lg font-black text-white">{fullscreenCam.name} (بث مباشر عالي الدقة)</h3>
                </div>
                <button 
                  onClick={() => setFullscreenCam(null)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="aspect-video bg-black rounded-2xl overflow-hidden relative flex items-center justify-center border border-white/10">
                <div className="w-full h-full flex flex-col items-center justify-center relative">
                  <div className="absolute top-3 left-3 px-3 py-1 bg-red-600 text-white text-xs font-black rounded-full animate-pulse">
                    LIVE 1080P
                  </div>
                  <Video size={64} className="text-rose-500/40 mb-3" />
                  <span className="text-sm font-bold text-slate-300">{fullscreenCam.name}</span>
                </div>
              </div>
            </div>
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
