'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Power, SlidersHorizontal, ZoomIn, ZoomOut, Grid, Sparkles, 
  Lightbulb, Wind, Save, Trash2, Plus, Move, CheckCircle2,
  Tv, Lock, Shield, Eye, Flame, Droplets, Volume2, X, PlusCircle,
  Layers, Info
} from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { notify } from '@/store/useConfirmStore';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface ESPController {
  id: string;
  name: string;
  isOnline: boolean;
  deviceCount: number;
}

interface CustomRoom {
  id: string;
  name: string;
  area: number;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type?: string;
}

interface CADDevicePin {
  id: string;
  name: string;
  espId: string;
  gpio: number;
  type: string;
  state: boolean;
  roomName: string;
  x: number;
  y: number;
}

type HandleDirection = 'se' | 'sw' | 'ne' | 'nw' | 'e' | 's';

interface ActiveResizeHandle {
  id: string;
  handle: HandleDirection;
}

interface FloorplanProps {
  onSelectRoom?: (roomName: string) => void;
}

const FULL_ARCHITECTURAL_PRESET: CustomRoom[] = [
  { id: 'r1', name: 'غرفة المعيشة الرئيسية', area: 32.0, color: 'cyan', x: 4, y: 4, w: 45, h: 44, type: 'living' },
  { id: 'r2', name: 'المطبخ الحديث', area: 18.0, color: 'amber', x: 52, y: 4, w: 44, h: 44, type: 'kitchen' },
  { id: 'r3', name: 'الحمام الرئيسي', area: 8.0, color: 'blue', x: 74, y: 52, w: 22, h: 44, type: 'bathroom' },
  { id: 'r4', name: 'غرفة النوم الرئيسية', area: 24.0, color: 'purple', x: 4, y: 52, w: 45, h: 44, type: 'bedroom' },
  { id: 'r5', name: 'المجلس والممر', area: 20.0, color: 'emerald', x: 52, y: 52, w: 20, h: 44, type: 'garden' },
];

// Helper: Filter out sensors completely (DHT22, energy, motion, etc.)
const isSensorDevice = (dev: any): boolean => {
  if (!dev) return false;
  if (dev.isSensor) return true;
  const type = (dev.type || '').toLowerCase();
  const name = (dev.name || '').toLowerCase();
  const sensorKeywords = [
    'sensor', 'dht', 'dht22', 'dht11', 'temp', 'temperature', 
    'humidity', 'moisture', 'energy', 'acs712', 'motion', 'pir', 
    'analog', 'gas', 'smoke', 'ldr', 'light_sensor', 'حرارة', 'رطوبة', 'حساس', 'طاقة', 'استشعار'
  ];
  return sensorKeywords.some(k => type.includes(k) || name.includes(k));
};

export const Floorplan2DCAD: React.FC<FloorplanProps> = ({ onSelectRoom }) => {
  const user = useSmartHomeStore(state => state.user);
  const globalDevices = useSmartHomeStore(state => state.devices);
  const toggleGlobalDevice = useSmartHomeStore(state => state.toggleDevice);

  // Active Modes: 'control' | 'design'
  const [activeTabMode, setActiveTabMode] = useState<'control' | 'design'>('control');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>('r1');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // Persistent Real DB State
  const [floorPlanId, setFloorPlanId] = useState<string | null>(null);
  const [roomsList, setRoomsList] = useState<CustomRoom[]>(FULL_ARCHITECTURAL_PRESET);
  const [devicePins, setDevicePins] = useState<CADDevicePin[]>([]);
  const [controllersList, setControllersList] = useState<ESPController[]>([]);
  const [houseWidth, setHouseWidth] = useState(14.5);
  const [houseLength, setHouseLength] = useState(18.0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // Studio Inputs
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomArea, setNewRoomArea] = useState(25);
  const [newRoomColor, setNewRoomColor] = useState('cyan');

  // Drag & Resize State
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null);
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [resizingRoomHandle, setResizingRoomHandle] = useState<ActiveResizeHandle | null>(null);

  // Layers Checkboxes
  const [layers, setLayers] = useState({
    grid: true,
    walls: true,
    rooms: true,
    devices: true,
    labels: true
  });

  // 1. Fetch Real Data from PostgreSQL API and Local Storage
  const loadDatabaseData = async () => {
    try {
      // Check local storage first for instant fast load
      const cached = localStorage.getItem('mosa_floorplan_saved_state');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.rooms && Array.isArray(parsed.rooms) && parsed.rooms.length > 0) {
            setRoomsList(parsed.rooms);
          }
          if (parsed.devicePins && Array.isArray(parsed.devicePins)) {
            // Strictly exclude sensors from stored pins
            setDevicePins(parsed.devicePins.filter((p: any) => !isSensorDevice(p)));
          }
        } catch {}
      }

      const ctrlRes = await fetchAuth('/api/controllers');
      if (ctrlRes.ok) {
        const ctrls = await ctrlRes.json();
        if (Array.isArray(ctrls)) {
          setControllersList(ctrls.map((c: any) => ({
            id: c.id,
            name: c.name || `ESP32-${c.id}`,
            isOnline: c.status === 'online',
            deviceCount: c.deviceCount || 0
          })));
        }
      }

      const fpRes = await fetchAuth('/api/floorplan');
      if (fpRes.ok) {
        const plans = await fpRes.json();
        if (Array.isArray(plans) && plans.length > 0) {
          const activePlan = plans[0];
          setFloorPlanId(activePlan.id);

          if (activePlan.imageData) {
            try {
              const parsed = typeof activePlan.imageData === 'string' ? JSON.parse(activePlan.imageData) : activePlan.imageData;
              if (parsed.rooms && Array.isArray(parsed.rooms) && parsed.rooms.length > 0) {
                setRoomsList(parsed.rooms);
                if (parsed.rooms[0]) setSelectedRoomId(parsed.rooms[0].id);
              }
              if (parsed.devicePins && Array.isArray(parsed.devicePins)) {
                // Strictly exclude sensors from stored pins
                setDevicePins(parsed.devicePins.filter((p: any) => !isSensorDevice(p)));
              }
              if (parsed.width) setHouseWidth(parsed.width);
              if (parsed.length) setHouseLength(parsed.length);
            } catch (e) { console.error(e); }
          }
        }
      }
    } catch (e) {
      console.error('Error loading floorplan:', e);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, []);

  // 2. Sync state & names of already placed devices from global store (Strictly NO auto-placing and NO sensors)
  useEffect(() => {
    if (globalDevices && globalDevices.length > 0) {
      setDevicePins(prev => {
        return prev
          .filter(p => !isSensorDevice(p))
          .map(p => {
            const dev = globalDevices.find(d => String(d.id) === String(p.id));
            if (!dev) return p;
            const stateIsOn = String(dev.state) === 'ON' || (dev.state as any) === true || (dev.state as any)?.isOn === true;
            return {
              ...p,
              name: dev.name || p.name,
              state: stateIsOn,
              type: (dev.type || p.type || 'light').toLowerCase()
            };
          });
      });
    }
  }, [globalDevices]);

  // Controllable devices from globalDevices that are NOT sensors and NOT on the map yet
  const availableControllableDevices = (globalDevices || []).filter(dev => {
    if (isSensorDevice(dev)) return false;
    const isAlreadyOnMap = devicePins.some(p => String(p.id) === String(dev.id));
    return !isAlreadyOnMap;
  });

  // 3. Add Device To Map Handler (Manual placement only)
  const handleAddDeviceToMap = (dev: any) => {
    if (isSensorDevice(dev)) {
      notify({ 
        type: 'error', 
        title: 'غير مسموح بإضافة حساس', 
        message: 'المخطط مخصص للأجهزة القابلة للتحكم والتشغيل فقط (مصابيح، مآخذ، مفاتيح، مكيفات).' 
      });
      return;
    }
    
    if (devicePins.some(p => String(p.id) === String(dev.id))) {
      notify({ type: 'info', title: 'الجهاز موجود مسبقاً', message: 'هذا الجهاز موضوع بالفعل على الخريطة.' });
      return;
    }

    const stateIsOn = String(dev.state) === 'ON' || (dev.state as any) === true || dev.state?.isOn === true;
    const newPin: CADDevicePin = {
      id: String(dev.id),
      name: dev.name || `جهاز ${dev.pin || ''}`,
      espId: dev.nodeId || 'ESP32',
      gpio: dev.pin || 4,
      type: (dev.type || 'light').toLowerCase(),
      state: stateIsOn,
      roomName: dev.room?.name || 'الخريطة الرئيسية',
      x: 50,
      y: 50
    };

    setDevicePins(prev => [...prev, newPin]);
    setSelectedPinId(newPin.id);
    notify({ 
      type: 'success', 
      title: 'تم وضع الجهاز بالخريطة', 
      message: `تم وضع "${newPin.name}" في منتصف المخطط. يمكنك الآن سحبه إلى الغرفة المطلوبة وحفظ التعديلات.` 
    });
  };

  // 4. Remove Device From Map ONLY (Does NOT delete device from system/DB)
  const handleRemoveDeviceFromMap = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const pin = devicePins.find(p => String(p.id) === String(id));
    const nextPins = devicePins.filter(p => String(p.id) !== String(id));
    setDevicePins(nextPins);
    if (selectedPinId === id) setSelectedPinId(null);

    // 1. Immediately persist to localStorage
    const payload = {
      rooms: roomsList,
      devicePins: nextPins,
      width: houseWidth,
      length: houseLength,
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem('mosa_floorplan_saved_state', JSON.stringify(payload));
    } catch (err) {
      console.error(err);
    }

    // 2. Silently sync to PostgreSQL DB immediately
    fetchAuth('/api/floorplan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: floorPlanId,
        name: 'المخطط الهندسي الرئيسي',
        imageData: payload
      })
    }).catch(err => console.error('Silent floorplan sync failed:', err));

    notify({ 
      type: 'info', 
      title: 'تمت إزالة الجهاز من الخريطة', 
      message: `تمت إزالة "${pin?.name || 'الجهاز'}" من المخطط التفاعلي فقط (الجهاز لا يزال محفوظاً في النظام وقائمتك العامة).` 
    });
  };

  // 5. Save to PostgreSQL and LocalStorage
  const handleSaveLayoutToDB = async () => {
    setIsSaving(true);
    try {
      const payload = {
        rooms: roomsList,
        devicePins: devicePins.filter(p => !isSensorDevice(p)),
        width: houseWidth,
        length: houseLength,
        savedAt: new Date().toISOString()
      };

      // 1. Save to LocalStorage for instant recall
      localStorage.setItem('mosa_floorplan_saved_state', JSON.stringify(payload));

      // 2. Save to Backend DB
      await fetchAuth('/api/floorplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: floorPlanId,
          name: 'المخطط الهندسي الرئيسي',
          imageData: payload
        })
      });

      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
      notify({ type: 'success', title: 'تم حفظ المخطط', message: 'تم حفظ توزيع الغرف ومواقع الأجهزة بنجاح في قاعدة البيانات!' });
    } catch (e: any) {
      console.error(e);
      notify({ type: 'error', title: 'خطأ في الحفظ', message: e.message || 'فشل حفظ المخطط' });
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Apply Preset Layout
  const applyPresetLayout = () => {
    setRoomsList(FULL_ARCHITECTURAL_PRESET);
    if (FULL_ARCHITECTURAL_PRESET[0]) setSelectedRoomId(FULL_ARCHITECTURAL_PRESET[0].id);
    notify({ type: 'info', title: 'تم تطبيق القالب', message: 'تم استرجاع التخطيط المعماري الكامل للغرف.' });
  };

  // Toggle Device Switch
  const handleToggleDevicePin = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDevicePins(prev => prev.map(d => d.id === id ? { ...d, state: !d.state } : d));
    if (toggleGlobalDevice) await toggleGlobalDevice(id);
  };

  // Drag & Move Pin Handlers
  const handleMouseDownPin = (id: string, e: React.MouseEvent) => {
    if (activeTabMode !== 'design') return;
    e.stopPropagation();
    setDraggingPinId(id);
    setSelectedPinId(id);
  };

  const handleMouseDownRoom = (id: string, e: React.MouseEvent) => {
    if (activeTabMode !== 'design') return;
    e.stopPropagation();
    setDraggingRoomId(id);
    setSelectedRoomId(id);
  };

  const handleMouseDownResizeHandle = (id: string, handle: HandleDirection, e: React.MouseEvent) => {
    if (activeTabMode !== 'design') return;
    e.stopPropagation();
    setResizingRoomHandle({ id, handle });
    setSelectedRoomId(id);
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (!canvasRef.current || activeTabMode !== 'design') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const curX = Math.min(96, Math.max(2, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const curY = Math.min(96, Math.max(2, Math.round(((e.clientY - rect.top) / rect.height) * 100)));

    if (draggingPinId) {
      setDevicePins(prev => prev.map(d => d.id === draggingPinId ? { ...d, x: curX, y: curY } : d));
    } else if (resizingRoomHandle) {
      const { id, handle } = resizingRoomHandle;
      setRoomsList(prev => prev.map(r => {
        if (r.id !== id) return r;
        let newW = r.w;
        let newH = r.h;

        if (handle === 'se') {
          newW = Math.max(10, curX - r.x);
          newH = Math.max(10, curY - r.y);
        } else if (handle === 'e') {
          newW = Math.max(10, curX - r.x);
        } else if (handle === 's') {
          newH = Math.max(10, curY - r.y);
        }

        return { ...r, w: Math.min(94, newW), h: Math.min(94, newH) };
      }));
    } else if (draggingRoomId) {
      setRoomsList(prev => prev.map(r => {
        if (r.id !== draggingRoomId) return r;
        const newX = Math.min(100 - r.w, Math.max(0, curX));
        const newY = Math.min(100 - r.h, Math.max(0, curY));
        return { ...r, x: newX, y: newY };
      }));
    }
  };

  const handleMouseUpCanvas = () => {
    setDraggingPinId(null);
    setDraggingRoomId(null);
    setResizingRoomHandle(null);
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const newId = `room-${Date.now()}`;
    const newRoom: CustomRoom = {
      id: newId,
      name: newRoomName.trim(),
      area: newRoomArea || 20,
      color: newRoomColor,
      x: 10 + (roomsList.length * 5) % 40,
      y: 10 + (roomsList.length * 5) % 40,
      w: 35,
      h: 35,
      type: 'custom'
    };

    setRoomsList(prev => [...prev, newRoom]);
    setSelectedRoomId(newId);
    setNewRoomName('');
    notify({ type: 'success', title: 'تمت إضافة الغرفة', message: `تمت إضافة ${newRoom.name} إلى المخطط.` });
  };

  const handleDeleteSelectedRoom = () => {
    if (!selectedRoomId) return;
    setRoomsList(prev => prev.filter(r => r.id !== selectedRoomId));
    setSelectedRoomId(null);
    notify({ type: 'info', title: 'تم حذف الغرفة', message: 'تم إزالة الغرفة المحددة من المخطط.' });
  };

  const handleUpdateRoomDimension = (param: 'w' | 'h' | 'area', val: number) => {
    if (!selectedRoomId) return;
    setRoomsList(prev => prev.map(r => r.id === selectedRoomId ? { ...r, [param]: val } : r));
  };

  const selectedRoomObj = roomsList.find(r => r.id === selectedRoomId);

  // Helper icon selector
  const getDeviceIcon = (type: string, isOn: boolean) => {
    switch (type.toLowerCase()) {
      case 'fan':
      case 'ac':
      case 'climate':
        return <Wind size={18} className={isOn ? 'text-cyan-300 animate-spin' : 'text-slate-400'} />;
      case 'lock':
        return <Lock size={18} className={isOn ? 'text-emerald-400' : 'text-slate-400'} />;
      case 'pump':
        return <Droplets size={18} className={isOn ? 'text-blue-400' : 'text-slate-400'} />;
      case 'socket':
        return <Tv size={18} className={isOn ? 'text-amber-400' : 'text-slate-400'} />;
      default:
        return <Lightbulb size={18} className={isOn ? 'text-amber-300 animate-pulse' : 'text-slate-400'} />;
    }
  };

  return (
    <div className="space-y-4 select-none" onMouseUp={handleMouseUpCanvas} onMouseLeave={handleMouseUpCanvas}>
      
      {/* ── Header Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
            <Grid size={22} />
          </div>
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <span>مخطط المنزل التفاعلي الذكي (2D Live CAD Map)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                Active Node: MosaNode
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {activeTabMode === 'control' 
                ? 'في نمط التشغيل المباشر: انقر على أي جهاز للتحكم الفوري به ورؤية حالة الإضاءة بالغرف' 
                : 'في نمط استوديو التصميم: يمكنك إضافة أو سحب الأجهزة وحذفها من المخطط وتعديل مقاسات الغرف'}
            </p>
          </div>
        </div>

        {/* Mode Toggle & Actions */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 p-1 rounded-2xl border border-white/10 flex items-center gap-1">
            <button
              onClick={() => setActiveTabMode('control')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTabMode === 'control'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye size={14} />
              <span>نمط التشغيل المباشر</span>
            </button>
            <button
              onClick={() => setActiveTabMode('design')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTabMode === 'design'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>استوديو التصميم (Design Studio)</span>
            </button>
          </div>

          <button
            onClick={handleSaveLayoutToDB}
            disabled={isSaving}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all active:scale-95"
          >
            <Save size={15} className={isSaving ? 'animate-spin' : ''} />
            <span>{isSaving ? 'جاري الحفظ...' : 'حفظ المخطط الآن'}</span>
          </button>
        </div>
      </div>

      {/* ── Main Workspace ── */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* CAD Canvas View */}
        <div className={`${activeTabMode === 'design' ? 'col-span-12 lg:col-span-8' : 'col-span-12'} transition-all`}>
          <div className="relative bg-[#050b14] border border-cyan-500/20 rounded-3xl p-4 shadow-2xl overflow-hidden min-h-[550px]">
            
            {/* Blueprint Grid Overlay */}
            {layers.grid && (
              <div 
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px), radial-gradient(#38bdf8 1px, #050b14 1px)',
                  backgroundSize: '24px 24px',
                  backgroundPosition: '0 0, 12px 12px'
                }}
              />
            )}

            {/* Canvas Header Bar */}
            <div className="flex justify-between items-center mb-3 text-xs text-slate-400 z-10 relative border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                  CAD SCALE: 1:100 ({houseWidth}m x {houseLength}m)
                </span>
                <span className="text-slate-500">|</span>
                <span>الأجهزة الموضوعة بالمخطط: <strong className="text-cyan-300 font-mono font-bold">{devicePins.length}</strong></span>
              </div>

              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setZoomLevel(prev => Math.max(70, prev - 10))}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-300 border border-white/10"
                  title="تصغير"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="font-mono text-[11px] px-1 text-slate-300">{zoomLevel}%</span>
                <button 
                  onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-300 border border-white/10"
                  title="تكبير"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>

            {/* Interactive Drawing Canvas */}
            <div
              ref={canvasRef}
              onMouseMove={handleMouseMoveCanvas}
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              className="relative w-full aspect-[4/3] max-h-[520px] bg-slate-950/90 rounded-2xl border-2 border-cyan-500/40 shadow-inner overflow-hidden transition-transform select-none"
            >
              
              {/* Outer Walls Framing */}
              <div className="absolute inset-1.5 border-[3px] border-cyan-400/40 rounded-xl pointer-events-none" />

              {/* 1. Rooms Rendering */}
              {layers.rooms && roomsList.map(r => {
                const isSelected = selectedRoomId === r.id;
                // Check if any light inside this room is active
                const roomDevices = devicePins.filter(d => 
                  d.x >= r.x && d.x <= (r.x + r.w) && d.y >= r.y && d.y <= (r.y + r.h)
                );
                const isAnyDeviceOn = roomDevices.some(d => d.state);

                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedRoomId(r.id);
                      if (onSelectRoom) onSelectRoom(r.name);
                    }}
                    onMouseDown={(e) => handleMouseDownRoom(r.id, e)}
                    style={{
                      left: `${r.x}%`,
                      top: `${r.y}%`,
                      width: `${r.w}%`,
                      height: `${r.h}%`
                    }}
                    className={`absolute rounded-xl border-2 transition-all p-2.5 flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/30 z-20'
                        : 'border-cyan-500/30 hover:border-cyan-400/60 z-10'
                    } ${
                      isAnyDeviceOn
                        ? 'bg-amber-500/15 shadow-[inset_0_0_30px_rgba(245,158,11,0.25)]'
                        : 'bg-slate-900/60'
                    } ${activeTabMode === 'design' ? 'cursor-move' : 'cursor-pointer'}`}
                  >
                    {/* Room Header Label */}
                    <div className="flex justify-between items-start pointer-events-none">
                      <div>
                        <h4 className="font-black text-xs text-white leading-tight flex items-center gap-1.5">
                          <span>{r.name}</span>
                          {isAnyDeviceOn && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />
                          )}
                        </h4>
                        <span className="text-[10px] font-mono text-cyan-400 font-bold">{r.area} m²</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-slate-400 border border-white/5">
                        {roomDevices.filter(d => d.state).length}/{roomDevices.length}
                      </span>
                    </div>

                    {/* Design Mode Handles */}
                    {activeTabMode === 'design' && isSelected && (
                      <>
                        <div
                          onMouseDown={(e) => handleMouseDownResizeHandle(r.id, 'se', e)}
                          className="absolute -bottom-2 -right-2 w-4 h-4 bg-amber-400 border-2 border-slate-950 rounded-full cursor-se-resize shadow-md hover:scale-125 z-30"
                          title="سحب لتغيير الحجم"
                        />
                        <div
                          onMouseDown={(e) => handleMouseDownResizeHandle(r.id, 'e', e)}
                          className="absolute top-1/2 -right-2 -translate-y-1/2 w-3 h-5 bg-cyan-400 border-2 border-slate-950 rounded-md cursor-e-resize shadow-md hover:scale-125 z-30"
                        />
                        <div
                          onMouseDown={(e) => handleMouseDownResizeHandle(r.id, 's', e)}
                          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-3 bg-cyan-400 border-2 border-slate-950 rounded-md cursor-s-resize shadow-md hover:scale-125 z-30"
                        />
                      </>
                    )}
                  </div>
                );
              })}

              {/* 2. Devices (Pins) on Map with Clear Name Labels & Obvious Delete in Design Mode */}
              {layers.devices && devicePins.map(d => {
                const isDragging = draggingPinId === d.id;
                const isPinSelected = selectedPinId === d.id;
                const isOn = d.state;

                return (
                  <div
                    key={d.id}
                    style={{ left: `${d.x}%`, top: `${d.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center group cursor-pointer"
                    onMouseDown={(e) => handleMouseDownPin(d.id, e)}
                    onClick={(e) => {
                      if (activeTabMode === 'control') {
                        handleToggleDevicePin(d.id, e);
                      } else {
                        setSelectedPinId(d.id);
                      }
                    }}
                  >
                    {/* Design Mode Always-Visible Red Delete Button */}
                    {activeTabMode === 'design' && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveDeviceFromMap(d.id, e);
                        }}
                        className="absolute -top-3.5 -right-3.5 w-6 h-6 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-xl border-2 border-white transition-all hover:scale-125 z-50 cursor-pointer"
                        title="حذف هذا الجهاز من الخريطة فقط"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}

                    {/* Interactive Device Button */}
                    <button
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all shadow-xl ${
                        isOn
                          ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 border-white shadow-[0_0_22px_rgba(251,191,36,0.6)] scale-105'
                          : 'bg-slate-900/95 text-slate-400 border-cyan-500/40 hover:border-cyan-300 hover:text-white'
                      } ${isDragging || (activeTabMode === 'design' && isPinSelected) ? 'ring-4 ring-amber-400 z-50 scale-110' : ''}`}
                      title={`${d.name} (${isOn ? 'تشغيل' : 'إطفاء'})`}
                    >
                      {getDeviceIcon(d.type, isOn)}
                    </button>

                    {/* Device Name Label Beneath Icon */}
                    <div className="mt-1 px-2 py-0.5 rounded-full bg-slate-950/90 border border-white/15 text-[10px] font-bold text-white shadow-lg backdrop-blur-md whitespace-nowrap max-w-[120px] truncate text-center transition-all group-hover:border-cyan-400 group-hover:scale-105">
                      {d.name}
                    </div>
                  </div>
                );
              })}

            </div>

            {/* Canvas Footer Status */}
            <div className="mt-3 pt-2 border-t border-white/10 flex justify-between items-center text-xs">
              <span className="text-slate-300">
                الغرفة المحددة: <strong className="text-cyan-300 font-bold">{selectedRoomObj?.name || 'الكل'}</strong>
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-slate-400">
                  الأجهزة النشطة: <strong className="text-emerald-400">{devicePins.filter(d => d.state).length}</strong> / {devicePins.length}
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">عدد الغرف: <strong className="text-white">{roomsList.length}</strong></span>
              </div>
            </div>

          </div>
        </div>

        {/* Studio Sidebar (Only in Design Mode) */}
        {activeTabMode === 'design' && (
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 backdrop-blur-xl">
              
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <h3 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <SlidersHorizontal size={16} />
                  <span>استوديو تخطيط الخريطة</span>
                </h3>
                <button
                  onClick={handleSaveLayoutToDB}
                  disabled={isSaving}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow transition-all"
                >
                  <Save size={13} />
                  <span>حفظ التعديلات</span>
                </button>
              </div>

              {/* Preset Button */}
              <button
                onClick={applyPresetLayout}
                className="w-full py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles size={14} />
                <span>تطبيق القالب المعماري الجاهز (5 غرف)</span>
              </button>

              {/* Selected Pin Controller (if user clicks on any device) */}
              {selectedPinId && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block">الجهاز المحدد على الخريطة:</span>
                      <strong className="text-xs text-white font-bold">
                        {devicePins.find(p => p.id === selectedPinId)?.name || 'جهاز'}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveDeviceFromMap(selectedPinId, e);
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-lg transition-all"
                    >
                      <Trash2 size={13} />
                      <span>حذف من الخريطة</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Section A: Devices Currently Placed on Map ── */}
              <div className="space-y-2 pt-1 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-black text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>أجهزة موضوعة بالخريطة ({devicePins.length}):</span>
                  </p>
                  {devicePins.length > 0 && (
                    <button
                      onClick={() => {
                        setDevicePins([]);
                        try {
                          const payload = {
                            rooms: roomsList,
                            devicePins: [],
                            width: houseWidth,
                            length: houseLength,
                            savedAt: new Date().toISOString()
                          };
                          localStorage.setItem('mosa_floorplan_saved_state', JSON.stringify(payload));
                          fetchAuth('/api/floorplan', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              id: floorPlanId,
                              name: 'المخطط الهندسي الرئيسي',
                              imageData: payload
                            })
                          }).catch(console.error);
                        } catch {}
                        notify({ type: 'info', title: 'تم مسح الخريطة', message: 'تمت إزالة جميع الأجهزة من الخريطة. الأجهزة لا تزال محفوظة بالنظام.' });
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 font-bold underline cursor-pointer"
                    >
                      <Trash2 size={10} />
                      <span>مسح الكل من المخطط</span>
                    </button>
                  )}
                </div>

                {devicePins.length === 0 ? (
                  <div className="p-3 rounded-2xl bg-black/30 border border-dashed border-white/10 text-center text-xs text-slate-400">
                    لا توجد أجهزة موضوعة على الخريطة حالياً. اختر من قائمة الأجهزة المتاحة بالأسفل لوضعها.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {devicePins.map(d => (
                      <div
                        key={d.id}
                        onClick={() => setSelectedPinId(d.id)}
                        className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          selectedPinId === d.id
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md'
                            : d.state
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-white'
                            : 'bg-black/40 border-white/5 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {getDeviceIcon(d.type, d.state)}
                          <div className="truncate">
                            <span className="font-bold block truncate">{d.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">GPIO {d.gpio}</span>
                          </div>
                        </div>

                        {/* Explicit Red Delete Button */}
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveDeviceFromMap(d.id, e);
                          }}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow transition-all shrink-0 cursor-pointer"
                          title="إزالة هذا الجهاز من الخريطة فقط دون حذفه من النظام"
                        >
                          <Trash2 size={12} />
                          <span>حذف</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Section B: Controllable Devices Available to Add ── */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                    <PlusCircle size={13} />
                    <span>أجهزة متاحة للإضافة للخريطة ({availableControllableDevices.length}):</span>
                  </p>
                </div>

                {availableControllableDevices.length === 0 ? (
                  <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-center text-[11px] text-emerald-300">
                    ✓ جميع الأجهزة القابلة للتشغيل موضوعة على الخريطة.
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {availableControllableDevices.map(dev => (
                      <div
                        key={dev.id}
                        className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs hover:border-emerald-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {getDeviceIcon(dev.type || 'light', false)}
                          <div className="truncate">
                            <span className="font-bold text-white block truncate">{dev.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">Pin {dev.pin || '4'}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddDeviceToMap(dev)}
                          className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow transition-all shrink-0 cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>وضع بالخريطة</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-2 rounded-xl bg-cyan-950/30 border border-cyan-500/20 flex items-start gap-1.5 text-[10px] text-cyan-300">
                  <Info size={13} className="shrink-0 mt-0.5" />
                  <span>ملاحظة: يتم استبعاد الحساسات (DHT22 / الطاقة) تلقائياً من المخطط للتركيز على التحكم بالمفاتيح والإنارة.</span>
                </div>
              </div>

              {/* Selected Room Controller */}
              {selectedRoomObj && (
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl space-y-2.5 pt-2 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-cyan-300 text-xs">
                      التحكم بالغرفة: {selectedRoomObj.name}
                    </span>
                    <button
                      onClick={handleDeleteSelectedRoom}
                      className="px-2.5 py-1 bg-red-600/80 hover:bg-red-600 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all"
                    >
                      <Trash2 size={12} />
                      <span>حذف الغرفة</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] text-slate-400 font-bold mb-1">العرض (W %):</label>
                      <input
                        type="number"
                        min="10"
                        max="90"
                        value={selectedRoomObj.w ?? 30}
                        onChange={e => handleUpdateRoomDimension('w', Math.max(10, Math.min(95, Number(e.target.value) || 30)))}
                        className="w-full px-2.5 py-1.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 font-bold mb-1">الطول (H %):</label>
                      <input
                        type="number"
                        min="10"
                        max="90"
                        value={selectedRoomObj.h ?? 30}
                        onChange={e => handleUpdateRoomDimension('h', Math.max(10, Math.min(95, Number(e.target.value) || 30)))}
                        className="w-full px-2.5 py-1.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Add Room Form */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <p className="text-xs font-bold text-slate-300">إضافة غرفة جديدة بالخريطة:</p>
                <form onSubmit={handleAddRoom} className="space-y-2 text-xs">
                  <input
                    type="text"
                    required
                    placeholder="اسم الغرفة (مثال: غرفة النوم، الصالة...)"
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  />

                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="5"
                      max="300"
                      placeholder="المساحة m²"
                      value={newRoomArea}
                      onChange={e => setNewRoomArea(Number(e.target.value))}
                      className="w-1/2 px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="w-1/2 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow flex items-center justify-center gap-1 transition-all"
                    >
                      <Plus size={14} />
                      <span>إضافة غرفة</span>
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
};
