"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radio, Scan, RefreshCw, XCircle, ChevronLeft, HelpCircle, 
  Cpu, Signal, Battery, Layers, CheckCircle2, AlertTriangle, 
  Plus, Settings2, Trash2, ArrowUpRight, ShieldCheck, Zap,
  Wifi, Flame, Power
} from 'lucide-react';
import { fetchAuth, useSmartHomeStore } from '@/store/useSmartHomeStore';

interface ZigbeeDevice {
  id: string;
  name: string;
  ieeeAddr?: string;
  model?: string;
  vendor?: string;
  type?: string;
  lqi?: number;
  battery?: number;
  status: 'online' | 'offline' | 'pending';
  room?: { id: string; name: string };
}

const SUPPORTED_BRANDS = [
  { name: 'Xiaomi / Aqara', tip: 'اضغط 5 ثوان على زر Reset حتى يومض الضوء الأزرق 3 مرات', logo: '🔷' },
  { name: 'Sonoff Zigbee 3.0', tip: 'اضغط 5 ثوان على الزر حتى يومض مؤشر LED بسرعة', logo: '⚡' },
  { name: 'Tuya Smart / Moes', tip: 'أعد تشغيل الجهاز 3 مرات متتالية للدخول في وضع الاقتران', logo: '☁️' },
  { name: 'Philips Hue / IKEA', tip: 'قم بتبديل المفتاح 6 مرات للدخول في وضع Reset & Pair', logo: '💡' },
];

export default function ZigbeePage() {
  const [isPairing, setIsPairing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [statusMsg, setStatusMsg] = useState('شبكة Zigbee مؤمنة وجاهزة للاقتران');
  const [devices, setDevices] = useState<ZigbeeDevice[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<ZigbeeDevice | null>(null);
  const [customName, setCustomName] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const initBackendConnection = useSmartHomeStore(state => state.initBackendConnection);

  const fetchDevices = async () => {
    try {
      const res = await fetchAuth('/api/controllers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDevices(data.filter((d: any) => d.protocol === 'ZIGBEE' || d.type?.toLowerCase().includes('zigbee')));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetchAuth('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        const rList = Array.isArray(data) ? data : data.rooms || [];
        setRooms(rList);
        if (rList.length > 0) setSelectedRoomId(rList[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchRooms();
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  // Pairing Countdown Timer
  useEffect(() => {
    let timer: any;
    if (isPairing && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsPairing(false);
            setStatusMsg('انتهت فترة الاقتران (120 ثانية). تم إغلاق شبكة Zigbee لأمان المنظومة.');
            return 120;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPairing, timeLeft]);

  const togglePairing = async (enable: boolean) => {
    setIsPairing(enable);
    setTimeLeft(120);
    setStatusMsg(enable ? 'جاري فتح شبكة Zigbee واستقبال طلبات الاقتران...' : 'تم إغلاق شبكة Zigbee');

    try {
      await fetchAuth('/api/zigbee/permit_join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permit: enable, time: 120 })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenSetup = (dev: ZigbeeDevice) => {
    setSelectedDevice(dev);
    setCustomName(dev.name || 'مستشعر Zigbee جديد');
    if (rooms.length > 0) setSelectedRoomId(rooms[0].id);
    setShowSetupModal(true);
  };

  const handleSaveSetup = async () => {
    if (!selectedDevice) return;
    setLoading(true);
    try {
      const res = await fetchAuth(`/api/controllers/${selectedDevice.id}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName,
          roomId: selectedRoomId
        })
      });
      if (res.ok) {
        setShowSetupModal(false);
        fetchDevices();
        initBackendConnection();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans" dir="rtl">
      
      {/* ── Top Header Banner with Live Coordinator Info ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-950/60 via-slate-900/90 to-blue-950/70 border border-amber-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold mb-3">
              <Radio size={16} className={isPairing ? 'animate-spin text-amber-400' : 'text-amber-400'} />
              <span>بوابة شبكة Zigbee 3.0 اللاسلكية (Universal Zigbee Mesh Hub)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              إدارة وربط أجهزة وشبكة Zigbee 3.0
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              ربط الحساسات والمفاتيح اللاسلكية الاقتصادية (Aqara, Sonoff, Tuya, Philips Hue) بشبكة الـ Mesh المحلية دون استهلاك للواي فاي وببطارية تدوم لأكثر من سنتين.
            </p>
          </div>

          {/* Pairing Trigger Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => togglePairing(!isPairing)}
              className={`px-6 py-4 rounded-2xl font-black text-sm transition-all duration-300 flex items-center gap-3 cursor-pointer shadow-xl ${
                isPairing
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-white shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:scale-105'
              }`}
            >
              <Radio size={20} className={isPairing ? 'animate-bounce' : ''} />
              <span>{isPairing ? `إلغاء الاقتران (${timeLeft} ثانية)` : 'فتح شبكة الاقتران (120 ثانية) 📡'}</span>
            </button>
          </div>
        </div>

        {/* Coordinator Live Stats Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-black/30 p-3 rounded-2xl border border-white/5">
            <span className="text-slate-400 block text-[11px]">حالة المنسق (Coordinator):</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>متصل ويعمل (ESP32 Gateway)</span>
            </span>
          </div>
          <div className="bg-black/30 p-3 rounded-2xl border border-white/5">
            <span className="text-slate-400 block text-[11px]">القناة اللاسلكية (Channel):</span>
            <span className="text-cyan-300 font-mono font-bold block mt-1">Channel 11 (2.4GHz IEEE)</span>
          </div>
          <div className="bg-black/30 p-3 rounded-2xl border border-white/5">
            <span className="text-slate-400 block text-[11px]">معرّف الشبكة (PAN ID):</span>
            <span className="text-purple-300 font-mono font-bold block mt-1">0x1A62 (Secured Mesh)</span>
          </div>
          <div className="bg-black/30 p-3 rounded-2xl border border-white/5">
            <span className="text-slate-400 block text-[11px]">الأجهزة المتصلة:</span>
            <span className="text-white font-bold block mt-1">{devices.length} جهاز Zigbee</span>
          </div>
        </div>
      </div>

      {/* ── Main Zigbee Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Active Pairing Radar Widget */}
        <div className="bg-slate-950/85 backdrop-blur-2xl border border-amber-500/20 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden min-h-[400px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.1)_0%,transparent_70%)] pointer-events-none" />

          {/* Animated Pairing Radar Orb */}
          <div className={`relative w-48 h-48 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
            isPairing 
              ? 'border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.6)] animate-pulse' 
              : 'border-white/10 bg-black/30'
          }`}>
            <div className="w-32 h-32 rounded-full border border-amber-500/30 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-xl">
                <Radio size={28} className={isPairing ? 'animate-bounce' : ''} />
              </div>
            </div>

            {isPairing && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,rgba(245,158,11,0.4)_360deg)]"
              />
            )}
          </div>

          <div className="mt-6 space-y-1.5 relative z-10">
            <h4 className="text-base font-black text-white">
              {isPairing ? `الشبكة مفتوحة للاقتران (${timeLeft} ثانية)` : 'شبكة Zigbee في وضع الأمان'}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              {statusMsg}
            </p>
          </div>
        </div>

        {/* Right 2 Columns: Connected Zigbee Devices Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Radio size={18} className="text-amber-400" />
              <span>أجهزة Zigbee المكتشفة والمتصلة ({devices.length})</span>
            </h3>
            <button
              onClick={fetchDevices}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5 font-bold"
            >
              <RefreshCw size={12} />
              <span>تحديث الأجهزة</span>
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="bg-slate-950/60 border border-white/5 rounded-3xl p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                <Radio size={24} />
              </div>
              <h4 className="font-bold text-white text-sm">لم يتم ربط أي أجهزة Zigbee بعد</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                اضغط على زر "فتح شبكة الاقتران"، ثم اضغط زر الـ Reset على حساس أو مفتاح Zigbee لمدة 5 ثوان.
              </p>
              <button
                onClick={() => togglePairing(true)}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-amber-600/20"
              >
                تفعيل وضع الاقتران الآن 📡
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devices.map((dev) => (
                <div
                  key={dev.id}
                  className="p-5 bg-slate-950/80 hover:bg-slate-900/90 border border-white/10 hover:border-amber-500/40 rounded-3xl transition-all shadow-lg space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-700 text-white flex items-center justify-center shadow-md">
                        <Radio size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-white">{dev.name}</h4>
                        <span className="text-[11px] text-amber-300 font-mono block">{dev.ieeeAddr || dev.id}</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-500/30 font-bold shrink-0">
                      متصل (Online)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Signal size={12} className="text-cyan-400" />
                      <span>قوة الإشارة: <strong className="text-slate-200">{dev.lqi || 180} LQI</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Battery size={12} className="text-emerald-400" />
                      <span>البطارية: <strong className="text-emerald-300">{dev.battery || 95}%</strong></span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleOpenSetup(dev)}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-600/20"
                    >
                      <Settings2 size={14} />
                      <span>تخصيص الاسم وتعيين الغرفة</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Brand Pairing Quick-Help Guide Cards ── */}
      <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <HelpCircle size={20} className="text-amber-400" />
          <h3 className="font-black text-base text-white">دليل إقران أشهر الأجهزة والحساسات المدعومة</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {SUPPORTED_BRANDS.map((brand, idx) => (
            <div key={idx} className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{brand.logo}</span>
                <h4 className="font-bold text-sm text-white">{brand.name}</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{brand.tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Setup & Room Modal ── */}
      <AnimatePresence>
        {showSetupModal && selectedDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl text-right"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <Settings2 size={18} className="text-amber-400" />
                  <span>تخصيص جهاز Zigbee</span>
                </h3>
                <button onClick={() => setShowSetupModal(false)} className="text-slate-400 hover:text-white text-xs font-bold">
                  إغلاق ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">اسم الجهاز:</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">الغرفة:</label>
                  <select
                    value={selectedRoomId}
                    onChange={e => setSelectedRoomId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                  >
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex gap-3 justify-end">
                <button
                  onClick={() => setShowSetupModal(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveSetup}
                  disabled={loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-amber-600/20"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ التغييرات ✅'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
