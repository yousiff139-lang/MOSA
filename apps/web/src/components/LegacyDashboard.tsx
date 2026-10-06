"use client";
/* eslint-disable */
// @ts-nocheck

import { useMemo, useState, useEffect } from 'react';
import { Device } from '@/types';
import { DeviceCard } from '@/components/DeviceCard';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { useWeather } from '@/hooks/useWeather';
import { Cpu, Zap, Home, RefreshCw, CloudSun, CloudRain, Cloud, CloudLightning, Snowflake, Sun, Droplet, Plus, Moon, Sunrise, Navigation, BedDouble, CarFront, Coffee, Thermometer } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DashboardProps {
  devices: Device[];
  isConnected?: boolean;
  onToggle: (id: number, boardId: string) => void;
  onDelete: (id: number, boardId: string) => void;
  onRefresh: () => void;
  onAddClick: () => void;
  onUpdatePWM: (id: number, boardId: string, val: number) => void;
  onUpdateColor: (id: number, boardId: string, color: string) => void;
  onSetTimer: (id: number, boardId: string, mins: number) => void;
  onUpdateSchedule: (id: number, boardId: string, active: boolean, hOn: number, mOn: number, hOff: number, mOff: number) => void;
}

function SortableDeviceCard(props: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative h-full">
      <DeviceCard {...props.cardProps} isEditMode={props.isEditMode} dragListeners={props.isEditMode ? listeners : undefined} />
    </div>
  );
}

export function Dashboard({ devices, isConnected, onToggle, onDelete, onRefresh, onAddClick, onUpdatePWM, onUpdateColor, onSetTimer, onUpdateSchedule }: DashboardProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  
  const favoriteDeviceIds = useSmartHomeStore(state => state.favoriteDeviceIds || []);
  const toggleFavorite = useSmartHomeStore(state => state.toggleFavorite);
  const boards = useSmartHomeStore(state => state.boards);
  const boardStatus = useSmartHomeStore(state => state.boardStatus);
  const weather = useWeather();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
      setCurrentTime(now.toLocaleDateString('ar-EG', options));
    };
    updateTime();
  }, []);

  const rooms = useMemo(() => {
    return [...devices]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .reduce((acc: Record<string, Device[]>, dev) => {
        const board = dev.boardId ? boards[dev.boardId] : null;
        const r = board ? (board.name || board.id) : (dev.room || "عام");
        if (!acc[r]) acc[r] = [];
        acc[r].push(dev);
        return acc;
      }, {});
  }, [devices, boards]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      let activeRoom = '';
      for (const [roomName, roomDevs] of Object.entries(rooms)) {
        if (roomDevs.some(d => `${d.boardId}_${d.id}` === active.id)) {
          activeRoom = roomName;
          break;
        }
      }

      if (activeRoom) {
        const roomDevs = rooms[activeRoom];
        const oldIndex = roomDevs.findIndex(d => `${d.boardId}_${d.id}` === active.id);
        const newIndex = roomDevs.findIndex(d => `${d.boardId}_${d.id}` === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(roomDevs, oldIndex, newIndex);
          const updatePayload = reordered.map((dev, index) => ({
            id: dev.id,
            boardId: dev.boardId!,
            orderIndex: index
          }));
          useSmartHomeStore.getState().updateDeviceOrder(updatePayload);
        }
      }
    }
  };

  const activeCount = devices.filter(d => ((d.state as any) === 'ON' || (d.state as any) === 1 || (d.state as any) === true) && d.type !== 'sensor').length;
  const mainSensor = devices.find(d => d.type === 'sensor');
  const temp = mainSensor?.temperature || 24;
  const hum = mainSensor?.humidity || 45;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'صباح الخير';
    if (hour >= 12 && hour < 18) return 'مساء الخير';
    return 'طاب مساؤك';
  };

  const getWeatherIcon = (className = "text-yellow-400") => {
    if (!weather) return <CloudSun className={className} />;
    switch (weather.condition) {
      case 'clear': return <Sun className={className} />;
      case 'cloudy': return <Cloud className={className} />;
      case 'rain': return <CloudRain className={className} />;
      case 'snow': return <Snowflake className={className} />;
      case 'thunderstorm': return <CloudLightning className={className} />;
      default: return <CloudSun className={className} />;
    }
  };

  // Quick Actions / Scenes
  const executeScene = (type: string) => {
    if (type === 'off') {
      devices.forEach(d => {
        if (((d.state as any) === 'ON' || (d.state as any) === 1 || (d.state as any) === true) && d.type !== 'sensor' && d.boardId) {
          onToggle(d.id, d.boardId);
        }
      });
    } else if (type === 'on') {
      devices.forEach(d => {
        if (((d.state as any) === 'OFF' || (d.state as any) === 0 || (d.state as any) === false) && d.type !== 'sensor' && d.boardId) {
          onToggle(d.id, d.boardId);
        }
      });
    }
  };

  const sceneButtons = [
    { name: 'استيقاظ', icon: Sunrise, color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', action: () => executeScene('on') },
    { name: 'خروج', icon: Navigation, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', action: () => executeScene('off') },
    { name: 'نوم', icon: Moon, color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20', action: () => executeScene('off') },
  ];

  const getRoomIcon = (name: string) => {
    if (name.includes('نوم') || name.toLowerCase().includes('bed')) return <BedDouble size={18} />;
    if (name.includes('كراج') || name.toLowerCase().includes('garage')) return <CarFront size={18} />;
    if (name.includes('مطبخ') || name.toLowerCase().includes('kitchen')) return <Coffee size={18} />;
    return <Home size={18} />;
  };

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] animate-fade-up">
        <div className="w-32 h-32 bg-white/5 rounded-[40px] border border-white/10 flex items-center justify-center mb-8 shadow-2xl backdrop-blur-xl glow-primary">
          <Cpu size={48} className="text-primary animate-pulse" />
        </div>
        <h3 className="text-3xl font-black text-white mb-4">النظام فارغ</h3>
        <p className="text-gray-400 mb-10 text-center max-w-sm">لم يتم العثور على أجهزة متصلة بعد، ابدأ بدمج منزلك نحو المستقبل الآن.</p>
        <button onClick={onAddClick} className="bg-primary hover:bg-blue-600 text-white font-bold py-4 px-10 rounded-2xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(var(--color-primary),0.4)]">
          <Plus size={20} /> إضافة جهاز جديد
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-up pb-24">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-white/10 to-transparent border border-white/5 shadow-2xl backdrop-blur-xl p-8 md:p-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-[24px] bg-white/10 border border-white/20 flex items-center justify-center shadow-lg backdrop-blur-md">
              <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Mosa&backgroundColor=transparent" alt="User" className="w-16 h-16" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
                {getGreeting()}
              </h1>
              <p className="text-gray-400 font-medium text-lg flex items-center gap-2">
                {currentTime} 
                <span className="w-1.5 h-1.5 bg-gray-600 rounded-full mx-2"></span> 
                {activeCount} أجهزة قيد التشغيل
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-black/20 border border-white/5 backdrop-blur-md">
              <Thermometer className="text-yellow-400" size={24} />
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">داخلي</p>
                <p className="text-lg font-black text-white leading-none">{temp}°</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-black/20 border border-white/5 backdrop-blur-md">
              <Droplet className="text-teal-400" size={24} />
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">رطوبة</p>
                <p className="text-lg font-black text-white leading-none">{hum}%</p>
              </div>
            </div>
            {weather && (
              <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-black/20 border border-white/5 backdrop-blur-md">
                {getWeatherIcon("text-blue-400")}
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">خارجي</p>
                  <p className="text-lg font-black text-white leading-none">{weather.temp}°</p>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => setIsEditMode(!isEditMode)} 
              className={`px-5 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg backdrop-blur-md flex items-center gap-2 ${isEditMode ? 'bg-red-500 text-white shadow-red-500/25 border-none' : 'bg-blue-600/30 text-blue-200 border border-blue-500/30 hover:bg-blue-600 hover:text-white'}`}
            >
              {isEditMode ? 'إنهاء التعديل والترتيب ✕' : '⚙️ تعديل وترتيب الواجهة'}
            </button>
          </div>
        </div>
      </section>

      {/* 2. QUICK SCENES */}
      <section className="grid grid-cols-3 gap-4">
        {sceneButtons.map((scene, idx) => (
          <button 
            key={idx}
            onClick={scene.action}
            className={`flex flex-col items-center justify-center p-6 rounded-[24px] border backdrop-blur-md transition-all hover:scale-[1.02] active:scale-[0.98] ${scene.color}`}
          >
            <scene.icon size={32} className="mb-3 drop-shadow-md" />
            <span className="font-bold text-sm text-white">{scene.name}</span>
          </button>
        ))}
      </section>

      {/* 3. ROOMS NAVIGATION */}
      <section>
        <div className="flex items-center gap-3 overflow-x-auto pb-4 pt-2 scrollbar-hide snap-x">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-full font-bold transition-all whitespace-nowrap snap-center border ${
              activeTab === 'all' 
                ? 'bg-white text-gray-900 border-transparent shadow-[0_0_20px_rgba(255,255,255,0.3)]' 
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Home size={18} className={activeTab === 'all' ? "text-primary" : ""} />
            المنزل بالكامل
          </button>
          
          {Object.keys(rooms).map(roomName => {
            const isActive = activeTab === roomName;
            return (
              <button
                key={roomName}
                onClick={() => setActiveTab(roomName)}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-full font-bold transition-all whitespace-nowrap snap-center border ${
                  isActive 
                    ? 'bg-white text-gray-900 border-transparent shadow-[0_0_20px_rgba(255,255,255,0.3)]' 
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className={isActive ? "text-primary" : "text-gray-500"}>
                  {getRoomIcon(roomName)}
                </div>
                {roomName}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. DEVICES GRID */}
      <section>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="space-y-12">
            {Object.entries(rooms)
              .filter(([name]) => activeTab === 'all' || activeTab === name)
              .map(([name, devs]) => (
              <div key={name} className="space-y-6">
                
                {/* Room Header */}
                <div className="flex justify-between items-end border-b border-white/10 pb-4 px-2">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
                      {name}
                      {devs[0]?.boardId && (
                         <span className={`w-2.5 h-2.5 rounded-full shadow-lg ${boardStatus[devs[0].boardId] ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'}`} title={boardStatus[devs[0].boardId] ? 'متصل' : 'مفصول'}></span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500 font-medium">
                      {devs.filter(d => d.state === 'ON' || (d.state as any) === 1 || (d.state as any) === true).length} مفعل من أصل {devs.length}
                    </p>
                  </div>
                </div>

                {/* Device Cards Grid */}
                <SortableContext items={devs.map(d => `${d.boardId}_${d.id}`)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {devs.map(d => {
                      const devId = `${d.boardId}_${d.id}`;
          const handleMoveCard = (id: number, boardId: string, direction: 'forward' | 'backward') => {
            const sortedDevs = [...devices].sort((a, b) => (a.order || 0) - (b.order || 0));
            const index = sortedDevs.findIndex(d => d.id === id && d.boardId === boardId);
            if (index === -1) return;

            const targetIndex = direction === 'forward' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= sortedDevs.length) return;

            const reordered = arrayMove(sortedDevs, index, targetIndex);
            const updatePayload = reordered.map((dev, idx) => ({
              id: dev.id,
              boardId: dev.boardId!,
              orderIndex: idx
            }));
            useSmartHomeStore.getState().updateDeviceOrder(updatePayload);
          };

          return (
            <SortableDeviceCard
              key={devId}
              id={devId}
              isEditMode={isEditMode}
              cardProps={{
                device: d,
                boardName: name,
                onToggle,
                onDelete,
                onUpdatePWM,
                onUpdateColor,
                onSetTimer,
                onUpdateSchedule,
                isFavorite: favoriteDeviceIds.includes(`${d.boardId}-${d.id}`),
                onToggleFavorite: toggleFavorite,
                onMoveForward: (id: number, boardId: string) => handleMoveCard(id, boardId, 'forward'),
                onMoveBackward: (id: number, boardId: string) => handleMoveCard(id, boardId, 'backward')
              }}
            />
          );
                    })}
                  </div>
                </SortableContext>
                
              </div>
            ))}
          </div>
        </DndContext>
      </section>

    </div>
  );
}
