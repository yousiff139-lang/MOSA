"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radar, Wifi, Search, CheckCircle2, Plus, RefreshCw, Cpu, 
  Layers, Radio, ArrowUpRight, ShieldCheck, Zap, Sparkles,
  Smartphone, Network, Check, AlertCircle, Server, Eye
} from 'lucide-react';
import { fetchAuth, useSmartHomeStore } from '@/store/useSmartHomeStore';

interface DiscoveredNode {
  id: string;
  name: string;
  ip?: string;
  mac: string;
  protocol: 'MQTT' | 'BLE' | 'ZIGBEE' | 'MDNS' | 'ONVIF' | 'TUYA';
  type: string;
  rssi?: number;
  status: 'PENDING' | 'ADDED' | 'ONLINE';
  firmware?: string;
  relaysCount?: number;
  channelsCount?: number;
}

export default function DiscoveryPage() {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<DiscoveredNode[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetDevice, setTargetDevice] = useState<DiscoveredNode | null>(null);
  const [customName, setCustomName] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const initBackendConnection = useSmartHomeStore(state => state.initBackendConnection);

  const fetchRooms = async () => {
    try {
      const res = await fetchAuth('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(Array.isArray(data) ? data : data.rooms || []);
        if (data.length > 0) setSelectedRoom(data[0].id);
      }
    } catch {}
  };

  const fetchDiscovered = async () => {
    try {
      const res = await fetchAuth('/api/discovery/devices');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDevices(data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchDiscovered();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      await fetchAuth('/api/discovery/scan', { method: 'POST' });
    } catch (err) {}

    const pollInterval = setInterval(() => {
      fetchDiscovered();
    }, 2500);

    setTimeout(() => {
      setScanning(false);
      clearInterval(pollInterval);
      fetchDiscovered();
    }, 12000);
  };

  const openAddModal = (device: DiscoveredNode) => {
    try {
      setTargetDevice(device);
      const rawMac = (device.mac || (device as any).macAddress || '').toString();
      const cleanMac = rawMac.replace(/[^a-fA-F0-9]/g, '');
      const macSuffix = cleanMac.length >= 4 ? cleanMac.slice(-4).toUpperCase() : 'ESP32';
      const fallbackName = `شريحة MOSA (${macSuffix})`;
      setCustomName(device.name || (device as any).deviceType || fallbackName);
      setShowAddModal(true);
    } catch (err) {
      console.error('Failed to open modal:', err);
      setTargetDevice(device);
      setCustomName('شريحة MOSA ESP32 الذكية');
      setShowAddModal(true);
    }
  };

  const handleConfirmAdd = async () => {
    if (!targetDevice) return;
    setAddingId(targetDevice.id);
    try {
      const res = await fetchAuth('/api/discovery/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discoveredId: targetDevice.id,
          mac: targetDevice.mac || (targetDevice as any).macAddress,
          ip: targetDevice.ip || (targetDevice as any).ipAddress,
          deviceType: targetDevice.type || (targetDevice as any).deviceType || 'ESP32',
          name: customName || targetDevice.name || 'شريحة MOSA ESP32',
          roomId: selectedRoom || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowAddModal(false);
        setToastMsg(`تمت إضافة ${customName || 'الجهاز'} بنجاح إلى المنزل! 🎉`);
        setTimeout(() => setToastMsg(''), 4500);
        await fetchDiscovered();
        await initBackendConnection();
      } else {
        alert(data.error || 'فشلت إضافة الجهاز إلى النظام');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء محاولة إضافة الجهاز');
    } finally {
      setAddingId(null);
    }
  };

  const filteredDevices = devices.filter(d => {
    if (protocolFilter === 'ALL') return true;
    const proto = d.protocol || (d.type?.includes('ZIGBEE') ? 'ZIGBEE' : 'MQTT');
    return proto === protocolFilter;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans" dir="rtl">
      
      {/* ── Top Futuristic Header Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-950/70 via-slate-900/90 to-blue-950/70 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold mb-3">
              <Radar size={16} className={scanning ? 'animate-spin text-cyan-400' : 'text-cyan-400'} />
              <span>رادار الاكتشاف التلقائي اللحظي (Auto-Discovery Hub)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              رادار اكتشاف وفحص أجهزة الشبكة
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              يقوم الرادار بفحص الشبكة المحلية عبر بروتوكولات <strong className="text-cyan-300">mDNS, MQTT Mesh, Zigbee 3.0, BLE 5.0, ONVIF</strong> لرصد لوحات ESP32 والحساسات تلقائياً وإضافتها بضغطة زر واحدة.
            </p>
          </div>

          {/* Action Trigger Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleScan}
              disabled={scanning}
              className={`px-6 py-4 rounded-2xl font-black text-sm transition-all duration-300 flex items-center gap-3 cursor-pointer shadow-xl ${
                scanning
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:scale-105'
              }`}
            >
              <Radar size={20} className={scanning ? 'animate-spin' : ''} />
              <span>{scanning ? 'جاري مسح ترددات الشبكة...' : 'بدء فحص الشبكة ورصد الأجهزة 📡'}</span>
            </button>
          </div>
        </div>

        {/* Live Protocol Badges Row */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-2.5 text-xs">
          <span className="text-slate-400 font-bold ml-1">البروتوكولات المدعومة:</span>
          {[
            { id: 'ALL', label: 'الكل (All)' },
            { id: 'MQTT', label: '⚡ ESP32 MQTT Mesh' },
            { id: 'ZIGBEE', label: '📡 Zigbee 3.0 Hub' },
            { id: 'MDNS', label: '🌐 mDNS ZeroConf' },
            { id: 'BLE', label: '📶 BLE 5.0 Beacon' },
            { id: 'ONVIF', label: '📹 ONVIF IP Cameras' },
            { id: 'TUYA', label: '☁️ Tuya / SmartLife' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setProtocolFilter(p.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                protocolFilter === p.id
                  ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50 shadow-sm'
                  : 'bg-black/30 hover:bg-white/5 text-slate-400 hover:text-slate-200 border border-white/5'
              }`}
            >
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Radar Display & Feed Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Holographic Sonar Radar Visualizer */}
        <div className="bg-slate-950/85 backdrop-blur-2xl border border-cyan-500/20 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden min-h-[420px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1)_0%,transparent_70%)] pointer-events-none" />

          {/* Sonar Rings */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full border-2 border-cyan-500/30 flex items-center justify-center">
            {/* Outer Grid lines */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-cyan-500/20" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-cyan-500/20" />
            <div className="w-48 h-48 rounded-full border border-cyan-500/25 flex items-center justify-center">
              <div className="w-28 h-28 rounded-full border border-cyan-500/20 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.8)]">
                  <Wifi size={18} className={scanning ? 'animate-ping' : ''} />
                </div>
              </div>
            </div>

            {/* Revolving Radar Sweeper Beam */}
            {scanning && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,rgba(6,182,212,0.4)_360deg)]"
              />
            )}

            {/* Discovered Device Blips on Radar */}
            {devices.slice(0, 5).map((dev, i) => {
              const angles = [45, 120, 210, 300, 160];
              const distances = [90, 70, 105, 80, 60];
              const angle = (angles[i] * Math.PI) / 180;
              const x = Math.cos(angle) * distances[i];
              const y = Math.sin(angle) * distances[i];

              return (
                <motion.div
                  key={dev.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                  className="absolute w-4 h-4 rounded-full bg-emerald-400 border border-white shadow-[0_0_12px_rgba(52,211,153,0.9)] flex items-center justify-center cursor-pointer"
                  title={`${dev.name} (${dev.protocol})`}
                >
                  <span className="w-full h-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                </motion.div>
              );
            })}
          </div>

          <div className="mt-6 space-y-1 relative z-10">
            <h4 className="text-base font-black text-white">
              {scanning ? 'جاري مسح المنافذ والترددات...' : 'الرادار في وضع الجاهزية'}
            </h4>
            <p className="text-xs text-slate-400">
              تم العثور على <strong className="text-cyan-300">{devices.length} أجهزة</strong> في الشبكة المحلية
            </p>
          </div>
        </div>

        {/* Right 2 Columns: Discovered Devices Live Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Cpu size={18} className="text-cyan-400" />
              <span>الأجهزة المكتشفة ({filteredDevices.length})</span>
            </h3>
            <button
              onClick={fetchDiscovered}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-bold"
            >
              <RefreshCw size={12} />
              <span>تحديث القائمة</span>
            </button>
          </div>

          {filteredDevices.length === 0 ? (
            <div className="bg-slate-950/60 border border-white/5 rounded-3xl p-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20">
                <Search size={24} />
              </div>
              <h4 className="font-bold text-white text-sm">لم يتم العثور على أجهزة جديدة حتى الآن</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                تأكد من تشغيل لوحة ESP32 أو جهاز Zigbee وتوصيله بمصدر الطاقة، ثم اضغط على زر "بدء فحص الشبكة".
              </p>
              <button
                onClick={handleScan}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition mt-2 cursor-pointer"
              >
                بدء الفحص الآن 📡
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDevices.map((dev) => {
                const displayName = dev.name || (dev as any).deviceType || (dev.mac ? `شريحة MOSA (${dev.mac.slice(-4)})` : 'شريحة MOSA ESP32');
                const displayMac = dev.mac || (dev as any).macAddress || '30:30:F9:6A:1F:5C';
                const displayIp = dev.ip || (dev as any).ipAddress || '192.168.1.100';
                const displayProto = dev.protocol || ((dev as any).deviceType?.includes('ZIGBEE') ? 'ZIGBEE' : 'MQTT');
                const displayRssi = dev.rssi !== undefined ? `${dev.rssi} dBm` : 'قوية 📶';

                return (
                  <div
                    key={dev.id}
                    className="p-5 bg-slate-950/80 hover:bg-slate-900/90 border border-white/10 hover:border-cyan-500/40 rounded-3xl transition-all shadow-lg space-y-3 relative group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-700 text-white flex items-center justify-center shadow-md shrink-0">
                          {displayProto === 'ZIGBEE' ? <Radio size={20} /> : <Cpu size={20} />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-white truncate">{displayName}</h4>
                          <span className="text-[11px] text-cyan-300 font-mono block truncate">{displayMac}</span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-lg border border-cyan-500/30 font-bold shrink-0">
                        {displayProto}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
                      <div>
                        <span>عنوان IP: </span>
                        <strong className="text-slate-200 font-mono">{displayIp}</strong>
                      </div>
                      <div>
                        <span>الإشارة (RSSI): </span>
                        <strong className="text-emerald-400 font-mono">{displayRssi}</strong>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openAddModal(dev);
                        }}
                        className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Plus size={14} />
                        <span>اعتماد وإضافة للمنزل</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Add & Room Assignment Modal ── */}
      <AnimatePresence>
        {showAddModal && targetDevice && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" 
            dir="rtl"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-cyan-500/30 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl text-right"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <Plus size={18} className="text-cyan-400" />
                  <span>إضافة الجهاز للمنظومة</span>
                </h3>
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)} 
                  className="text-slate-400 hover:text-white text-xs font-bold p-1 rounded-lg hover:bg-white/10 transition"
                >
                  ✕
                </button>
              </div>

              {/* Device Quick Info Badge */}
              <div className="p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">{targetDevice.name || 'شريحة MOSA الذكية'}</div>
                  <div className="text-[11px] font-mono text-cyan-300">{targetDevice.mac || (targetDevice as any).macAddress || ''}</div>
                </div>
                <div className="text-left">
                  <div className="text-[10px] text-slate-400">IP: {targetDevice.ip || (targetDevice as any).ipAddress || 'DHCP'}</div>
                  <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold mt-1">
                    {targetDevice.protocol || 'MQTT'}
                  </span>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">اسم الجهاز المخصص:</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="مثلاً: مفاتيح الصالة الذكية"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">تعيين في غرفة:</label>
                  {rooms.length > 0 ? (
                    <select
                      value={selectedRoom}
                      onChange={e => setSelectedRoom(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400 text-sm"
                    >
                      <option value="">-- بدون غرفة حالياً --</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-xs">
                      لا توجد غرف مضافة حالياً (يمكنك التعيين لاحقاً من قسم الغرف)
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdd}
                  disabled={addingId !== null}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  {addingId ? 'جاري الحفظ والربط...' : 'تأكيد الإضافة والتشغيل ✅'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm border border-emerald-400"
          >
            <CheckCircle2 size={20} className="text-white" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
