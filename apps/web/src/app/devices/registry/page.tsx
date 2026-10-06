"use client";

import { useState, useEffect } from 'react';
import { Layers, Plus, Wifi, Trash2, AlertTriangle, Check, RefreshCw, Box, Monitor, Router, Cpu, Edit3, Lightbulb, Thermometer, Zap, Droplets, ShieldCheck, Flame } from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { confirmAction, notify } from '@/store/useConfirmStore';

interface DiscoveredDevice {
  id: string;
  macAddress: string;
  ipAddress: string;
  deviceType: string;
  components: any[];
}

interface ControllerNode {
  id: string;
  name: string;
  macAddress?: string;
  ipAddress?: string;
  status: string;
  deviceCount?: number;
}

export default function DeviceRegistryPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [controllers, setControllers] = useState<ControllerNode[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'REGISTERED' | 'DISCOVERED'>('REGISTERED');
  
  // Room mapping for pairing
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string>>({});
  const [customNames, setCustomNames] = useState<Record<string, string>>({});

  // Fetch registered devices
  const fetchDevices = async () => {
    try {
      const res = await fetchAuth('/api/devices');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setDevices(list);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Fetch real ESP32 controllers
  const fetchControllers = async () => {
    try {
      const res = await fetchAuth('/api/controllers');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setControllers(list);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch rooms
  const fetchRooms = async () => {
    try {
      const res = await fetchAuth('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setRooms(list);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch discovered devices
  const fetchDiscovered = async () => {
    try {
      const res = await fetchAuth('/api/discovery/devices');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setDiscoveredDevices(list);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchControllers();
    fetchRooms();
    fetchDiscovered();
  }, []);

  // Update device's associated ESP Controller
  const handleControllerChange = async (deviceId: string, newControllerId: string) => {
    if (!newControllerId) return;
    try {
      const res = await fetchAuth(`/api/devices/${deviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ controllerId: newControllerId })
      });

      if (res.ok) {
        fetchDevices();
      } else {
        const err = await res.json();
        alert(err.message || 'فشل تحديث المتحكم المرتبط');
      }
    } catch (e) {
      console.error(e);
      alert('حدث خطأ في الاتصال بالسيرفر');
    }
  };

  const startScan = async () => {
    setIsScanning(true);
    setActiveTab('DISCOVERED');
    try {
      await fetchAuth('/api/discovery/scan', { method: 'POST' });
      let count = 0;
      const interval = setInterval(async () => {
        await fetchDiscovered();
        count++;
        if (count >= 5) {
          clearInterval(interval);
          setIsScanning(false);
        }
      }, 2000);
    } catch (e) {
      console.error(e);
      setIsScanning(false);
    }
  };

  const handlePair = async (discoveredId: string) => {
    const roomId = selectedRooms[discoveredId] || '';
    const name = customNames[discoveredId] || '';
    
    try {
      const res = await fetchAuth('/api/discovery/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discoveredId, roomId, name })
      });

      if (res.ok) {
        notify('تم ربط الجهاز وتهيئة أطراف الـ ESP32 بنجاح! ⚡', 'success');
        fetchDevices();
        fetchDiscovered();
      } else {
        const data = await res.json();
        notify(data.error || 'فشل ربط الجهاز', 'error');
      }
    } catch (e) {
      notify('حدث خطأ أثناء الاتصال بالخادم', 'error');
    }
  };

  const handleDelete = (id: string) => {
    confirmAction({
      title: 'حذف الجهاز ⚠️',
      message: 'هل أنت متأكد من حذف هذا الجهاز؟',
      variant: 'danger',
      confirmText: 'نعم، حذف الجهاز',
      cancelText: 'تراجع',
      onConfirm: async () => {
        try {
          const res = await fetchAuth(`/api/devices/${id}`, { method: 'DELETE' });
          if (res.ok) {
            fetchDevices();
            notify('تم حذف الجهاز بنجاح', 'success');
          } else {
            notify('حدث خطأ أثناء الحذف', 'error');
          }
        } catch (e) {
          console.error(e);
          notify('حدث خطأ في الشبكة', 'error');
        }
      }
    });
  };

  const handleDeleteAll = () => {
    confirmAction({
      title: 'تنبيه هام جداً 🚨',
      message: 'هل أنت متأكد من مسح جميع الأجهزة بالكامل؟',
      subMessage: 'لا يمكن التراجع عن هذا الإجراء وسيتم حذف إعدادات كافة الأجهزة المرتبطة.',
      variant: 'danger',
      confirmText: 'نعم، مسح كافة الأجهزة',
      cancelText: 'تراجع',
      onConfirm: async () => {
        try {
          for (const d of devices) {
            await fetchAuth(`/api/devices/${d.id}`, { method: 'DELETE' });
          }
          fetchDevices();
          notify('تم مسح جميع الأجهزة بنجاح', 'success');
        } catch (e) {
          notify('حدث خطأ أثناء مسح الأجهزة', 'error');
        }
      }
    });
  };

  const handleClearDiscovered = () => {
    confirmAction({
      title: 'مسح الأجهزة المكتشفة 🔍',
      message: 'هل أنت متأكد من مسح جميع الأجهزة المكتشفة بالشبكة؟',
      variant: 'warning',
      confirmText: 'نعم، مسح القائمة',
      cancelText: 'إلغاء',
      onConfirm: async () => {
        try {
          const res = await fetchAuth('/api/discovery/clear', { method: 'POST' });
          if (res.ok) {
            fetchDiscovered();
            notify('تم مسح الأجهزة المكتشفة بنجاح', 'success');
          } else {
            notify('حدث خطأ أثناء مسح الأجهزة المكتشفة', 'error');
          }
        } catch (e) {
          notify('حدث خطأ أثناء مسح الأجهزة المكتشفة', 'error');
        }
      }
    });
  };

  // Icon helper based on type
  const renderDeviceIcon = (type: string) => {
    const t = String(type || '').toUpperCase();
    if (t.includes('LIGHT') || t.includes('RGB')) return <Lightbulb size={16} className="text-amber-400" />;
    if (t.includes('TEMP') || t.includes('CLIMATE')) return <Thermometer size={16} className="text-cyan-400" />;
    if (t.includes('ENERGY') || t.includes('SOCKET')) return <Zap size={16} className="text-yellow-400" />;
    if (t.includes('MOISTURE') || t.includes('SOIL')) return <Droplets size={16} className="text-blue-400" />;
    return <Cpu size={16} className="text-purple-400" />;
  };

  // Type badge style
  const renderTypeBadge = (type: string) => {
    const t = String(type || '').toUpperCase();
    let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';
    if (t.includes('LIGHT') || t.includes('RGB')) colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    else if (t.includes('TEMP') || t.includes('CLIMATE')) colorClasses = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    else if (t.includes('ENERGY') || t.includes('SOCKET')) colorClasses = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    else if (t.includes('MOISTURE') || t.includes('SOIL')) colorClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    else if (t.includes('PUMP') || t.includes('LOCK')) colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

    return (
      <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${colorClasses}`}>
        {t}
      </span>
    );
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 pb-32 text-right" dir="rtl">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <span>سجل وإعداد الأجهزة والمتحكمات</span>
            <span className="text-xs font-mono text-cyan-300 bg-cyan-500/20 border border-cyan-500/40 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              ESP32 Binding Registry
            </span>
          </h1>
          <p className="text-gray-400 text-sm">عرض جميع الأجهزة المسجلة وتخصيص متحكم ESP32 المرتبط بكل جهاز مباشرة مع حالة الشبكة</p>
        </div>

        <div className="flex items-center gap-3 relative z-10 w-full sm:w-auto">
          <button 
            onClick={activeTab === 'REGISTERED' ? handleDeleteAll : handleClearDiscovered}
            disabled={activeTab === 'REGISTERED' ? devices.length === 0 : discoveredDevices.length === 0}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-xs shadow-lg cursor-pointer"
          >
            <AlertTriangle size={18} />
            مسح الكل
          </button>
          
          <button 
            onClick={startScan}
            disabled={isScanning}
            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_25px_rgba(37,99,235,0.4)] hover:scale-105 disabled:opacity-50 text-xs cursor-pointer"
          >
            <Wifi className={isScanning ? 'animate-pulse' : ''} size={18} />
            {isScanning ? 'جاري الفحص بالرادار...' : 'فحص الرادار (Scan)'}
          </button>
        </div>
      </div>

      {/* Glassmorphic Tab Navigation */}
      <div className="flex items-center gap-3 bg-black/40 p-2 rounded-2xl border border-white/10 w-fit backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('REGISTERED')}
          className={`px-6 py-3 font-bold text-xs rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
            activeTab === 'REGISTERED' 
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>الأجهزة المربوطة حالياً</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
            activeTab === 'REGISTERED' ? 'bg-black/30 text-white' : 'bg-white/10 text-gray-400'
          }`}>
            {devices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('DISCOVERED')}
          className={`px-6 py-3 font-bold text-xs rounded-xl transition-all flex items-center gap-2.5 cursor-pointer relative ${
            activeTab === 'DISCOVERED' 
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>الأجهزة المكتشفة بالشبكة</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
            activeTab === 'DISCOVERED' ? 'bg-black/30 text-white' : 'bg-white/10 text-gray-400'
          }`}>
            {discoveredDevices.length}
          </span>
          {discoveredDevices.length > 0 && (
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping absolute -top-1 -right-1" />
          )}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'REGISTERED' ? (
        <div className="bg-slate-950/80 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
          <table className="w-full text-right text-sm text-gray-300">
            <thead className="bg-slate-900/90 text-xs text-slate-400 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 font-bold">معرف الجهاز (ID)</th>
                <th className="px-6 py-4 font-bold">اسم الجهاز</th>
                <th className="px-6 py-4 font-bold">النوع</th>
                <th className="px-6 py-4 font-bold">رقم المخرج (PIN)</th>
                <th className="px-6 py-4 font-bold">المتحكم المرتبط (ESP32 Controller)</th>
                <th className="px-6 py-4 text-center font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-bold animate-pulse">جاري تحميل سجل الأجهزة ومتحكمات ESP32...</td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500 font-bold">
                    لا توجد أجهزة مسجلة حالياً. استخدم فحص الرادار للبحث والتوصيل.
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const activeControllerId = device.controllerId || device.boardId || device.controller?.id || '';
                  const currentControllerObj = controllers.find(c => c.id === activeControllerId || c.name === device.controller?.name);

                  return (
                    <tr key={device.id} className="hover:bg-white/[0.04] transition-colors">
                      
                      {/* ID */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-slate-400 bg-black/60 px-3 py-1.5 rounded-xl border border-white/10">
                          {device.id.slice(0, 8)}...
                        </span>
                      </td>

                      {/* Name */}
                      <td className="px-6 py-4 font-bold text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          {renderDeviceIcon(device.type)}
                        </div>
                        <span className="text-sm">{device.name}</span>
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4">
                        {renderTypeBadge(device.type)}
                      </td>

                      {/* GPIO Pin */}
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/60 px-3 py-1.5 rounded-xl border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                          GPIO {device.pinNumber || device.pin || 0}
                        </span>
                      </td>

                      {/* Associated ESP32 Controller Selector */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <select
                            value={activeControllerId}
                            onChange={(e) => handleControllerChange(device.id, e.target.value)}
                            className="bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 font-bold rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all cursor-pointer shadow-md"
                          >
                            <option value="" disabled>اختر متحكم ESP32...</option>
                            {controllers.map(ctrl => (
                              <option key={ctrl.id} value={ctrl.id}>
                                {ctrl.name} ({ctrl.status === 'online' ? 'ONLINE 🟢' : 'OFFLINE 🔴'})
                              </option>
                            ))}
                          </select>

                          {/* Controller Online Status Badge */}
                          {currentControllerObj && (
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                              currentControllerObj.status === 'online'
                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                                : 'text-red-400 bg-red-500/10 border-red-500/30'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${currentControllerObj.status === 'online' ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`} />
                              {currentControllerObj.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => handleDelete(device.id)}
                          className="text-red-400 hover:text-red-300 p-2.5 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all cursor-pointer border border-red-500/20"
                          title="مسح الجهاز"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Scanning Alert Indicator */}
          {isScanning && (
            <div className="p-5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center gap-3 text-cyan-300 text-xs font-bold animate-pulse backdrop-blur-xl shadow-lg">
              <RefreshCw className="animate-spin" size={18} />
              <span>جاري الفحص بالرادار عن أجهزة ESP32، شاشات ذكية، ومستقبلات DVR/NVR مربوطة بالراوتر حالياً...</span>
            </div>
          )}

          {discoveredDevices.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center bg-slate-950/60 border border-dashed border-white/10 rounded-3xl text-center backdrop-blur-xl p-8 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg">
                <Router size={32} />
              </div>
              <p className="text-white font-bold text-base">لم يتم العثور على أجهزة مكتشفة بالرادار حالياً</p>
              <p className="text-gray-400 text-xs max-w-sm">اضغط على زر "فحص الرادار (Scan)" بالأعلى للبحث عن الأجهزة الموصلة بالشبكة المحلية تلقائياً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {discoveredDevices.map(d => (
                <div key={d.id} className="bg-slate-950/80 backdrop-blur-2xl border border-cyan-500/30 rounded-3xl p-6 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex flex-col justify-between gap-6 hover:border-cyan-400/60 transition-all group">
                  
                  {/* Subtle Glow Header */}
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
                  
                  <div className="space-y-5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                          <Cpu size={24} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base">{d.deviceType || 'متحكم ESP32 جديد'}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/80 px-2.5 py-0.5 rounded-lg border border-cyan-500/20">
                              IP: {d.ipAddress}
                            </span>
                            <span className="text-[11px] font-mono text-gray-400 bg-black/50 px-2 py-0.5 rounded-lg border border-white/10">
                              MAC: {d.macAddress}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-full text-[11px] font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        مكتشف بالشبكة
                      </span>
                    </div>

                    {/* Inputs to customize before pairing */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="block text-xs text-gray-300 font-bold">اسم مخصص للجهاز</label>
                        <input
                          type="text"
                          placeholder="مثال: لوحة الصالة"
                          value={customNames[d.id] || ''}
                          onChange={(e) => setCustomNames({ ...customNames, [d.id]: e.target.value })}
                          className="w-full bg-black/60 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400 font-semibold transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs text-gray-300 font-bold">تحديد الغرفة</label>
                        <select
                          value={selectedRooms[d.id] || ''}
                          onChange={(e) => setSelectedRooms({ ...selectedRooms, [d.id]: e.target.value })}
                          className="w-full bg-black/60 border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400 font-semibold cursor-pointer transition-all"
                        >
                          <option value="">اختر غرفة...</option>
                          {rooms.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePair(d.id)}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>ربط وتأكيد الجهاز (Pair & Bind)</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
