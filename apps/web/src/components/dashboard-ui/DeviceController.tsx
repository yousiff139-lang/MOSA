"use client";

import { Device } from '@/types';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { 
  Lightbulb, Thermometer, Shield, Speaker, Play, Pause, SkipForward, SkipBack,
  Cloud, Wind, Droplets, Sun, Moon, Film, Home, Power, AlertTriangle, RefreshCw, Tv
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { SmartTVModal } from '../entertainment/SmartTVModal';

interface DeviceControllerProps {
  devices: Device[];
  onToggle: (id: number, boardId: string) => void;
}

export function DeviceController({ devices, onToggle }: DeviceControllerProps) {
  const activeCount = devices.filter(d => String(d.state) === 'ON' || String(d.state) === '1' || String(d.state) === 'true').length;
  
  const [activeTab, setActiveTab] = useState('الكل');
  
  const tabs = ['الكل', 'الإضاءة', 'المناخ', 'الأمان', 'الميديا'];
  const scenes = [
    { name: 'الصباح', icon: Sun },
    { name: 'سينما', icon: Film },
    { name: 'الليل', icon: Moon },
    { name: 'بعيد', icon: Home },
  ];

  const isMqttConnected = useSmartHomeStore(state => state.isMqttConnected);
  const socket = useSmartHomeStore(state => state.socket);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectStatus, setReconnectStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [weather, setWeather] = useState<any>(null);
  const [showTVModal, setShowTVModal] = useState(false);
  const [selectedTvId, setSelectedTvId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/weather', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => setWeather(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleStatus = (data: any) => {
      if (data.status === 'ONLINE' && reconnectStatus === 'loading') {
        setReconnectStatus('success');
        setTimeout(() => setReconnectStatus('idle'), 3000);
      }
    };
    
    socket.on('controller:status', handleStatus);
    return () => {
      socket.off('controller:status', handleStatus);
    };
  }, [socket, reconnectStatus]);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setReconnectStatus('loading');
    
    try {
      const controllerId = devices.find(d => d.boardId)?.boardId || 'default-esp32';
      await fetch(`/api/controllers/${controllerId}/ping`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Toast equivalent (simplified for this component)
      console.log('تم إرسال طلب إعادة الاتصال');
      
      setTimeout(() => {
        if (reconnectStatus === 'loading') {
          setReconnectStatus('error');
          setTimeout(() => setReconnectStatus('idle'), 5000);
        }
      }, 10000);
      
    } catch (e) {
      setReconnectStatus('error');
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6" dir="rtl">
      
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-white mb-2">المتحكم</h2>
          <p className="text-gray-400 font-medium text-sm">مرحباً بعودتك، {activeCount} أجهزة تعمل حالياً</p>
        </div>
        <div className="flex gap-3">
          {tabs.map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all border ${
                activeTab === tab 
                  ? 'bg-white/10 border-white/20 text-white shadow-lg' 
                  : 'bg-transparent border-white/5 text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ESP32 Disconnected Banner */}
      {!isMqttConnected && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-red-500 font-bold">المتحكم غير متصل (ESP32)</h3>
              <p className="text-red-400/80 text-sm">
                {reconnectStatus === 'error' ? 'لم يستجب المتحكم. تحقق من الطاقة' : 'انقطع الاتصال بالشبكة المحلية'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleReconnect}
            disabled={reconnectStatus === 'loading'}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={reconnectStatus === 'loading' ? 'animate-spin' : ''} />
            {reconnectStatus === 'loading' ? 'جاري الاتصال...' : reconnectStatus === 'success' ? 'تم الاتصال بنجاح ✓' : 'محاولة إعادة الاتصال'}
          </button>
        </div>
      )}

      {/* Scenes */}
      <div className="grid grid-cols-4 gap-4">
        {scenes.map(scene => (
          <button key={scene.name} className="flex flex-col items-center justify-center gap-3 bg-[#11151c] border border-white/5 hover:border-white/10 hover:bg-[#1a202c] transition-colors rounded-2xl py-5 group shadow-sm">
            <scene.icon size={22} className="text-gray-400 group-hover:text-white transition-colors" />
            <span className="text-white font-bold text-sm">{scene.name}</span>
          </button>
        ))}
      </div>

      {/* Grid of Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        
        {/* Weather Card (Purple Gradient) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-1 xl:col-span-2 bg-gradient-to-br from-violet-600 to-indigo-800 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl border border-white/10 flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-start z-10">
            <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors">
              <Cloud size={18} />
            </button>
            <div className="text-left" dir="ltr">
              <h3 className="text-6xl font-black drop-shadow-md">{weather ? Math.round(weather.temperature) : '28'}°</h3>
              <p className="text-xl font-bold mt-1 text-white/90">{weather ? weather.city : 'بغداد'}</p>
              <p className="text-sm text-white/70">{weather ? (weather.isDay ? 'نهاراً' : 'ليلاً') : 'غائم جزئياً'}</p>
            </div>
          </div>
          <div className="flex gap-3 z-10 mt-6" dir="ltr">
            <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2 flex items-center gap-2">
              <Droplets size={16} className="opacity-80" />
              <span className="font-bold">{weather ? weather.humidity : '20'}%</span>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2 flex items-center gap-2">
              <Wind size={16} className="opacity-80" />
              <span className="font-bold">{weather ? weather.wind_speed : '15'} km/h</span>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* Example Light Card */}
        <div className="bg-[#1a1f2b] rounded-[2rem] p-6 flex flex-col justify-between border border-white/5 relative shadow-md min-h-[220px] group hover:border-yellow-500/30 transition-all">
          <div className="flex justify-between items-start">
            <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <Power size={18} />
            </button>
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center">
              <Lightbulb size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg text-right">ثريا الصالة 1</h3>
            <p className="text-yellow-500 text-sm font-medium text-right mb-4">تعمل</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-bold">100%</span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full relative overflow-hidden">
                 <div className="absolute right-0 top-0 h-full bg-yellow-500 w-full rounded-full"></div>
              </div>
              <span className="text-xs text-gray-400 font-bold">سطوع</span>
            </div>
          </div>
        </div>

        {/* Security Card */}
        <div className="bg-[#1a1f2b] rounded-[2rem] p-6 flex flex-col justify-between border border-white/5 relative shadow-md min-h-[220px]">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
              <Shield size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg text-right">نظام الحماية</h3>
            <p className="text-red-400 text-sm font-medium text-right mb-4 flex items-center justify-end gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              النظام غير مؤمن
            </p>
            <button className="w-full bg-transparent border-2 border-white/10 hover:border-white/30 text-white font-bold py-3 rounded-xl transition-colors">
              تأمين المنزل
            </button>
          </div>
        </div>

        {/* Media Card */}
        <div className="bg-[#1a1f2b] rounded-[2rem] p-6 flex flex-col justify-between border border-white/5 relative shadow-md min-h-[220px]">
          <div className="flex justify-between items-start">
            <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <Power size={18} />
            </button>
            <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Speaker size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg text-right">مكبر الصوت الذكي</h3>
            <p className="text-gray-400 text-sm font-medium text-right mb-4">الصالة الرئيسية</p>
            <div className="flex justify-center items-center gap-4 mb-4">
               <button className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"><SkipForward size={16} fill="currentColor" className="text-white" /></button>
               <button className="w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors"><Play size={20} fill="currentColor" className="text-white ml-1" /></button>
               <button className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"><SkipBack size={16} fill="currentColor" className="text-white" /></button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-bold">40%</span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full relative overflow-hidden">
                 <div className="absolute right-0 top-0 h-full bg-purple-500 w-[40%] rounded-full"></div>
              </div>
              <span className="text-xs text-gray-400 font-bold">الصوت</span>
            </div>
          </div>
        </div>

        {/* Smart TV Card */}
        <div 
          onClick={() => {
            setSelectedTvId('1'); // Mock ID, you would map real TVs
            setShowTVModal(true);
          }}
          className="bg-[#1a1f2b] rounded-[2rem] p-6 flex flex-col justify-between border border-white/5 relative shadow-md min-h-[220px] cursor-pointer hover:border-blue-500/30 transition-all group"
        >
          <div className="flex justify-between items-start">
            <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <Power size={18} />
            </button>
            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <Tv size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg text-right">TCL Smart TV</h3>
            <p className="text-blue-400 text-sm font-medium text-right mb-4">غرفة المعيشة</p>
            <div className="flex items-center justify-between mt-6">
              <span className="text-xs bg-green-500/10 text-green-400 px-3 py-1 rounded-full border border-green-500/20">متصل (Online)</span>
              <span className="text-xs text-gray-400">اضغط لفتح الريموت</span>
            </div>
          </div>
        </div>

        {/* AC Card */}
        <div className="bg-[#1a1f2b] rounded-[2rem] p-6 flex flex-col justify-between border border-white/5 relative shadow-md min-h-[220px] group hover:border-cyan-500/30 transition-all">
          <div className="flex justify-between items-start">
            <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <Power size={18} />
            </button>
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Wind size={18} />
            </div>
          </div>
          <div className="text-right">
            <h3 className="text-white font-bold text-lg">مكيف الصالة</h3>
            <p className="text-cyan-400 text-sm font-medium mb-1">التبريد السريع</p>
            <div className="flex items-end justify-end gap-2 mb-4">
              <span className="text-5xl font-black text-white">24°</span>
            </div>
            <p className="text-xs text-gray-400 font-bold flex items-center justify-end gap-1">
               الحرارة الحالية: 25.5° <Thermometer size={12} />
            </p>
          </div>
        </div>

      </div>

      {/* Render Smart TV Modal */}
      {showTVModal && selectedTvId && (
        <SmartTVModal 
          deviceId={selectedTvId} 
          onClose={() => setShowTVModal(false)} 
        />
      )}
    </div>
  );
}
