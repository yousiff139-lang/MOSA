import { useState, useRef } from 'react';
import { Device } from '../types';
import { Power, Trash2, Thermometer, Fan, Plug, Lightbulb, Clock, GripHorizontal, Star } from 'lucide-react';

interface DeviceCardProps {
  device: Device;
  boardName?: string;
  onToggle: (id: number, boardId: string) => void;
  onDelete: (id: number, boardId: string) => void;
  onUpdatePWM?: (id: number, boardId: string, val: number) => void;
  onUpdateColor?: (id: number, boardId: string, color: string) => void;
  onSetTimer?: (id: number, boardId: string, mins: number) => void;
  onUpdateSchedule?: (id: number, boardId: string, active: boolean, hOn: number, mOn: number, hOff: number, mOff: number) => void;
  isEditMode?: boolean;
  dragListeners?: any;
  isFavorite?: boolean;
  onToggleFavorite?: (boardId: string, id: number) => void;
}

export function DeviceCard({ device, boardName, onToggle, onDelete, onUpdatePWM, onUpdateColor, onSetTimer, onUpdateSchedule, isEditMode, dragListeners, isFavorite, onToggleFavorite }: DeviceCardProps) {
  const [showTimer, setShowTimer] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [timerMins, setTimerMins] = useState(30);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const isSensor = device.type === 'sensor';
  const isOn = device.state === 'ON' || (device.state as any) === true;

  // Local state for schedule form
  const [schOnTime, setSchOnTime] = useState(`${device.scheduleHourOn !== -1 ? String(device.scheduleHourOn).padStart(2,'0') : '00'}:${device.scheduleMinuteOn !== -1 ? String(device.scheduleMinuteOn).padStart(2,'0') : '00'}`);
  const [schOffTime, setSchOffTime] = useState(`${device.scheduleHourOff !== -1 ? String(device.scheduleHourOff).padStart(2,'0') : '00'}:${device.scheduleMinuteOff !== -1 ? String(device.scheduleMinuteOff).padStart(2,'0') : '00'}`);

  const handleSaveSchedule = (active: boolean) => {
    if (!onUpdateSchedule) return;
    const [hOn, mOn] = schOnTime.split(':').map(Number);
    const [hOff, mOff] = schOffTime.split(':').map(Number);
    onUpdateSchedule(device.id, device.boardId || '', active, hOn, mOn, hOff, mOff);
    setShowSchedule(false);
  };

  // Determine Glow based on device type
  const glowClass = isOn ? 
    (device.type === 'cooling' ? 'glow-cyan' : 
     device.type === 'light' ? 'glow-yellow' : 
     device.type === 'socket' ? 'glow-green' : 'glow-blue') 
    : 'border-white/5 dark:border-white/5 shadow-xl hover:border-white/20';

  // Breathing animation mapping
  const breathingClass = isOn ?
    (device.type === 'light' ? 'animate-breathing-yellow' :
     device.type === 'socket' ? 'animate-breathing-green' :
     device.type === 'cooling' ? 'animate-breathing-cyan' : '') : '';

  // 3D Tilt effect handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  };

  // Ripple effect handler
  const createRipple = (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
    const button = event.currentTarget;
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    const rect = button.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.classList.add("ripple-span");

    const existingRipple = button.getElementsByClassName("ripple-span")[0];
    if (existingRipple) {
      existingRipple.remove();
    }
    button.appendChild(circle);
  };

  // Dynamic Thermometer color
  const getTempColor = () => {
    const t = device.temperature || 24;
    if (t < 22) return 'text-primary';
    if (t >= 22 && t < 28) return 'text-emerald-500';
    return 'text-red-500';
  };

  return (
    <div 
      className={`glass-panel transition-all duration-300 rounded-3xl p-5 relative group flex flex-col h-full tilt-card ${glowClass}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Edit Mode Overlay */}
      {isEditMode && (
        <>
          {showConfirmDelete ? (
            <div className="absolute inset-0 bg-red-500/90 backdrop-blur-md z-40 rounded-3xl flex flex-col items-center justify-center p-4 animate-fade-in pointer-events-auto">
              <p className="text-white font-bold text-sm mb-4 text-center">متأكد من الحذف؟</p>
              <div className="flex gap-3">
                <button 
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowConfirmDelete(false); }}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowConfirmDelete(false); onDelete(device.id, device.boardId || ''); }}
                  className="px-4 py-2 bg-white text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors shadow-lg"
                >
                  تأكيد
                </button>
              </div>
            </div>
          ) : (
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-30 pointer-events-none">
              <button 
                onPointerDown={(e) => e.stopPropagation()} 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowConfirmDelete(true); }} 
                className="p-2 bg-red-500/20 text-red-500 rounded-xl transition-all hover:bg-red-500 hover:text-white shadow-md border border-red-500/30 hover:scale-110 pointer-events-auto backdrop-blur-md"
              >
                <Trash2 size={18} />
              </button>

              <div 
                {...dragListeners}
                className="p-2 bg-black/20 dark:bg-white/10 text-gray-500 dark:text-gray-300 rounded-xl cursor-move touch-none transition-colors hover:bg-white/20 hover:text-white pointer-events-auto backdrop-blur-md shadow-md border border-white/10"
              >
                <GripHorizontal size={18} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex justify-between items-start mb-6">
        {isSensor ? (
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all bg-black/5 dark:bg-white/5 shadow-inner">
            <Thermometer size={28} className={getTempColor()} />
          </div>
        ) : (
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isOn ? 'bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'bg-black/10 dark:bg-black/20'}`}>
            {device.type === 'fan' ? (
              <Fan size={28} className={isOn ? `text-primary drop-shadow-[0_0_8px_rgba(var(--color-primary),0.8)] animate-spin` : 'text-gray-500'} style={{ animationDuration: isOn ? `${3 - ((device.pwmValue || 255) / 255) * 2.5}s` : '' }} />
            ) : device.type === 'socket' ? (
              <Plug size={28} className={isOn ? `text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] ${breathingClass}` : 'text-gray-500'} />
            ) : device.type === 'cooling' ? (
              <Thermometer size={28} className={isOn ? `text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] ${breathingClass}` : 'text-gray-500'} />
            ) : (
              <Lightbulb size={28} className={isOn ? `text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)] ${breathingClass}` : 'text-gray-500'} />
            )}
          </div>
        )}

        {isSensor ? (
          <div className="px-3 py-1 bg-black/5 dark:bg-[#1a2235] rounded-xl border border-gray-200 dark:border-[#2a3c5a] shadow-inner">
            <span className={`text-sm font-bold ${getTempColor()}`}>{device.temperature || '--'}°C / {device.humidity || '--'}%</span>
          </div>
        ) : (
          <div 
            onPointerDown={(e) => {
              createRipple(e);
              if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
              isLongPress.current = false;
              timerRef.current = setTimeout(() => {
                isLongPress.current = true;
                if (device.type === 'cooling') {
                  if (window.confirm('هل تريد تخطي حماية الكمبريسور (3 دقائق) وتشغيل الجهاز فوراً؟')) {
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Heavy haptic
                    onToggle(device.id, device.boardId || '');
                  }
                }
              }, 3000);
            }}
            onPointerUp={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              if (!isLongPress.current) {
                setTimeout(() => onToggle(device.id, device.boardId || ''), 100);
              }
            }}
            onPointerLeave={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
            }}
            className={`ripple-container w-16 h-8 rounded-full p-1 cursor-pointer transition-all duration-300 flex items-center relative shadow-inner border overflow-hidden ${isOn ? 'bg-blue-600 border-primary shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-black/10 dark:bg-black/40 border-white/10 dark:border-white/10 hover:bg-black/20'}`}
          >
            <div className={`w-6 h-6 bg-white rounded-full shadow-md pointer-events-none transition-all duration-300 absolute ${isOn ? 'right-1' : 'left-1'}`}></div>
          </div>
        )}
      </div>
      
      <div className="flex flex-col items-start flex-grow">
        <div className="flex items-center justify-between w-full mb-1">
          <h4 className="text-white font-bold text-lg drop-shadow-md">{device.name}</h4>
          {onToggleFavorite && (
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(device.boardId || '', device.id); }}
              className={`p-1.5 rounded-full transition-all ${isFavorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-yellow-400 hover:bg-white/5'}`}
            >
              <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          )}
        </div>
        {boardName && (
          <span className="text-[10px] text-gray-400 font-bold mb-2 bg-black/20 px-2 py-0.5 rounded-full border border-white/5">{boardName}</span>
        )}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`text-[10px] px-2 py-1 rounded-md border flex items-center gap-1 font-bold ${isOn ? 'bg-primary/20 border-primary/30 text-blue-300' : 'bg-black/30 border-white/10 text-gray-400'}`}>
            {!isSensor && <Power size={10} className={isOn ? 'text-blue-400' : 'text-gray-500'} /> }
            {isSensor ? 'مستشعر' : isOn ? 'نشط' : 'متوقف'}
          </span>
          <span className="text-[10px] text-gray-400 px-2 py-1 rounded-md bg-black/30 border border-white/10 font-bold">GPIO {device.pin}</span>
        </div>
      </div>

      {/* Advanced Controls for Lights/Fans */}
      {!isSensor && (device.type === 'light' || device.type === 'fan') && isOn && onUpdatePWM && (
        <div className="mt-2 pt-4 border-t border-gray-100 dark:border-[#1a2235] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500">{device.type === 'fan' ? 'السرعة' : 'السطوع'}</span>
            <span className="text-[10px] font-bold text-primary">{Math.round(((device.pwmValue || 255) / 255) * 100)}%</span>
          </div>
          <input 
            type="range" 
            min="0" max="255" 
            value={device.pwmValue ?? 255} 
            onChange={(e) => {
              if (navigator.vibrate) navigator.vibrate(10); // Light haptic on slide
              onUpdatePWM(device.id, device.boardId || '', Number(e.target.value))
            }}
            className="ios-slider"
            style={{
              background: `linear-gradient(to left, ${device.type === 'fan' ? '#3b82f6' : '#eab308'} ${((device.pwmValue ?? 255) / 255) * 100}%, rgba(255,255,255,0.1) ${((device.pwmValue ?? 255) / 255) * 100}%)`
            }}
          />
          
          {device.type === 'light' && onUpdateColor && (
            <div className="flex items-center gap-2 mt-2">
               <span className="text-[10px] font-bold text-gray-500">اللون:</span>
               <input 
                 type="color" 
                 value={device.color || "#ffffff"} 
                 onChange={(e) => onUpdateColor(device.id, device.boardId || '', e.target.value)}
                 className="w-6 h-6 p-0 border-0 rounded cursor-pointer bg-transparent"
               />
            </div>
          )}
        </div>
      )}

      {/* Timer Control */}
      {!isSensor && isOn && onSetTimer && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#1a2235]">
          {showTimer ? (
             <div className="flex items-center gap-2">
               <input 
                 type="number" 
                 min="1" max="120"
                 value={timerMins}
                 onChange={(e) => setTimerMins(Number(e.target.value))}
                 className="w-16 p-1 text-xs bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-[#1a2235] rounded text-gray-900 dark:text-white"
               />
               <span className="text-xs text-gray-500">دقيقة</span>
               <button onClick={() => { onSetTimer(device.id, device.boardId || '', timerMins); setShowTimer(false); }} className="text-xs bg-primary text-white px-2 py-1 rounded">تعيين</button>
               <button onClick={() => setShowTimer(false)} className="text-xs text-gray-400">إلغاء</button>
             </div>
          ) : (
            <button onClick={() => setShowTimer(true)} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-primary transition-colors">
              <Clock size={12} /> جدولة إطفاء
            </button>
          )}
        </div>
      )}

      {/* Daily Schedule Control */}
      {!isSensor && onUpdateSchedule && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#1a2235]">
          {showSchedule ? (
             <div className="flex flex-col gap-2 bg-gray-50 dark:bg-[#15203a] p-2 rounded-lg border border-gray-200 dark:border-[#1a2235]">
               <div className="flex justify-between items-center text-xs">
                 <span className="text-gray-600 dark:text-gray-400">وقت التشغيل:</span>
                 <input type="time" value={schOnTime} onChange={(e) => setSchOnTime(e.target.value)} className="p-1 rounded bg-white dark:bg-[#0a0f1c] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white" />
               </div>
               <div className="flex justify-between items-center text-xs">
                 <span className="text-gray-600 dark:text-gray-400">وقت الإطفاء:</span>
                 <input type="time" value={schOffTime} onChange={(e) => setSchOffTime(e.target.value)} className="p-1 rounded bg-white dark:bg-[#0a0f1c] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white" />
               </div>
               <div className="flex gap-2 mt-1">
                 <button onClick={() => handleSaveSchedule(true)} className="flex-1 text-xs bg-primary hover:bg-blue-600 text-white py-1.5 rounded transition-colors font-bold">تفعيل</button>
                 <button onClick={() => handleSaveSchedule(false)} className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white py-1.5 rounded transition-colors font-bold">إيقاف</button>
                 <button onClick={() => setShowSchedule(false)} className="text-xs text-gray-500 px-2">إلغاء</button>
               </div>
             </div>
          ) : (
            <div className="flex justify-between items-center">
              <button onClick={() => setShowSchedule(true)} className={`flex items-center gap-1 text-[10px] transition-colors ${device.scheduleActive ? 'text-primary font-bold' : 'text-gray-500 hover:text-primary'}`}>
                <Clock size={12} /> {device.scheduleActive ? 'الجدولة مفعلة' : 'إضافة جدولة يومية'}
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
