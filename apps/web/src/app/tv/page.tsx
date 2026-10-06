"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Tv, Power, Plus, Smartphone, Sparkles, LayoutGrid, Check, 
  Settings2, Wifi, Cast, MonitorPlay, Film, ArrowRight,
  Radar, RefreshCw, Trash2, Globe, Radio, ShieldCheck, X, Cpu
} from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { UniversalSmartTvRemote, SUPPORTED_TV_BRANDS } from '@/components/entertainment/UniversalSmartTvRemote';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

export default function SmartTvPage() {
  const devices = useSmartHomeStore(state => state.devices);
  const rooms = useSmartHomeStore(state => state.rooms);
  const initBackendConnection = useSmartHomeStore(state => state.initBackendConnection);

  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredTvs, setDiscoveredTvs] = useState<any[]>([]);
  const [selectedRoomForPair, setSelectedRoomForPair] = useState<string>('');
  const [pairingTvId, setPairingTvId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Quick IP Manual Add State
  const [manualIpTab, setManualIpTab] = useState<'scan' | 'manual'>('scan');
  const [manualName, setManualName] = useState('شاشة TCL الذكية');
  const [manualIp, setManualIp] = useState('192.168.1.');
  const [manualBrand, setManualBrand] = useState('tcl');
  const [manualRoomId, setManualRoomId] = useState('');
  const [isProbingIp, setIsProbingIp] = useState(false);
  const [probeResult, setProbeResult] = useState<any>(null);

  // Probe IP address on local network
  const handleProbeIp = async () => {
    if (!manualIp || manualIp.length < 7) {
      showToast('يرجى إدخال عنوان IP صالح أولاً');
      return;
    }
    setIsProbingIp(true);
    setProbeResult(null);
    try {
      const res = await fetchAuth('/api/entertainment/probe-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress: manualIp.trim() })
      });
      const data = await res.json();
      setProbeResult(data);
      if (data.isReachable && data.suggestedBrand) {
        setManualBrand(data.suggestedBrand);
        if (data.suggestedName) setManualName(data.suggestedName);
        showToast(`تم اكتشاف الشاشة بنجاح! نوع: ${data.suggestedBrand.toUpperCase()} 📺`);
      } else {
        showToast(data.message || 'تم فحص الـ IP (يمكنك المتابعة والإضافة)');
      }
    } catch (e) {
      showToast('تعذر فحص الـ IP');
    } finally {
      setIsProbingIp(false);
    }
  };

  const [selectedTvDevice, setSelectedTvDevice] = useState<any>({
    id: 'master-tv',
    name: 'الريموت الشامل (TCL & All Brands)',
    room: 'الصالة الرئيسية',
    brand: 'tcl'
  });

  // Filter TV devices
  const tvDevices = devices.filter(d => {
    const t = (d.type || '').toLowerCase();
    const n = (d.name || '').toLowerCase();
    return t === 'tv' || t === 'smart_tv' || t === 'media_player' || n.includes('تلفاز') || n.includes('شاشة') || n.includes('ريسيفر') || n.includes('تلفزيون') || n.includes('tcl');
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Perform Wi-Fi Auto-Discovery Scan (Real Devices Only)
  const startWifiDiscovery = async () => {
    setIsScanning(true);
    setDiscoveredTvs([]);
    try {
      const res = await fetchAuth('/api/entertainment/discover');
      const data = await res.json();
      if (data?.devices && Array.isArray(data.devices)) {
        setDiscoveredTvs(data.devices);
      }
    } catch (e) {
      console.warn('Auto discovery error:', e);
    } finally {
      setTimeout(() => setIsScanning(false), 1200);
    }
  };

  const openDiscoveryModal = () => {
    setIsDiscoveryOpen(true);
    if (rooms.length > 0 && !selectedRoomForPair) {
      setSelectedRoomForPair(String(rooms[0].id));
      setManualRoomId(String(rooms[0].id));
    }
    startWifiDiscovery();
  };

  // Pair a Discovered TV
  const handlePairTv = async (tv: any) => {
    setPairingTvId(tv.id);
    try {
      const res = await fetchAuth('/api/entertainment/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tv.name,
          brand: tv.brand,
          ipAddress: tv.ipAddress,
          protocol: tv.protocol || 'TCL',
          roomId: selectedRoomForPair || (rooms[0] ? rooms[0].id : null)
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`تم اقتران ${tv.name} بنجاح! 📺✨`);
        await initBackendConnection();
        setIsDiscoveryOpen(false);
        if (data.device) {
          setSelectedTvDevice({
            id: String(data.device.id),
            name: data.device.name,
            room: 'تمت الإضافة',
            brand: tv.brand || 'tcl'
          });
        }
      } else {
        showToast(data.error || 'فشل الاقتران');
      }
    } catch (err: any) {
      showToast('حدث خطأ أثناء الاتصال بالشاشة');
    } finally {
      setPairingTvId(null);
    }
  };

  // Pair Manual IP TV
  const handleManualPair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName || !manualIp) {
      showToast('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setPairingTvId('manual');
    try {
      const res = await fetchAuth('/api/entertainment/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualName,
          brand: manualBrand,
          ipAddress: manualIp,
          protocol: manualBrand.toUpperCase(),
          roomId: manualRoomId || (rooms[0] ? rooms[0].id : null)
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`تمت إضافة ${manualName} بنجاح! ⚡`);
        await initBackendConnection();
        setIsDiscoveryOpen(false);
        if (data.device) {
          setSelectedTvDevice({
            id: String(data.device.id),
            name: data.device.name,
            room: 'مخصص',
            brand: manualBrand
          });
        }
      } else {
        showToast(data.error || 'فشل إضافة الشاشة');
      }
    } catch (err) {
      showToast('خطأ أثناء حفظ الشاشة');
    } finally {
      setPairingTvId(null);
    }
  };

  // Delete TV
  const handleDeleteTv = async (deviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('هل تريد حذف هذه الشاشة من النظام؟')) return;

    try {
      await fetchAuth(`/api/entertainment/${deviceId}`, { method: 'DELETE' });
      showToast('تم حذف الشاشة بنجاح 🗑️');
      await initBackendConnection();
      if (selectedTvDevice?.id === deviceId) {
        setSelectedTvDevice({
          id: 'master-tv',
          name: 'الريموت الشامل (TCL & All Brands)',
          room: 'الصالة الرئيسية',
          brand: 'tcl'
        });
      }
    } catch (err) {
      showToast('فشل حذف الشاشة');
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="pt-6 sm:pt-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-32 font-sans"
      dir="rtl"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm border border-emerald-400 flex items-center gap-2"
        >
          <Sparkles size={18} />
          <span>{toastMessage}</span>
        </motion.div>
      )}

      {/* Header Banner */}
      <motion.header variants={itemVariants} className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-950/70 via-purple-950/60 to-slate-950/90 border border-white/10 p-5 sm:p-7 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-600/15 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/15 rounded-full blur-[90px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-purple-600 flex items-center justify-center shadow-[0_0_25px_rgba(225,6,0,0.4)] shrink-0">
              <Tv size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">التحكم بالشاشات الذكية (Smart TV)</h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-0.5">
                كشف والبحث التلقائي بالواي فاي مع دعم كامل لجميع الشركات (TCL, Samsung, LG, Sony, Apple TV, Roku, Universal IR)
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={openDiscoveryModal}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-red-600 via-rose-600 to-purple-600 hover:from-red-500 hover:to-purple-500 text-white font-black rounded-2xl transition-all shadow-[0_0_20px_rgba(225,6,0,0.4)] text-xs sm:text-sm hover:scale-105 cursor-pointer"
            >
              <Radar size={16} className="animate-spin text-rose-200" style={{ animationDuration: '4s' }} />
              <span>بحث وكشف الشاشات بالواي فاي (Auto-Discover)</span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left/Sidebar: TV Selection & Rooms list */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Discovered TV Fast Banner */}
          <div className="bg-gradient-to-br from-red-950/40 via-purple-950/30 to-black/60 border border-rose-500/20 rounded-3xl p-5 shadow-xl space-y-3 backdrop-blur-xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center">
                  <Wifi size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">الكشف السريع عبر الواي فاي</h4>
                  <p className="text-[10px] text-slate-400">اقتران بنقرة واحدة بدون تعقيد</p>
                </div>
              </div>
              <button
                onClick={openDiscoveryModal}
                className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-rose-500/40 cursor-pointer"
              >
                فحص الآن
              </button>
            </div>
          </div>

          <div className="bg-[#0b101d]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <MonitorPlay size={17} className="text-rose-400" />
                الشاشات المتوفرة في المنزل
              </h3>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full font-bold border border-rose-500/30">
                {tvDevices.length > 0 ? `${tvDevices.length} شاشات` : 'الشاشة الرئيسية'}
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Master Universal Default Option */}
              <button
                onClick={() => setSelectedTvDevice({
                  id: 'master-tv',
                  name: 'الريموت الشامل (TCL & All Brands)',
                  room: 'الصالة الرئيسية',
                  brand: 'tcl'
                })}
                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer text-right ${
                  selectedTvDevice?.id === 'master-tv'
                    ? 'bg-rose-600/25 border-rose-400 text-white shadow-lg shadow-rose-500/20'
                    : 'bg-black/30 border-white/5 text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Tv size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">الريموت الشامل (Master TV)</h4>
                    <p className="text-[10px] text-slate-400">تحكم بـ TCL وجميع أنواع الشاشات</p>
                  </div>
                </div>
                {selectedTvDevice?.id === 'master-tv' && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                )}
              </button>

              {/* User Registered TV Devices */}
              {tvDevices.map((d: any) => {
                const isSelected = selectedTvDevice?.id === String(d.id);
                const devBrand = (d.state as any)?.brand || (d.protocol?.toLowerCase() === 'tcl' ? 'tcl' : 'samsung');
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedTvDevice({
                      id: String(d.id),
                      name: d.name,
                      room: (d.room as any)?.name || d.room || 'الصالة',
                      brand: devBrand,
                      ipAddress: d.ipAddress
                    })}
                    className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer text-right group ${
                      isSelected
                        ? 'bg-rose-600/25 border-rose-400 text-white shadow-lg shadow-rose-500/20'
                        : 'bg-black/30 border-white/5 text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-rose-400 shrink-0">
                        <Tv size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white">{d.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {(d.room as any)?.name || d.room || 'مخصص'} • {d.ipAddress || `GPIO ${d.pin}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteTv(String(d.id), e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                        title="حذف الشاشة"
                      >
                        <Trash2 size={14} />
                      </button>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="bg-[#0b101d]/90 border border-white/10 rounded-3xl p-5 shadow-xl space-y-3">
            <h4 className="text-xs font-black text-white flex items-center gap-2">
              <Sparkles size={15} className="text-rose-400" />
              البروتوكولات المدعومة
            </h4>
            <ul className="text-[11px] text-slate-300 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">•</span>
                <span><strong>TCL Smart TV:</strong> دعم كامل لأجهزة TCL (Google TV, Android TV, Roku TV) عبر بروتوكول ADB و Wi-Fi المباشر.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span><strong>الشبكة المحلية (IP / Wi-Fi):</strong> تحكم مباشر لـ Samsung Tizen و LG webOS و Sony Bravia و Apple TV.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>مرسل الأشعة (IR Blaster):</strong> تحكم بالرسيفرات والشاشات العادية عبر ESP32.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right/Center: Full Active Universal Remote Control */}
        <div className="lg:col-span-8">
          <UniversalSmartTvRemote 
            key={selectedTvDevice?.id + '-' + (selectedTvDevice?.brand || 'tcl')}
            deviceId={selectedTvDevice?.id || 'master-tv'}
            deviceName={selectedTvDevice?.name || 'الشاشة الذكية'}
            roomName={selectedTvDevice?.room || 'الصالة الرئيسية'}
            initialBrand={selectedTvDevice?.brand || 'tcl'}
            ipAddress={selectedTvDevice?.ipAddress}
          />
        </div>

      </div>

      {/* Wi-Fi Auto-Discovery & Quick Pairing Modal */}
      <AnimatePresence>
        {isDiscoveryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0e1424] border border-rose-500/30 w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative max-h-[90vh] overflow-y-auto space-y-6"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
                    <Radar size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">كشف وإضافة الشاشات الذكية (Wi-Fi)</h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      البحث التلقائي عن شاشات TCL, Samsung, LG, Sony, Apple TV المتصلة بنفس شبكة الواي فاي
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsDiscoveryOpen(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Discovery Tabs: Wi-Fi Auto-Scan vs Manual IP */}
              <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-2xl border border-white/10">
                <button
                  onClick={() => setManualIpTab('scan')}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    manualIpTab === 'scan'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Radar size={16} />
                  <span>الكشف التلقائي بالواي فاي (Auto-Scan)</span>
                </button>
                <button
                  onClick={() => setManualIpTab('manual')}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    manualIpTab === 'manual'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe size={16} />
                  <span>إدخال عنوان IP يدوي (Manual IP)</span>
                </button>
              </div>

              {/* TAB 1: Auto-Discovery Scanner */}
              {manualIpTab === 'scan' && (
                <div className="space-y-5">
                  {/* Radar Scanning Status Box */}
                  <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center">
                        <div className={`w-10 h-10 rounded-full bg-rose-600/20 flex items-center justify-center text-rose-400 ${isScanning ? 'animate-pulse' : ''}`}>
                          <Wifi size={20} />
                        </div>
                        {isScanning && (
                          <div className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white">
                          {isScanning ? 'جاري فحص الشبكة المحلية...' : `تم العثور على (${discoveredTvs.length}) شاشات ذكية`}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {isScanning ? 'يتم كشف بروتوكولات Google Cast, Tizen, webOS, AirPlay, Roku' : 'اختر الشاشة واضغط اقتران فوري'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={startWifiDiscovery}
                      disabled={isScanning}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                      <span>إعادة الفحص</span>
                    </button>
                  </div>

                  {/* Room Selection Dropdown for Pairing */}
                  {rooms.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">اختر الغرفة لربط الشاشات المكتشفة بها:</span>
                      <select
                        value={selectedRoomForPair}
                        onChange={(e) => setSelectedRoomForPair(e.target.value)}
                        className="bg-black/60 border border-white/20 text-white text-xs rounded-xl px-3 py-1.5 outline-none font-bold"
                      >
                        {rooms.map(r => (
                          <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Discovered TVs List */}
                  <div className="space-y-3">
                    {discoveredTvs.map(tv => {
                      const isPairing = pairingTvId === tv.id;
                      const isTcl = tv.brand === 'tcl';
                      return (
                        <div
                          key={tv.id}
                          className="bg-black/50 border border-white/10 hover:border-rose-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xs shadow-md ${
                              isTcl ? 'bg-red-600 shadow-red-600/30' : 'bg-gradient-to-tr from-purple-600 to-indigo-600'
                            }`}>
                              {isTcl ? 'TCL' : <Tv size={20} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-white">{tv.name}</h4>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  isTcl ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-purple-500/20 text-purple-300'
                                }`}>
                                  {tv.brandName}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                                <span>IP: <strong className="text-cyan-400">{tv.ipAddress}</strong></span>
                                <span>•</span>
                                <span>{tv.model}</span>
                                <span>•</span>
                                <span className="text-emerald-400 font-bold">إشارة {tv.signalStrength}%</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handlePairTv(tv)}
                            disabled={isPairing}
                            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                              isTcl 
                                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-600/30 hover:scale-105'
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white hover:scale-105'
                            } disabled:opacity-50`}
                          >
                            {isPairing ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>جاري الاقتران...</span>
                              </>
                            ) : (
                              <>
                                <Check size={16} />
                                <span>اقتران وإضافة بضغطة واحدة</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}

                    {discoveredTvs.length === 0 && !isScanning && (
                      <div className="text-center py-8 bg-black/20 rounded-2xl border border-white/5 space-y-2">
                        <Tv size={32} className="mx-auto text-slate-500" />
                        <p className="text-xs text-slate-400">لم يتم العثور على شاشات جديدة غير مقترنة على الشبكة.</p>
                        <p className="text-[11px] text-slate-500">تأكد من تشغيل الشاشة واتصالها بنفس شبكة الواي فاي للراوتر.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Manual IP Entry */}
              {manualIpTab === 'manual' && (
                <form onSubmit={handleManualPair} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">اسم الشاشة:</label>
                    <input 
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="مثال: شاشة TCL الصالة"
                      className="w-full bg-black/50 border border-white/15 rounded-2xl p-3 text-white text-xs outline-none focus:border-rose-400"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">الشركة المصنعة ونظام التشغيل:</label>
                      <select
                        value={manualBrand}
                        onChange={(e) => setManualBrand(e.target.value)}
                        className="w-full bg-black/50 border border-white/15 rounded-2xl p-3 text-white text-xs outline-none focus:border-rose-400 font-bold"
                      >
                        <option value="tcl" className="bg-slate-900">🔴 تي سي إل (TCL Google TV / Android)</option>
                        <option value="samsung" className="bg-slate-900">📺 سامسونج (Samsung Tizen OS)</option>
                        <option value="lg" className="bg-slate-900">🔴 إل جي (LG webOS)</option>
                        <option value="sony" className="bg-slate-900">⚡ سوني (Sony Bravia Android)</option>
                        <option value="appletv" className="bg-slate-900">🍏 أبل تي في (Apple TV 4K)</option>
                        <option value="roku" className="bg-slate-900">🟣 روكو / هايسنس (Roku TV)</option>
                        <option value="universal_ir" className="bg-slate-900">📡 ريموت الأشعة IR Blaster</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-300">عنوان الـ IP المحلي للشاشة:</label>
                        <button
                          type="button"
                          onClick={handleProbeIp}
                          disabled={isProbingIp}
                          className="text-[11px] font-black text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Radar size={12} className={isProbingIp ? 'animate-spin' : ''} />
                          <span>{isProbingIp ? 'جاري الفحص...' : 'فحص الاتصال بالشاشة (Ping)'}</span>
                        </button>
                      </div>
                      <input 
                        type="text"
                        value={manualIp}
                        onChange={(e) => setManualIp(e.target.value)}
                        placeholder="192.168.1.155"
                        className="w-full bg-black/50 border border-white/15 rounded-2xl p-3 text-white text-xs outline-none focus:border-rose-400 font-mono"
                        required
                      />
                      {probeResult && (
                        <div className={`mt-2 p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-between ${
                          probeResult.isReachable 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        }`}>
                          <span>{probeResult.isReachable ? `✅ الشاشة متصلة وجاهزة (${probeResult.suggestedBrand?.toUpperCase()})` : '⚠️ لم تستجب المنافذ التلقائية، لكن يمكنك حفظ الـ IP'}</span>
                          {probeResult.detectedPorts && (
                            <span className="font-mono text-[10px] text-slate-400">منفذ: {probeResult.detectedPorts.join(', ')}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {rooms.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">الغرفة:</label>
                      <select
                        value={manualRoomId}
                        onChange={(e) => setManualRoomId(e.target.value)}
                        className="w-full bg-black/50 border border-white/15 rounded-2xl p-3 text-white text-xs outline-none focus:border-rose-400"
                      >
                        {rooms.map(r => (
                          <option key={r.id} value={r.id} className="bg-slate-900">
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={pairingTvId === 'manual'}
                      className="w-full py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-purple-600 text-white font-black rounded-2xl text-xs transition-all shadow-lg hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                    >
                      {pairingTvId === 'manual' ? 'جاري الحفظ والاقتران...' : 'حفظ واقتران الشاشة فوراً'}
                    </button>
                  </div>
                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
