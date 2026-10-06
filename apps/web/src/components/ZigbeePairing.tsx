"use client";

import { useState, useEffect } from 'react';
import { Radio, Scan, RefreshCw, XCircle, ChevronLeft, HelpCircle } from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedButton } from '@/components/ui/AnimatedButton';
import { motion, AnimatePresence } from 'framer-motion';

export function ZigbeePairing() {
  const [isPairing, setIsPairing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [devices, setDevices] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);

  // Modal State
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [setupName, setSetupName] = useState('');
  const [setupRoomId, setSetupRoomId] = useState('');
  const [setupType, setSetupType] = useState('light');
  const [loading, setLoading] = useState(false);

  const fetchDevices = async () => {
    try {
      const res = await fetchAuth('/api/controllers');
      if (res.ok) {
        const data = await res.json();
        // Discovered pending devices or ZIGBEE devices
        setDevices(data.filter((d: any) => d.protocol === 'ZIGBEE' || d.status === 'pending'));
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
        setRooms(data);
        if (data.length > 0) setSetupRoomId(data[0].id);
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

  const togglePairing = async (enable: boolean) => {
    setIsPairing(enable);
    setStatusMsg(enable ? 'جاري فتح شبكة Zigbee (الاقتران متاح لمدة 120 ثانية)...' : 'تم إغلاق شبكة Zigbee');
    
    try {
      await fetchAuth(`/api/zigbee/permit_join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permit: enable })
      });
      
      if (enable) {
        setTimeout(() => {
          setIsPairing(false);
          setStatusMsg('انتهى وقت الاقتران. الشبكة مغلقة الآن.');
        }, 120000);
      }
    } catch (e) {
      setStatusMsg('خطأ في الاتصال بالخادم');
      setIsPairing(false);
    }
  };

  const handleOpenSetup = (device: any) => {
    setSelectedDevice(device);
    setSetupName(device.name);
    setSetupType('light');
    if (rooms.length > 0) setSetupRoomId(rooms[0].id);
    setShowSetupModal(true);
  };

  const handleSaveSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    setLoading(true);

    try {
      const res = await fetchAuth(`/api/controllers/${selectedDevice.id}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: setupName,
          roomId: setupRoomId,
          type: setupType
        })
      });

      if (res.ok) {
        setShowSetupModal(false);
        setSelectedDevice(null);
        fetchDevices();
        alert('تم إعداد وتفعيل جهاز الـ Zigbee بنجاح!');
      } else {
        alert('فشل حفظ إعدادات الجهاز');
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 animate-fade-up text-white" dir="rtl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
          <Radio size={30} className="text-amber-500 animate-pulse" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">Zigbee Hub</h1>
          <p className="text-sm text-slate-400">اربط الحساسات والمفاتيح اللاسلكية الاقتصادية (Xiaomi, Tuya) بسهولة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left: Pairing Control Card */}
        <div className="col-span-12 md:col-span-5">
          <GlassCard className="p-8 text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[350px] border-white/10 rounded-[2.5rem] bg-black/30 shadow-2xl">
            {isPairing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-4 border-amber-500/20 rounded-full animate-ping"></div>
                <div className="w-64 h-64 border-2 border-amber-500/10 rounded-full animate-ping delay-150 absolute"></div>
              </div>
            )}

            <Radio size={56} className={`mb-6 relative z-10 ${isPairing ? 'text-amber-500 animate-pulse' : 'text-slate-600'}`} />
            
            <h2 className="text-2xl font-bold mb-2 relative z-10">إضافة أجهزة Zigbee</h2>
            <p className="text-xs text-slate-400 mb-8 max-w-xs relative z-10">{statusMsg || 'شبكة الاقتران مغلقة حالياً للحفاظ على أمان المنظومة.'}</p>

            {!isPairing ? (
              <button 
                onClick={() => togglePairing(true)}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] relative z-10"
              >
                <Scan size={18} /> تفعيل الاقتران (120 ثانية)
              </button>
            ) : (
              <button 
                onClick={() => togglePairing(false)}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-all border border-red-500/30 relative z-10"
              >
                <XCircle size={18} /> إيقاف البحث والاقتران
              </button>
            )}
          </GlassCard>
        </div>

        {/* Right: Discovered Devices List */}
        <div className="col-span-12 md:col-span-7">
          <GlassCard className="p-8 border-white/10 rounded-[2.5rem] bg-black/30 shadow-2xl min-h-[350px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">الأجهزة المكتشفة حديثاً</h2>
              <button onClick={fetchDevices} className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-white/5 text-slate-400 hover:text-white">
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="space-y-4 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
              {devices.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-12">لم يتم اكتشاف أي أجهزة Zigbee معلقة حالياً.</p>
              ) : (
                devices.map(device => (
                  <div key={device.id} className="p-4 bg-white/5 border border-white/5 hover:border-amber-500/30 rounded-2xl flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                        <Radio size={20} className="text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white">{device.name}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">{device.macAddress || device.mac} • {device.firmware}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleOpenSetup(device)}
                      className="bg-white/5 text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors"
                    >
                      تهيئة وتفعيل
                    </button>
                  </div>
                ))
              )}
            </div>
              
            <p className="text-center text-[11px] text-slate-500 mt-8 flex items-center justify-center gap-1.5">
              <HelpCircle size={14} /> اضغط على زر إعادة الضبط (Reset) في الحساس اللاسلكي لبدء الاقتران.
            </p>
          </GlassCard>
        </div>
      </div>

      {/* Setup Modal */}
      <AnimatePresence>
        {showSetupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-md w-full bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative"
            >
              <h3 className="text-xl font-bold text-white mb-2">إعداد وتفعيل جهاز الـ Zigbee</h3>
              <p className="text-xs text-slate-400 mb-6">قم بتعيين اسم ونوع وغرفة للجهاز لتفعيله في المنزل.</p>

              <form onSubmit={handleSaveSetup} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">اسم الجهاز</label>
                  <input
                    type="text"
                    required
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">نوع الحساس/الجهاز</label>
                  <select
                    value={setupType}
                    onChange={(e) => setSetupType(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none"
                  >
                    <option value="light">إضاءة (Light)</option>
                    <option value="sensor_motion">حساس حركة (Motion Sensor)</option>
                    <option value="sensor_temp">حساس حرارة ورطوبة (Temp/Hum Sensor)</option>
                    <option value="socket">مأخذ طاقة ذكي (Smart Socket)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">الغرفة</label>
                  <select
                    value={setupRoomId}
                    onChange={(e) => setSetupRoomId(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none"
                  >
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-white/5 mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSetupModal(false)}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-2xl text-xs font-bold transition-colors"
                  >
                    إلغاء
                  </button>
                  <AnimatedButton
                    type="submit"
                    disabled={loading}
                    variant="primary"
                    className="px-6 py-2.5 bg-primary text-white font-bold rounded-2xl text-xs shadow-lg shadow-primary/20"
                  >
                    {loading ? 'جاري التفعيل...' : 'تفعيل وحفظ الجهاز'}
                  </AnimatedButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
