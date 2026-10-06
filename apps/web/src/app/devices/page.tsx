"use client";

import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { useSmartHome } from '@/hooks/useSmartHome';
import { useLanguage } from '@/context/LanguageContext';
import { 
  Cpu, Power, Battery, Wifi, Shield, Lightbulb, Thermometer, Wind, Plus, Info, 
  X, Sliders, Edit3, Layers, LayoutGrid, Check, Server, RefreshCw, Droplets, 
  Camera, Lock, Plug, Zap, Tv, Smartphone, Film, Cast 
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DeviceCard } from '@/components/DeviceCard';
import AddDeviceModal from '@/components/dashboard-ui/AddDeviceModal';
import { UniversalSmartTvRemote } from '@/components/entertainment/UniversalSmartTvRemote';
import { motion, AnimatePresence } from 'framer-motion';

export default function DevicesPage() {
  const devices = useSmartHomeStore(s => s.devices);
  const boards = useSmartHomeStore(s => s.boards);
  const { toggle } = useSmartHome();
  const { t } = useLanguage();

  const [filter, setFilter] = useState('all');
  const [selectedNodeFilter, setSelectedNodeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped');
  const [isEditMode, setIsEditMode] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);

  // Smart TV Remote Modal State
  const [selectedTvForRemote, setSelectedTvForRemote] = useState<{ id: string; name: string; room: string; brand: string } | null>(null);

  // Node Renaming State
  const [editingNode, setEditingNode] = useState<{ id: string; name: string } | null>(null);
  const [newNodeName, setNewNodeName] = useState('');

  // Device Editing State
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [editDevName, setEditDevName] = useState('');
  const [editDevType, setEditDevType] = useState('light');
  const [editDevPin, setEditDevPin] = useState(2);
  const [editDevSwitchPin, setEditDevSwitchPin] = useState<number | string>('');
  const [editDevRoom, setEditDevRoom] = useState('');
  const [editDevActiveState, setEditDevActiveState] = useState<string>('HIGH');
  const [editDevSwitchMode, setEditDevSwitchMode] = useState<string>('GND');

  const openDeviceEditModal = (dev: any) => {
    setEditingDevice(dev);
    setEditDevName(dev.name || '');
    setEditDevType((dev.type || 'LIGHT').toUpperCase());
    setEditDevPin(dev.pin ?? dev.pinNumber ?? 2);
    const swPin = dev.switchPin ?? dev.inPin ?? dev.inpin;
    setEditDevSwitchPin(swPin !== undefined && swPin !== null && swPin !== -1 ? swPin : '');
    const rName = dev.room?.name || dev.room;
    setEditDevRoom(typeof rName === 'string' ? rName : (rName?.name || t('devices.all_rooms')));
    setEditDevActiveState(dev.activeState || dev.stateObj?.activeState || 'HIGH');
    setEditDevSwitchMode(dev.switchMode || dev.stateObj?.switchMode || 'GND');
  };

  const [controllersList, setControllersList] = useState<any[]>([]);

  const fetchControllers = async () => {
    try {
      const res = await fetchAuth('/api/controllers');
      if (res.ok) {
        const data = await res.json();
        setControllersList(data);
      }
    } catch (e) { console.error(e); }
  };

  const fetchDevicesData = async () => {
    try {
      const res = await fetchAuth('/api/devices');
      if (res.ok) {
        const data = await res.json();
        const devList = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        if (devList.length > 0) {
          useSmartHomeStore.setState({ devices: devList });
        }
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchControllers();
    fetchDevicesData();
  }, []);

  const handleDeleteDevice = async (id: number | string, boardId: string) => {
    try {
      // Optimistic removal from store and local UI
      useSmartHomeStore.setState(state => ({
        devices: state.devices.filter(d => String(d.id) !== String(id))
      }));
      const res = await fetchAuth(`/api/devices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        useSmartHomeStore.getState().initBackendConnection();
        fetchDevicesData();
      }
    } catch (e) { console.error(e); }
  };

  const handleMoveCard = (id: number | string, boardId: string, direction: 'forward' | 'backward') => {
    const devList = [...devices];
    const index = devList.findIndex(d => String(d.id) === String(id));
    if (index === -1) return;

    const targetIndex = direction === 'forward' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= devList.length) return;

    const temp = devList[index];
    devList[index] = devList[targetIndex];
    devList[targetIndex] = temp;

    useSmartHomeStore.setState({ devices: devList });
  };

  // Filter devices by type & node
  const filteredDevices = devices.filter(d => {
    const devAny = d as any;
    const t = (d.type || '').toLowerCase();
    const n = (d.name || '').toLowerCase();

    let matchesType = true;
    if (filter === 'all') matchesType = true;
    else if (filter === 'light') matchesType = t === 'light' || t === 'rgb' || n.includes('إنارة') || n.includes('مصباح') || n.includes('سويج');
    else if (filter === 'tv') matchesType = t === 'tv' || t === 'smart_tv' || t === 'media_player' || n.includes('تلفاز') || n.includes('شاشة');
    else if (filter === 'socket') matchesType = t === 'socket' || n.includes('مقبس') || n.includes('فيشة');
    else if (filter === 'climate') matchesType = t === 'climate' || n.includes('مكيف') || n.includes('سبلت');
    else if (filter === 'security') matchesType = t === 'lock' || t === 'camera' || t === 'siren' || n.includes('قفل') || n.includes('كاميرا');
    else if (filter === 'irrigation') matchesType = t === 'pump' || t === 'moisture' || n.includes('مضخة') || n.includes('تربة');
    else if (filter === 'sensor') matchesType = t === 'sensor' || t === 'energy' || t === 'temperature' || t === 'moisture' || n.includes('حساس') || n.includes('حرارة');
    else matchesType = t === filter;

    const matchesNode = selectedNodeFilter === 'all' || devAny.nodeId === selectedNodeFilter || d.boardId === selectedNodeFilter;
    return matchesType && matchesNode;
  });

  // Group devices by ESP32 board
  const groupDevicesByBoard = () => {
    const grouped: Record<string, { boardInfo: any; devices: any[] }> = {};

    controllersList.forEach(ctrl => {
      grouped[ctrl.id] = {
        boardInfo: ctrl,
        devices: []
      };
    });

    filteredDevices.forEach(dev => {
      const devAny = dev as any;
      const devBoardId = devAny.nodeId || dev.boardId || devAny.controller?.id || 'unassigned';
      if (!grouped[devBoardId]) {
        grouped[devBoardId] = {
          boardInfo: {
            id: devBoardId,
            name: devAny.controller?.name || devBoardId,
            status: 'online',
            ipAddress: devAny.controller?.ipAddress || devAny.ipAddress || 'DHCP'
          },
          devices: []
        };
      }
      grouped[devBoardId].devices.push(dev);
    });

    Object.values(grouped).forEach(g => {
      g.devices.sort((a, b) => {
        const pinA = Number(a.pinNumber ?? a.pin ?? 0);
        const pinB = Number(b.pinNumber ?? b.pin ?? 0);
        if (pinA !== pinB) return pinA - pinB;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
    });

    return grouped;
  };

  const groupedData = groupDevicesByBoard();

  // Save Node Name Edit
  const handleSaveNodeName = async () => {
    if (!editingNode || !newNodeName.trim()) return;
    try {
      const res = await fetchAuth('/api/controllers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingNode.id, name: newNodeName.trim() })
      });
      if (res.ok) {
        alert('تم تعديل اسم لوحة الـ ESP32 بنجاح!');
        fetchControllers();
        useSmartHomeStore.getState().initBackendConnection();
        setEditingNode(null);
      } else {
        alert('حدث خطأ أثناء تعديل الاسم');
      }
    } catch (e) { console.error(e); }
  };

  // Save Device Edit
  const handleSaveDeviceEdit = async () => {
    if (!editingDevice) return;
    const numPin = Number(editDevPin);
    const numSwitchPin = editDevSwitchPin !== '' ? Number(editDevSwitchPin) : null;

    if (numPin < 0 || numPin > 39 || (numSwitchPin !== null && (numSwitchPin < 0 || numSwitchPin > 39))) {
      alert('نطاق الـ GPIO المتاح في متحكم ESP32 هو من 0 إلى 39 فقط.');
      return;
    }
    if ([0, 1, 3, 6, 7, 8, 9, 10, 11].includes(numPin) || (numSwitchPin !== null && [0, 1, 3, 6, 7, 8, 9, 10, 11].includes(numSwitchPin))) {
      alert('المنافذ (0, 1, 3, 6-11) محظورة لأنها مخصصة للـ Serial والذاكرة الفلاشية.');
      return;
    }
    if ([34, 35, 36, 39].includes(numPin)) {
      alert('المنافذ (34, 35, 36, 39) هي مداخل فقط، لا يمكن ربط ريلاي خرج عليها.');
      return;
    }

    try {
      const res = await fetchAuth(`/api/devices/${editingDevice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editDevName.trim() || editingDevice.name,
          type: editDevType,
          pinNumber: Number(editDevPin),
          switchPin: editDevSwitchPin !== '' ? Number(editDevSwitchPin) : null,
          inPin: editDevSwitchPin !== '' ? Number(editDevSwitchPin) : null,
          roomName: editDevRoom.trim() || undefined,
          activeState: editDevActiveState,
          switchMode: editDevSwitchMode
        })
      });
      if (res.ok) {
        useSmartHomeStore.getState().initBackendConnection();
        setEditingDevice(null);
      } else {
        alert('حدث خطأ أثناء تحديث الجهاز');
      }
    } catch (e) { console.error(e); }
  };

  const onlineControllers = controllersList.filter(c => c.status === 'online').length;
  const totalControllers = controllersList.length || 1;
  const activeDevices = devices.filter(d => d.state === 'ON' || (d.state as any) === true || (d.state as any) === 1).length;
  const totalDevices = devices.length;
  const totalWattage = devices.reduce((sum, d) => sum + (Number(d.powerUsage) || 0), 0);

  const isEdgeMode = useSmartHomeStore(s => s.isEdgeMode);
  const toggleEdgeMode = useSmartHomeStore(s => s.toggleEdgeMode);

  return (
    <div className="p-4 md:p-8 w-full font-sans" dir="rtl">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 bg-slate-950/70 p-6 rounded-3xl border border-white/10 backdrop-blur-2xl shadow-2xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400 text-cyan-300 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.35)]">
              <Cpu size={26} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                إدارة أجهزة ومتحكمات الـ ESP32
              </h1>
              <p className="text-slate-400 text-xs font-medium mt-1">
                مقسمة ومنظمة حسب كل لوحة ESP32 لمنع التشابك وتسهيل التعديل والربط الحقيقي
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Universal Smart TV Master Remote Trigger */}
          <button
            onClick={() => setSelectedTvForRemote({
              id: 'master-tv-devices',
              name: 'الريموت الموحد للشاشات الذكية',
              room: 'الصالة الرئيسية',
              brand: 'samsung'
            })}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.35)] hover:scale-105 cursor-pointer"
            title="فتح الريموت الموحد لجميع الشاشات الذكية"
          >
            <Tv size={16} />
            <span>ريموت الشاشات الذكية 📺</span>
          </button>

          {/* AI Eco Energy Saver Switch */}
          <div
            onClick={toggleEdgeMode}
            className={`cursor-pointer px-4 py-2.5 rounded-2xl border transition-all flex items-center gap-3 select-none ${
              isEdgeMode
                ? 'bg-emerald-500/15 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.25)] text-emerald-300 scale-[1.02]'
                : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200'
            }`}
            title="تفعيل أو إيقاف وضع توفير الطاقة الذكي"
          >
            <div className={`p-1.5 rounded-xl border ${isEdgeMode ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
              <Zap size={14} className={isEdgeMode ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white">توفير الطاقة</span>
                <span className={`w-2 h-2 rounded-full ${isEdgeMode ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              </div>
              <span className="text-[10px] font-mono text-emerald-400 block font-bold">
                {isEdgeMode ? 'نشط ⚡ (-28%)' : 'معطل'}
              </span>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-black/40 border border-white/10 p-1 rounded-2xl shadow-inner">
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers size={14} />
              <span>{t('devices.group_by_type')}</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={14} />
              <span>{t('devices.grid_view')}</span>
            </button>
          </div>

          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-4 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 border shadow-lg cursor-pointer ${
              isEditMode 
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/20 animate-pulse' 
                : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
            }`}
          >
            <Sliders size={15} />
            <span>{isEditMode ? 'إنهاء الترتيب ✕' : 'ترتيب الأجهزة'}</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-bold px-5 py-2.5 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:scale-105 transition-all flex items-center gap-2 text-xs cursor-pointer"
          >
            <Plus size={16} />
            <span>إضافة جهاز جديد</span>
          </button>
        </div>
      </div>

      {/* Top Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-950/70 border border-cyan-500/20 p-5 rounded-[2rem] shadow-xl flex items-center gap-4 backdrop-blur-xl">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Cpu size={22} />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] font-bold block">متحكمات ESP32 النشطة</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-white font-mono">{onlineControllers} / {totalControllers}</span>
              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                أونلاين
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-emerald-500/20 p-5 rounded-[2rem] shadow-xl flex items-center gap-4 backdrop-blur-xl">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Plug size={22} className="animate-pulse" />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] font-bold block">الأجهزة قيد التشغيل</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-white font-mono">{activeDevices} / {totalDevices}</span>
              <span className="text-[11px] text-emerald-400 font-bold">مفعل حالياً</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-amber-500/20 p-5 rounded-[2rem] shadow-xl flex items-center gap-4 backdrop-blur-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Zap size={22} />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] font-bold block">إجمالي الأحمال المباشرة</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-white font-mono">{totalWattage.toFixed(1)}</span>
              <span className="text-xs font-bold text-amber-400">Watt (واط)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-slate-950/70 p-4 rounded-3xl border border-white/10 shadow-xl backdrop-blur-xl">
        {/* Device Type Filters */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: t('devices.title') },
            { id: 'light', label: '💡 إنارة' },
            { id: 'tv', label: '📺 شاشات وريموت' },
            { id: 'socket', label: '🔌 مقابس' },
            { id: 'climate', label: '❄️ تكييف' },
            { id: 'security', label: '🔒 أمان وأقفال' },
            { id: 'irrigation', label: '🌱 ري ومضخات' },
            { id: 'sensor', label: '📊 مستشعرات' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-4 py-2 rounded-2xl font-bold text-xs transition-all border cursor-pointer ${
                filter === item.id
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 scale-[1.03]'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* ESP32 Node Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Cpu size={16} className="text-cyan-400" />
          <select
            value={selectedNodeFilter}
            onChange={(e) => setSelectedNodeFilter(e.target.value)}
            className="bg-slate-900 border border-cyan-500/30 rounded-2xl px-4 py-2 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
          >
            <option value="all">تصفية حسب المتحكم: (الكل)</option>
            {controllersList.map(c => (
              <option key={c.id} value={c.id}>
                {c.name || c.id} ({c.status === 'online' ? '🟢 متصل' : '🔴 غير متصل'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CONTENT: Grouped By ESP32 Node */}
      {viewMode === 'grouped' ? (
        <div className="space-y-8">
          {Object.keys(groupedData).length === 0 ? (
            <div className="py-20 text-center border border-white/5 rounded-[2rem] bg-[#0b0e14]/40 backdrop-blur-xl">
              <Cpu size={48} className="mx-auto text-white/20 mb-4" />
              <p className="text-gray-400 font-bold">لا توجد متحكمات أو أجهزة مضافة حالياً</p>
            </div>
          ) : (
            Object.entries(groupedData).map(([nodeId, group]) => {
              const boardInfo = group.boardInfo;
              const boardDevices = group.devices;
              const isOnline = boardInfo.status === 'online';

              return (
                <div
                  key={nodeId}
                  className={`rounded-[2rem] border transition-all p-6 bg-[#11151c]/90 border-white/10 shadow-xl ${isOnline ? 'hover:border-indigo-500/30' : 'opacity-85'}`}
                >
                  {/* Board Section Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 mb-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${isOnline ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                        <Cpu size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-white">{boardInfo.name || nodeId}</h2>
                          <button
                            onClick={() => {
                              setEditingNode({ id: nodeId, name: boardInfo.name || nodeId });
                              setNewNodeName(boardInfo.name || nodeId);
                            }}
                            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                            title="تعديل اسم اللوحة"
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 font-mono">
                          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`}></span>
                          ESP32 ID: {nodeId} {boardInfo.ipAddress || boardInfo.ip ? `| IP: ${boardInfo.ipAddress || boardInfo.ip}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-indigo-300">
                        {boardDevices.length} أجهزة متصلة
                      </span>
                    </div>
                  </div>

                  {/* Connected Devices Grid inside this ESP32 board */}
                  {boardDevices.length === 0 ? (
                    <div className="p-8 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl text-gray-400 text-xs">
                      لا توجد أجهزة مربوطة بهذه اللوحة حالياً. اضغط "إضافة جهاز جديد" لربط رلاي جديد.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {boardDevices.map(device => (
                        <DeviceCard
                          key={`${device.boardId}-${device.id}`}
                          device={device}
                          boardName={boardInfo.name || `GPIO ${device.pin}`}
                          onToggle={(id, boardId) => toggle(id, boardId)}
                          onDelete={(id, boardId) => handleDeleteDevice(id, boardId)}
                          onEdit={openDeviceEditModal}
                          isEditMode={isEditMode}
                          onMoveForward={(id, boardId) => handleMoveCard(id, boardId, 'forward')}
                          onMoveBackward={(id, boardId) => handleMoveCard(id, boardId, 'backward')}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Flat Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDevices.map(device => (
            <DeviceCard
              key={`${device.boardId}-${device.id}`}
              device={device}
              boardName={device.boardId || `GPIO ${device.pin}`}
              onToggle={(id, boardId) => toggle(id, boardId)}
              onDelete={(id, boardId) => handleDeleteDevice(id, boardId)}
              onEdit={openDeviceEditModal}
              isEditMode={isEditMode}
              onMoveForward={(id, boardId) => handleMoveCard(id, boardId, 'forward')}
              onMoveBackward={(id, boardId) => handleMoveCard(id, boardId, 'backward')}
            />
          ))}
        </div>
      )}

      {/* Universal Smart TV Remote Modal */}
      <AnimatePresence>
        {selectedTvForRemote && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg my-auto"
            >
              <UniversalSmartTvRemote 
                deviceId={selectedTvForRemote.id}
                deviceName={selectedTvForRemote.name}
                roomName={selectedTvForRemote.room}
                initialBrand={selectedTvForRemote.brand}
                onClose={() => setSelectedTvForRemote(null)}
              />
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* Add Device Modal */}
      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchControllers();
          useSmartHomeStore.getState().initBackendConnection();
        }}
      />

      {/* Edit ESP32 Node Modal */}
      {editingNode && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 bg-[#070d1a] sm:bg-black/90" dir="rtl">
          <div className="bg-[#0b101d] border-0 sm:border sm:border-indigo-500/30 sm:rounded-3xl w-full sm:max-w-md p-5 sm:p-6 space-y-4 shadow-2xl overflow-hidden h-full sm:h-auto flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-800 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Edit3 size={18} className="text-indigo-400" />
                  تعديل اسم متحكم ESP32
                </h3>
                <button onClick={() => setEditingNode(null)} className="p-1 text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">معرّف اللوحة: <span className="font-mono text-indigo-300">{editingNode.id}</span></p>

              <div className="mt-4">
                <label className="text-xs text-slate-300 font-bold block mb-1">اسم اللوحة الجديد:</label>
                <input
                  type="text"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500"
                  placeholder="مثال: المطبخ الرئيسي"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-800 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={handleSaveNodeName}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={16} />
                حفظ الاسم
              </button>
              <button
                onClick={() => setEditingNode(null)}
                className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Device Settings Modal */}
      {editingDevice && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 bg-[#070d1a] sm:bg-black/90" dir="rtl">
          <div 
            className="bg-[#0b101d] border-0 sm:border sm:border-cyan-500/30 sm:rounded-3xl w-full sm:max-w-md shadow-2xl flex flex-col overflow-hidden h-full sm:h-auto sm:max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-[#0b101d] shrink-0 pt-[max(0.875rem,env(safe-area-inset-top))]">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Edit3 size={17} className="text-[#00f0ff]" />
                تعديل بيانات وإعدادات الجهاز ✏️
              </h3>
              <button onClick={() => setEditingDevice(null)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto bg-[#0b101d] overscroll-contain">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">اسم الجهاز:</label>
                <input
                  type="text"
                  value={editDevName}
                  onChange={(e) => setEditDevName(e.target.value)}
                  placeholder="مثال: 4/1 سويج 1"
                  className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#00f0ff]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">مكان الجهاز / الغرفة:</label>
                <input
                  type="text"
                  value={editDevRoom}
                  onChange={(e) => setEditDevRoom(e.target.value)}
                  placeholder="مثال: المطبخ"
                  className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#00f0ff]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">نوع الجهاز والمهمة:</label>
                <select
                  value={editDevType.toUpperCase()}
                  onChange={(e) => setEditDevType(e.target.value)}
                  className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="LIGHT">💡 إنارة (Light)</option>
                  <option value="TV">📺 شاشة ذكية (Smart TV)</option>
                  <option value="RGB">🌈 إضاءة ملونة (RGB Strip)</option>
                  <option value="CURTAIN">🪟 ستائر ذكية (Smart Curtain)</option>
                  <option value="SOCKET">🔌 مقبس / فيشة (Socket/Relay)</option>
                  <option value="LOCK">🔒 قفل باب كهربائي (Electric Lock)</option>
                  <option value="CAMERA">📷 كاميرا مراقبة (IP Camera/DVR)</option>
                  <option value="PUMP">🌱 مضخة ري (Irrigation Pump)</option>
                  <option value="MOISTURE">💧 حساس رطوبة التربة (Soil Moisture)</option>
                  <option value="CLIMATE">❄️ تكييف (AC)</option>
                  <option value="ENERGY">⚡ مقياس كهرباء (Energy Meter)</option>
                  <option value="TEMPERATURE">🌡️ حساس حرارة ورطوبة (Temp & Hum)</option>
                  <option value="FAN">🌀 مروحة / تهوية (Fan)</option>
                  <option value="HEATER">♨️ سخان كهربائي (Water Heater)</option>
                  <option value="SIREN">🚨 صفارة إنذار (Alarm Siren)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">منفذ الريلاي (GPIO Out):</label>
                  <input
                    type="number"
                    value={editDevPin}
                    onChange={(e) => setEditDevPin(Number(e.target.value))}
                    className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-mono font-bold outline-none focus:border-[#00f0ff]"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">منفذ السويتش (Switch GPIO):</label>
                  <input
                    type="number"
                    value={editDevSwitchPin}
                    onChange={(e) => setEditDevSwitchPin(e.target.value)}
                    placeholder="مثال: 13"
                    className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-cyan-400 font-mono font-bold outline-none focus:border-[#00f0ff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">حالة التفعيل:</label>
                  <select
                    value={editDevActiveState}
                    onChange={(e) => setEditDevActiveState(e.target.value)}
                    className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-[#00f0ff] cursor-pointer"
                  >
                    <option value="HIGH">⚡ HIGH (3.3V)</option>
                    <option value="LOW">🔌 LOW (0V/GND)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">نمط السويتش:</label>
                  <select
                    value={editDevSwitchMode}
                    onChange={(e) => setEditDevSwitchMode(e.target.value)}
                    className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-[#00f0ff] cursor-pointer"
                  >
                    <option value="GND">🔻 GND</option>
                    <option value="VCC">🔺 VCC</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Fixed Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-[#0b101d] shrink-0 flex gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={handleSaveDeviceEdit}
                className="flex-1 bg-[#00f0ff] hover:bg-[#00d0f0] text-black font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Check size={16} />
                حفظ التعديلات
              </button>
              <button
                onClick={() => setEditingDevice(null)}
                className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
