"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { 
  Layers, Box, Plus, Power, PowerOff, Trash2, X, Zap, Sparkles,
  Tv, Bed, Utensils, Droplets, Sun, Home, Shield, Cpu, AlertCircle, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Room {
  id: string;
  name: string;
  devices?: any[];
}

export default function RoomsPage() {
  const { devices, initBackendConnection, toggleDevice } = useSmartHomeStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Local optimistic overrides for device room assignment
  const [deviceRoomOverrides, setDeviceRoomOverrides] = useState<Record<string, string | null>>({});

  // Add / Edit Room Modal State
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [selectedDevicesForRoom, setSelectedDevicesForRoom] = useState<string[]>([]);
  const [modalError, setModalError] = useState('');

  // Manage room devices modal state
  const [managingRoom, setManagingRoom] = useState<Room | null>(null);

  const roomIcons: Record<string, any> = {
    'الصالة الرئيسية': Tv,
    'الصالة': Tv,
    'الصاله': Tv,
    'غرفة النوم': Bed,
    'المطبخ': Utensils,
    'الاستقبال': Home,
    'الحديقة': Sun,
    'الحمام': Droplets,
    'الممر': Shield,
    'لوحة الخدمات والكهرباء': Zap,
    'Default': Box
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await fetchAuth('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoCategorize = async () => {
    try {
      setAutoLoading(true);
      const res = await fetchAuth('/api/rooms/auto-categorize', { method: 'POST' });
      if (res.ok) {
        setDeviceRoomOverrides({});
        await fetchRooms();
        initBackendConnection();
      }
    } catch (e) {
      console.error('Auto categorize failed', e);
    } finally {
      setAutoLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    initBackendConnection();
  }, []);

  // Handle direct inline room change for a device
  const handleDeviceRoomChange = async (deviceId: string | number, targetRoomId: string) => {
    const devIdStr = String(deviceId);
    const finalRoomId = targetRoomId === 'unassigned' || !targetRoomId ? null : targetRoomId;

    // Optimistic update
    setDeviceRoomOverrides(prev => ({ ...prev, [devIdStr]: finalRoomId }));

    try {
      const res = await fetchAuth(`/api/devices/${devIdStr}/room`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: finalRoomId })
      });

      if (res.ok) {
        await fetchRooms();
        initBackendConnection();
      } else {
        setDeviceRoomOverrides(prev => {
          const updated = { ...prev };
          delete updated[devIdStr];
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
      setDeviceRoomOverrides(prev => {
        const updated = { ...prev };
        delete updated[devIdStr];
        return updated;
      });
    }
  };

  // Group devices by room
  const groupedRooms = () => {
    const map = new Map<string, { id: string | null; name: string; devices: any[] }>();

    // 1. Registered database rooms
    rooms.forEach(r => {
      map.set(r.id, { id: r.id, name: r.name, devices: [] });
    });

    // 2. Unassigned fallback room
    const UNASSIGNED_KEY = 'unassigned';
    map.set(UNASSIGNED_KEY, { id: null, name: 'غير محدد (بدون غرفة)', devices: [] });

    // 3. Map devices to rooms with overrides & smart controller/room name matching
    devices.forEach(d => {
      const devAny = d as any;
      const devIdStr = String(d.id);
      let rId: string | null = null;
      if (deviceRoomOverrides.hasOwnProperty(devIdStr)) {
        rId = deviceRoomOverrides[devIdStr];
      } else {
        rId = devAny.roomId || (typeof devAny.room === 'object' && devAny.room ? devAny.room.id : null);
        if (!rId) {
          const roomObjName = (typeof devAny.room === 'object' && devAny.room ? devAny.room.name : (typeof devAny.room === 'string' ? devAny.room : '')) || '';
          const controllerName = devAny.controller?.name || '';
          const targetName = (String(roomObjName || controllerName || '')).trim();

          if (targetName) {
            const found = rooms.find(r => {
              const rName = r.name.trim();
              if (rName.toLowerCase() === targetName.toLowerCase()) return true;
              if (targetName.includes('مطبخ') && rName.includes('مطبخ')) return true;
              if ((targetName.includes('صالة') || targetName.includes('صاله')) && (rName.includes('صالة') || rName.includes('صاله'))) return true;
              return false;
            });
            if (found) rId = found.id;
          }
        }
      }

      if (rId && map.has(rId)) {
        map.get(rId)!.devices.push(d);
      } else {
        map.get(UNASSIGNED_KEY)!.devices.push(d);
      }
    });

    return Array.from(map.values())
      .filter(g => g.id !== null || g.devices.length > 0)
      .sort((a, b) => {
        if (a.id === null) return 1;
        if (b.id === null) return -1;
        if (b.devices.length !== a.devices.length) {
          return b.devices.length - a.devices.length;
        }
        return a.name.localeCompare(b.name);
      });
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!roomName.trim()) {
      setModalError('يرجى كتابة اسم الغرفة');
      return;
    }

    try {
      const res = await fetchAuth('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName.trim() })
      });

      if (res.ok) {
        const newRoom = await res.json();
        
        // Assign selected devices to this new room
        if (selectedDevicesForRoom.length > 0) {
          for (const devId of selectedDevicesForRoom) {
            await fetchAuth(`/api/devices/${devId}/room`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId: newRoom.id })
            });
          }
        }

        setRoomName('');
        setSelectedDevicesForRoom([]);
        setIsRoomModalOpen(false);
        await fetchRooms();
        initBackendConnection();
      } else {
        const data = await res.json();
        setModalError(data.message || 'فشل إضافة الغرفة');
      }
    } catch (e) {
      setModalError('حدث خطأ أثناء إضافة الغرفة');
    }
  };

  const handleDeleteRoom = async (roomId: string, name: string) => {
    if (!confirm(`هل أنت تأكد من حذف غرفة "${name}"؟ سيتم نقل أجهزتها تلقائياً إلى (غير محدد)`)) return;
    try {
      const res = await fetchAuth(`/api/rooms/${roomId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchRooms();
        initBackendConnection();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkToggleRoom = async (roomId: string | null, roomDevices: any[], state: 'ON' | 'OFF') => {
    const key = `${roomId || 'unassigned'}_${state}`;
    setActionLoading(key);
    try {
      if (roomId) {
        await fetchAuth('/api/devices/bulk-toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, state })
        });
      } else {
        const devIds = roomDevices.map(d => d.id);
        await fetchAuth('/api/devices/bulk-toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceIds: devIds, state })
        });
      }
      setTimeout(() => {
        initBackendConnection();
      }, 500);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchAssignToRoom = async (targetRoomId: string, deviceIds: string[]) => {
    for (const devId of deviceIds) {
      await fetchAuth(`/api/devices/${devId}/room`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: targetRoomId })
      });
    }
    setManagingRoom(null);
    await fetchRooms();
    initBackendConnection();
  };

  const roomGroups = groupedRooms();

  return (
    <div className="p-4 sm:p-6 lg:p-10 w-full" dir="rtl">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 border-b border-white/5 pb-4 sm:pb-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-blue-500/20 shrink-0">
            <Layers size={26} className="sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight">إدارة الغرف والمساحات</h1>
            <p className="text-gray-400 font-medium text-xs sm:text-sm mt-0.5">تقسيم وتوزيع أجهزة المنزل تلقائياً ومباشرة حسب الغرف</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
          {/* Smart Auto Categorize Button */}
          <button
            onClick={handleAutoCategorize}
            disabled={autoLoading}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-5 sm:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl sm:rounded-2xl transition-all shadow-md text-xs sm:text-sm cursor-pointer"
          >
            <Sparkles size={16} className={autoLoading ? 'animate-spin' : ''} />
            <span className="truncate">{autoLoading ? 'جاري التوزيع...' : 'توزيع تلقائي ⚡'}</span>
          </button>

          <button
            onClick={() => {
              setRoomName('');
              setSelectedDevicesForRoom([]);
              setModalError('');
              setIsRoomModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl sm:rounded-2xl transition-all shadow-md text-xs sm:text-sm cursor-pointer"
          >
            <Plus size={16} />
            <span className="truncate">إضافة غرفة</span>
          </button>
        </div>
      </div>

      {/* Preset Quick Add Badges */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">اقتراحات سريعة:</span>
        {['الصالة الرئيسية', 'غرفة النوم', 'المطبخ', 'الاستقبال', 'الحديقة', 'الممر', 'الحمام'].map((preset) => (
          <button
            key={preset}
            onClick={() => {
              setRoomName(preset);
              setSelectedDevicesForRoom([]);
              setModalError('');
              setIsRoomModalOpen(true);
            }}
            className="px-3 py-1 bg-white/5 hover:bg-blue-600/20 text-slate-300 hover:text-blue-400 border border-white/10 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer"
          >
            <Plus size={11} />
            {preset}
          </button>
        ))}
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {roomGroups.map((group, index) => {
          const IconComponent = roomIcons[group.name] || roomIcons['Default'];
          const activeDevicesCount = group.devices.filter(d => d.state === 'ON').length;

          return (
            <motion.div
              key={group.id || `group-${index}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-[#0e1424] border border-slate-800 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 flex flex-col justify-between relative overflow-hidden group shadow-xl hover:border-blue-500/30 transition-all duration-300"
            >
              {/* Top Room Header */}
              <div>
                <div className="flex justify-between items-start border-b border-white/10 pb-3.5 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <IconComponent size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-black text-white tracking-wide truncate">{group.name}</h2>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                        {group.devices.length} أجهزة ({activeDevicesCount} تعمل الآن)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {group.id && (
                      <button
                        onClick={() => setManagingRoom({ id: group.id!, name: group.name })}
                        className="text-blue-400 hover:text-blue-300 p-1.5 sm:p-2 hover:bg-blue-500/10 rounded-xl transition-colors text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        title="إضافة أجهزة لهذه الغرفة"
                      >
                        <Plus size={13} />
                        <span className="hidden sm:inline">إضافة أجهزة</span>
                      </button>
                    )}

                    {group.id && (
                      <button
                        onClick={() => handleDeleteRoom(group.id!, group.name)}
                        className="text-red-400/60 hover:text-red-400 p-1.5 sm:p-2 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                        title="حذف الغرفة"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Bulk Room Controls (Master Power Switch) */}
                <div className="flex items-center gap-2 mb-4 bg-white/[0.03] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border border-white/5">
                  <span className="text-[11px] font-bold text-slate-400 px-1 shrink-0">التحكم:</span>
                  <button
                    onClick={() => handleBulkToggleRoom(group.id, group.devices, 'ON')}
                    disabled={actionLoading !== null}
                    className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold py-1.5 px-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer"
                  >
                    <Power size={13} /> تشغيل الكل
                  </button>
                  <button
                    onClick={() => handleBulkToggleRoom(group.id, group.devices, 'OFF')}
                    disabled={actionLoading !== null}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold py-1.5 px-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer"
                  >
                    <PowerOff size={13} /> إطفاء الكل
                  </button>
                </div>

                {/* Device List inside Room */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5 custom-scrollbar">
                  {group.devices.length === 0 ? (
                    <div className="py-6 text-center bg-white/[0.02] border border-dashed border-white/5 rounded-xl">
                      <p className="text-xs text-slate-500 font-semibold mb-2">لا توجد أجهزة مخصصة لهذه الغرفة بعد.</p>
                      {rooms.length > 0 && group.id && (
                        <button
                          onClick={() => setManagingRoom({ id: group.id!, name: group.name })}
                          className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold cursor-pointer"
                        >
                          + نقل أجهزة هنا
                        </button>
                      )}
                    </div>
                  ) : (
                    group.devices.map(d => {
                      const isDeviceOn = d.state === 'ON';
                      const currentRoomId = deviceRoomOverrides[d.id] ?? (d.roomId || (typeof d.room === 'object' && d.room ? d.room.id : 'unassigned'));

                      return (
                        <div
                          key={d.id}
                          className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all space-y-2.5"
                        >
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                                isDeviceOn ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-500 border border-white/5'
                              }`}>
                                <Cpu size={15} />
                              </div>
                              <span className="text-xs font-bold text-white truncate">{d.name}</span>
                            </div>

                            {/* Toggle single device button */}
                            <button
                              onClick={() => toggleDevice(String(d.id))}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border shadow-sm cursor-pointer shrink-0 ${
                                isDeviceOn
                                  ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                                  : 'bg-slate-800 text-slate-400 border-white/5 hover:text-white'
                              }`}
                            >
                              {isDeviceOn ? 'ON' : 'OFF'}
                            </button>
                          </div>

                          {/* Direct Room Move Selector */}
                          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                            <span className="text-slate-400 font-medium">الغرفة المخصصة:</span>
                            <select
                              value={currentRoomId || 'unassigned'}
                              onChange={(e) => handleDeviceRoomChange(d.id, e.target.value)}
                              className="bg-[#070d1a] text-cyan-300 border border-slate-700 hover:border-cyan-400 rounded-lg px-2.5 py-1 text-[11px] font-bold focus:outline-none cursor-pointer max-w-[150px] truncate"
                              title="اختر الغرفة لنقل الجهاز فوراً"
                            >
                              <option value="unassigned">غير محدد</option>
                              {rooms.map(r => (
                                <option key={r.id} value={r.id}>📍 {r.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modal: Add New Room */}
      <AnimatePresence>
        {isRoomModalOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[99999] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 bg-[#070d1a] sm:bg-black/90" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b101d] border-0 sm:border sm:border-blue-500/30 sm:rounded-3xl w-full sm:max-w-lg overflow-hidden shadow-2xl relative p-5 sm:p-8 space-y-5 h-full sm:h-auto flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
                  <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    <Plus size={20} className="text-blue-400" />
                    إنشاء غرفة جديدة 📍
                  </h3>
                  <button onClick={() => setIsRoomModalOpen(false)} className="text-gray-400 hover:text-white p-1">
                    <X size={20} />
                  </button>
                </div>

                {modalError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2 mt-4">
                    <AlertCircle size={16} />
                    {modalError}
                  </div>
                )}

                <form id="create-room-form" onSubmit={handleCreateRoom} className="space-y-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">اسم الغرفة / المساحة</label>
                    <input
                      type="text"
                      required
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="مثال: الصالة الرئيسية أو غرفة النوم"
                      className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-xs font-bold"
                    />
                  </div>

                  {/* Devices Selection Checkboxes */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">حدد الأجهزة التي تريد نقلها لهذه الغرفة فوراً:</label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 bg-[#070d1a] p-3 rounded-xl border border-slate-800">
                      {devices.length === 0 ? (
                        <p className="text-xs text-slate-500">لا توجد أجهزة حالية للتخصيص.</p>
                      ) : (
                        devices.map(d => {
                          const devIdStr = String(d.id);
                          const isChecked = selectedDevicesForRoom.includes(devIdStr);
                          return (
                            <label
                              key={devIdStr}
                              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                isChecked ? 'bg-blue-600/20 border-blue-500/30 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              <span className="text-xs font-bold">{d.name}</span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedDevicesForRoom(prev => prev.filter(id => id !== devIdStr));
                                  } else {
                                    setSelectedDevicesForRoom(prev => [...prev, devIdStr]);
                                  }
                                }}
                                className="w-4 h-4 accent-blue-600 rounded"
                              />
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </form>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="submit"
                  form="create-room-form"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-all text-xs cursor-pointer shadow-lg"
                >
                  حفظ وإنشاء الغرفة
                </button>
                <button
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* Modal: Batch Assign Devices to Room */}
      <AnimatePresence>
        {managingRoom && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[99999] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 bg-[#070d1a] sm:bg-black/90" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b101d] border-0 sm:border sm:border-blue-500/30 sm:rounded-3xl w-full sm:max-w-md overflow-hidden shadow-2xl relative p-5 sm:p-8 space-y-5 h-full sm:h-auto flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                      <Plus size={18} />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-white">إضافة أجهزة إلى: {managingRoom.name}</h3>
                      <p className="text-[11px] text-slate-400 font-medium">اختر الأجهزة المطلوبة لنقلها فوراً</p>
                    </div>
                  </div>
                  <button onClick={() => setManagingRoom(null)} className="text-gray-400 hover:text-white p-1">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 bg-[#070d1a] p-3 rounded-xl border border-slate-800 mt-4">
                  {devices.map(d => {
                    const devAny = d as any;
                    const devIdStr = String(d.id);
                    const isAlreadyInRoom = (devAny.roomId === managingRoom.id || (typeof devAny.room === 'object' && devAny.room?.id === managingRoom.id));
                    return (
                      <div
                        key={devIdStr}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800"
                      >
                        <span className="text-xs font-bold text-white">{d.name}</span>
                        {isAlreadyInRoom ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                            <Check size={10} /> ينتمي لهذه الغرفة
                          </span>
                        ) : (
                          <button
                            onClick={() => handleBatchAssignToRoom(managingRoom.id, [devIdStr])}
                            className="text-[10px] font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 rounded-lg border border-blue-500/20 transition-all cursor-pointer"
                          >
                            + نقل للغرفة
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  onClick={() => setManagingRoom(null)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

    </div>
  );
}
