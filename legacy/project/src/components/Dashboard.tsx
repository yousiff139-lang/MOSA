import { useMemo, useState, useEffect } from 'react';
import { Device } from '../types';
import { DeviceCard } from './DeviceCard';
import { useSmartHomeStore } from '../store/useSmartHomeStore';
import { useWeather } from '../hooks/useWeather';
import { Cpu, Zap, Home, ShieldCheck, RefreshCw, CloudSun, CloudRain, Cloud, CloudLightning, Snowflake, Sun, Droplet, Plus, ArrowUpRight, ArrowDownRight, User, Star } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

const initialChartData = [
  { time: '00:00', usage: 10 },
  { time: '04:00', usage: 15 },
  { time: '08:00', usage: 45 },
  { time: '12:00', usage: 30 },
  { time: '16:00', usage: 50 },
  { time: '20:00', usage: 70 },
  { time: '23:59', usage: 65 },
];

function SortableDeviceCard(props: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      <DeviceCard {...props.cardProps} isEditMode={props.isEditMode} dragListeners={props.isEditMode ? listeners : undefined} />
    </div>
  );
}

export function Dashboard({ devices, isConnected, onToggle, onDelete, onRefresh, onAddClick, onUpdatePWM, onUpdateColor, onSetTimer, onUpdateSchedule }: DashboardProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [powerData, setPowerData] = useState(initialChartData);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const updateDeviceOrder = useSmartHomeStore(state => state.updateDeviceOrder);
  const favoriteDeviceIds = useSmartHomeStore(state => state.favoriteDeviceIds || []);
  const toggleFavorite = useSmartHomeStore(state => state.toggleFavorite);
  const weather = useWeather();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
      setCurrentTime(now.toLocaleDateString('ar-EG', options));
    };
    updateTime();
  }, []);

  const boards = useSmartHomeStore(state => state.boards);
  const boardStatus = useSmartHomeStore(state => state.boardStatus);

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
          
          // Using the store directly since updateDeviceOrder was refactored
          useSmartHomeStore.getState().updateDeviceOrder(updatePayload);
        }
      }
    }
  };

  const activeCount = devices.filter(d => d.state === 'ON').length;

  const mainSensor = devices.find(d => d.type === 'sensor');
  const temp = mainSensor?.temperature || 24;
  const hum = mainSensor?.humidity || 45;
  const power = mainSensor?.powerUsage || 0;

  const favoriteDevices = useMemo(() => {
    return devices.filter(d => favoriteDeviceIds.includes(`${d.boardId}-${d.id}`));
  }, [devices, favoriteDeviceIds]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'صباح الخير';
    if (hour >= 12 && hour < 18) return 'مساء الخير';
    return 'طاب مساؤك';
  };

  const getSubGreeting = () => {
    let msg = `الأجواء `;
    if (weather) {
      if (weather.temp < 20) msg += `باردة بالخارج (${weather.temp}°C).`;
      else if (weather.temp > 30) msg += `حارة بالخارج (${weather.temp}°C).`;
      else msg += `معتدلة (${weather.temp}°C).`;
    } else {
       msg += `مستقرة داخلياً (${temp}°C).`;
    }

    if (activeCount > 0) msg += ` لديك ${activeCount} أجهزة نشطة.`;
    else msg += ` جميع الأجهزة متوقفة.`;
    return msg;
  };

  const getWeatherIcon = () => {
    if (!weather) return <CloudSun size={16} className="text-gray-400" />;
    switch (weather.condition) {
      case 'clear': return <Sun size={16} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />;
      case 'cloudy': return <Cloud size={16} className="text-gray-400 drop-shadow-[0_0_8px_rgba(156,163,175,0.8)]" />;
      case 'rain': return <CloudRain size={16} className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]" />;
      case 'snow': return <Snowflake size={16} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />;
      case 'thunderstorm': return <CloudLightning size={16} className="text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]" />;
      default: return <CloudSun size={16} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />;
    }
  };

  useEffect(() => {
    if (power > 0) {
      setPowerData(prev => {
        const newData = [...prev.slice(1), { time: currentTime.split(',')[0], usage: power }];
        return newData;
      });
    }
  }, [power, currentTime]);

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-fade-up">
      <div className="glass-panel rounded-3xl p-6 md:p-8 relative overflow-hidden border border-white/10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-blue-500/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center shadow-lg overflow-hidden">
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=Mosa&backgroundColor=transparent`} alt="Avatar" className="w-12 h-12 object-contain" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white drop-shadow-md tracking-tight">
                {getGreeting()}، <span className="text-primary">سيدي</span> 👋
              </h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 font-medium">
                {getSubGreeting()}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3" dir="ltr">
          <div className="flex items-center gap-2 glass-panel rounded-full px-4 py-2 shadow-sm border-orange-500/30 glow-orange">
            <Zap size={16} className="text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            <span key={power} className="text-xs font-bold text-gray-800 dark:text-white animate-fade-up flex items-center gap-1">
              {power}W
              {power > 50 ? <ArrowUpRight size={12} className="text-red-400" /> : <ArrowDownRight size={12} className="text-emerald-400" />}
            </span>
          </div>
          <div className="flex items-center gap-2 glass-panel rounded-full px-4 py-2 shadow-sm border-teal-500/30 glow-green">
            <Droplet size={16} className="text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
            <span className="text-xs font-bold text-gray-800 dark:text-white">{hum}%</span>
          </div>
          <div className="flex items-center gap-2 glass-panel rounded-full px-4 py-2 shadow-sm border-yellow-500/30 glow-yellow" title="حرارة الغرفة (داخلي)">
            <Home size={16} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
            <span className="text-xs font-bold text-gray-800 dark:text-white">{temp}°C</span>
          </div>
          
          {/* Weather Widget */}
          {weather && (
            <div className="flex items-center gap-2 glass-panel rounded-full px-4 py-2 shadow-sm border-blue-500/30 glow-blue" title="الطقس الخارجي">
              {getWeatherIcon()}
              <span className="text-xs font-bold text-gray-800 dark:text-white">{weather.temp}°C</span>
            </div>
          )}

          <button onClick={() => setIsEditMode(!isEditMode)} className={`w-auto px-4 h-10 rounded-full glass-panel flex items-center justify-center transition-colors shadow-sm border border-white/20 hover:scale-105 font-bold text-xs gap-2 ${isEditMode ? 'bg-red-500 text-white border-red-500 glow-orange' : 'text-gray-800 dark:text-gray-300 hover:bg-white/10'}`}>
            {isEditMode ? "✅ تم" : "✏️ تعديل"}
          </button>

          <button onClick={onRefresh} className="w-10 h-10 rounded-full glass-panel flex items-center justify-center hover:bg-white/10 transition-colors shadow-sm border-white/20 hover:scale-110 flex-shrink-0">
            <RefreshCw size={16} className="text-gray-800 dark:text-gray-300" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { n: "الأجهزة النشطة", v: activeCount, i: Zap, c: "text-orange-400 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" },
          { n: "إجمالي الأجهزة", v: devices.length, i: Cpu, c: "text-blue-400 drop-shadow-[0_0_5px_rgba(var(--color-primary),0.8)]" },
          { n: "الغرف", v: Object.keys(rooms).length, i: Home, c: "text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]" },
          { n: "حماية النظام", v: "100%", i: ShieldCheck, c: "text-blue-400 drop-shadow-[0_0_5px_rgba(var(--color-primary),0.8)]" }
        ].map((stat, idx) => (
          <div key={idx} className="glass-panel rounded-3xl p-6 flex flex-col justify-between h-32 relative overflow-hidden group hover:border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
            <div className="flex justify-between items-start">
              <span key={stat.v} className="text-3xl font-bold text-gray-900 dark:text-white drop-shadow-sm animate-fade-up">{stat.v}</span>
              <div className="p-2.5 bg-black/20 rounded-xl group-hover:scale-110 transition-transform">
                <stat.i size={20} className={stat.c} />
              </div>
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400 font-bold">{stat.n}</span>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-3xl p-6 shadow-xl">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-6 drop-shadow-sm">استهلاك الطاقة المباشر (واط)</h3>
        <div className="h-48 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={powerData}>
              <defs>
                <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
              <Area type="monotone" dataKey="usage" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsage)" activeDot={{ r: 8, className: 'animate-pulse' }} dot={{ r: 3, fill: '#06090f', stroke: '#3b82f6', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {devices.length === 0 ? (
        !isConnected ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 md:h-40 rounded-3xl skeleton-bg glass-panel opacity-50 border border-white/5"></div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-up">
            <div className="w-24 h-24 bg-white dark:bg-[#101728] rounded-3xl border border-gray-200 dark:border-[#1a2235] flex items-center justify-center mb-6 shadow-xl">
              <Cpu size={40} className="text-gray-400 dark:text-gray-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">لا توجد أجهزة</h3>
            <p className="text-gray-500 text-sm mb-8 font-medium">ابدأ بإضافة جهازك الأول للتحكم في منزلك الذكي</p>
            <button onClick={onAddClick} className="bg-blue-600 hover:bg-primary text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-colors shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:scale-105 active:scale-95">
              <Plus size={18} /> إضافة جهاز
            </button>
          </div>
        )
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="space-y-6 animate-fade-up">
            
            {/* Favorites Section */}
            {favoriteDevices.length > 0 && activeTab === 'all' && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-yellow-500/20 rounded-xl">
                    <Star size={20} className="text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.8)]" fill="currentColor" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white drop-shadow-sm">المفضلة</h3>
                </div>
                <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x">
                  {favoriteDevices.map(d => {
                    const board = d.boardId ? boards[d.boardId] : null;
                    const bName = board ? (board.name || board.id) : undefined;
                    return (
                      <div key={`fav-${d.boardId}-${d.id}`} className="min-w-[280px] w-[280px] snap-center">
                        <DeviceCard
                          device={d}
                          boardName={bName}
                          onToggle={onToggle}
                          onDelete={onDelete}
                          onUpdatePWM={onUpdatePWM}
                          onUpdateColor={onUpdateColor}
                          onSetTimer={onSetTimer}
                          onUpdateSchedule={onUpdateSchedule}
                          isFavorite={true}
                          onToggleFavorite={toggleFavorite}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rooms Tab Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                  activeTab === 'all' 
                    ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                الكل
              </button>
              {Object.keys(rooms).map(roomName => (
                <button
                  key={roomName}
                  onClick={() => setActiveTab(roomName)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                    activeTab === roomName 
                      ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {roomName}
                </button>
              ))}
            </div>

            {Object.entries(rooms)
              .filter(([name]) => activeTab === 'all' || activeTab === name)
              .map(([name, devs]) => (
              <div key={name} className="space-y-5">
                <div className="flex justify-between items-end border-b border-gray-200 dark:border-[#1a2235] pb-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                      {name}
                      {devs[0]?.boardId && (
                         <span className={`w-2.5 h-2.5 rounded-full ${boardStatus[devs[0].boardId] ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`} title={boardStatus[devs[0].boardId] ? 'متصل' : 'غير متصل'}></span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">{devs.filter(d => d.state === 'ON').length} من {devs.length} نشط</p>
                  </div>
                </div>

                <SortableContext items={devs.map(d => `${d.boardId}_${d.id}`)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {devs.map(d => {
                      const devId = `${d.boardId}_${d.id}`;
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
                            onToggleFavorite: toggleFavorite
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
      )}
    </div>
  );
}
