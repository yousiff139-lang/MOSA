import { useMemo } from 'react';
import { Device } from '../types';
import { useSmartHomeStore } from '../store/useSmartHomeStore';
import { Power, Thermometer, Fan, Plug, Lightbulb, Map } from 'lucide-react';
import { playClickSound, playHapticFeedback } from '../utils/audio';

interface FloorPlanProps {
  devices: Device[];
  onToggle: (id: number, boardId: string) => void;
}

export function FloorPlan({ devices, onToggle }: FloorPlanProps) {
  const boards = useSmartHomeStore(state => state.boards);
  
  // Group devices by room
  const rooms = useMemo(() => {
    return devices.reduce((acc: Record<string, Device[]>, dev) => {
      const board = dev.boardId ? boards[dev.boardId] : null;
      const r = board ? (board.name || board.id) : (dev.room || "عام");
      if (!acc[r]) acc[r] = [];
      acc[r].push(dev);
      return acc;
    }, {});
  }, [devices, boards]);

  const handleToggle = (id: number, boardId: string) => {
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    const hapticsEnabled = localStorage.getItem('hapticsEnabled') !== 'false';
    playClickSound(soundEnabled);
    playHapticFeedback(hapticsEnabled);
    onToggle(id, boardId);
  };

  const getDeviceIcon = (device: Device) => {
    const isOn = device.state === 'ON' || device.state === 1 || device.state === true;
    if (device.type === 'sensor') return <Thermometer size={16} className="text-primary" />;
    if (device.type === 'fan') return <Fan size={16} className={isOn ? 'text-primary animate-spin' : 'text-gray-500'} />;
    if (device.type === 'socket') return <Plug size={16} className={isOn ? 'text-emerald-500' : 'text-gray-500'} />;
    if (device.type === 'cooling') return <Thermometer size={16} className={isOn ? 'text-cyan-400' : 'text-gray-500'} />;
    return <Lightbulb size={16} className={isOn ? 'text-yellow-400' : 'text-gray-500'} />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-up">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-white/10 pb-6 gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white drop-shadow-md mb-2 flex items-center gap-3">
            <Map className="text-primary" size={32} /> الخريطة التفاعلية
          </h2>
          <p className="text-sm text-gray-500">تحكم بأجهزتك من خلال مخطط المنزل المباشر</p>
        </div>
      </header>

      <div className="glass-panel p-6 rounded-3xl shadow-xl min-h-[600px] bg-black/5 dark:bg-[#06090f]/50 border border-white/10">
        {Object.keys(rooms).length === 0 ? (
          <div className="flex items-center justify-center h-full opacity-50">
            <p>لا توجد غرف أو أجهزة لعرضها على الخريطة.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
            {Object.entries(rooms).map(([roomName, roomDevices], index) => {
              // Calculate if any light is on in the room
              const isRoomLit = roomDevices.some(d => d.type !== 'sensor' && (d.state === 'ON' || d.state === 1 || d.state === true));
              
              return (
                <div 
                  key={roomName} 
                  className={`relative overflow-hidden rounded-2xl border transition-all duration-700 min-h-[200px] p-6 flex flex-col shadow-lg
                    ${isRoomLit ? 'bg-primary/5 border-primary/30 shadow-[0_0_30px_rgba(var(--color-primary),0.1)]' : 'bg-black/10 dark:bg-white/5 border-white/10'}`}
                >
                  {/* Decorative background glow for lit rooms */}
                  {isRoomLit && (
                     <div className="absolute inset-0 bg-yellow-400/5 dark:bg-yellow-400/10 rounded-2xl blur-xl pointer-events-none transition-opacity duration-1000"></div>
                  )}

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 z-10 border-b border-white/10 pb-2">{roomName}</h3>
                  
                  <div className="flex flex-wrap gap-4 z-10 mt-auto">
                    {roomDevices.map(device => {
                      const isOn = device.state === 'ON' || device.state === 1 || device.state === true;
                      const isSensor = device.type === 'sensor';
                      
                      return (
                        <div 
                          key={device.id} 
                          onClick={() => {
                            if (!isSensor && device.boardId) {
                               handleToggle(device.id, device.boardId);
                            }
                          }}
                          className={`
                            flex items-center gap-2 p-3 rounded-xl transition-all cursor-pointer border shadow-sm backdrop-blur-md
                            ${isSensor ? 'bg-white/10 border-white/20 cursor-default' : 
                              isOn ? 'bg-primary border-primary shadow-[0_0_15px_rgba(var(--color-primary),0.5)] text-white scale-105' : 'bg-black/20 border-white/10 hover:bg-white/10'}
                          `}
                          title={device.name}
                        >
                          <div className={!isSensor && isOn ? 'text-white' : ''}>
                             {getDeviceIcon(device)}
                          </div>
                          
                          {isSensor ? (
                            <span className="text-xs font-bold text-gray-800 dark:text-white">
                              {device.temperature}°C
                            </span>
                          ) : (
                            <span className={`text-xs font-bold ${isOn ? 'text-white' : 'text-gray-400'}`}>
                              {device.name.substring(0, 10)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
