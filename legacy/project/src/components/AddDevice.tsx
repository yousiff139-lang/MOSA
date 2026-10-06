import React, { useState } from 'react';
import { Plus, AlertTriangle, Radar, RefreshCw } from 'lucide-react';
import { Device } from '../types';

const RELAY_PINS = [
  { name: "RELAY_1 (IO4)", pin: 4 }, { name: "RELAY_2 (IO5)", pin: 5 }, { name: "RELAY_3 (IO6)", pin: 6 },
  { name: "RELAY_4 (IO7)", pin: 7 }, { name: "RELAY_5 (IO15)", pin: 15 }, { name: "RELAY_6 (IO16)", pin: 16 },
  { name: "RELAY_7 (IO17)", pin: 17 }, { name: "RELAY_8 (IO18)", pin: 18 }, { name: "RELAY_9 (IO8)", pin: 8 },
  { name: "RELAY_10 (IO9)", pin: 9 }
];

const SWITCH_PINS = [
  { name: "SW_1 (IO13)", pin: 13 }, { name: "SW_2 (IO14)", pin: 14 }, { name: "SW_3 (IO42)", pin: 42 },
  { name: "SW_4 (IO41)", pin: 41 }, { name: "SW_5 (IO40)", pin: 40 }, { name: "SW_6 (IO39)", pin: 39 },
  { name: "SW_7 (IO38)", pin: 38 }, { name: "SW_8 (IO48)", pin: 48 }, { name: "SW_9 (IO47)", pin: 47 },
  { name: "SW_10 (IO21)", pin: 21 }
];

import { useSmartHomeStore } from '../store/useSmartHomeStore';
import { useSmartHome } from '../hooks/useSmartHome';

interface AddDeviceProps {
  onAdd: (boardId: string, formData: FormData) => void;
  devices: Device[];
}

export function AddDevice({ onAdd, devices }: AddDeviceProps) {
  const [error, setError] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const boards = useSmartHomeStore(state => state.boards);
  const boardList = Object.values(boards);
  const { scanNetwork } = useSmartHome();

  const handleScan = async () => {
    setIsScanning(true);
    setScanMessage('جاري البحث عن اللوحات...');
    const devices = await scanNetwork();
    setIsScanning(false);
    if (devices && devices.length > 0) {
      setScanMessage(`تم العثور على ${devices.length} لوحة!`);
      setTimeout(() => setScanMessage(''), 3000);
    } else {
      setScanMessage('لم يتم العثور على لوحات.');
      setTimeout(() => setScanMessage(''), 3000);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const targetBoardId = selectedBoardId;
    const pin = parseInt(formData.get('pin') as string);
    const inpinStr = formData.get('inpin') as string;
    const inpin = inpinStr ? parseInt(inpinStr) : -1;

    // Hardcode room to avoid breaking API but rely on Board name for UI
    formData.append('room', 'عام');

    if (!targetBoardId) {
      setError("الرجاء اختيار اللوحة التي تود ربط الجهاز بها.");
      return;
    }
    
    // 1. Check for duplicates in already added devices (only for the selected board)
    const boardDevices = devices.filter(d => d.boardId === targetBoardId);
    const usedPins = boardDevices.flatMap(d => [d.pin, d.inPin]).filter(p => p !== -1);
    if (usedPins.includes(pin)) {
      setError(`الـ Pin ${pin} مستخدم مسبقاً لجهاز آخر!`);
      return;
    }
    if (inpin !== -1 && usedPins.includes(inpin)) {
      setError(`الـ Pin ${inpin} للسويتش مستخدم مسبقاً!`);
      return;
    }

    // 2. Relay and Switch cannot have the same Pin
    if (inpin !== -1 && inpin === pin) {
       setError(`لا يمكن أن يكون رقم الـ GPIO للريلاي والسويتش متطابقاً.`);
       return;
    }

    onAdd(targetBoardId, formData);
    e.currentTarget.reset();
  };

  const boardDevices = devices.filter(d => d.boardId === selectedBoardId);
  const usedPins = boardDevices.flatMap(d => [d.pin, d.inPin]).filter(p => p !== -1);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-up">
      <header className="flex justify-between items-end border-b border-gray-200 dark:border-[#1a2235] pb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">إضافة جهاز جديد</h2>
      </header>

      <form onSubmit={handleSubmit} className="glass-panel p-8 rounded-3xl shadow-xl relative overflow-hidden">
         <div className="flex justify-between items-start mb-8">
           <div>
             <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 drop-shadow-sm">إضافة جهاز جديد</h3>
             <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">أدخل تفاصيل الجهاز للربط مع ESP32</p>
           </div>
           <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center">
             <Plus size={24} className="text-primary drop-shadow-md" />
           </div>
         </div>

         {error && (
           <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-500 dark:text-red-400 text-sm font-bold flex items-center gap-3 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
             <AlertTriangle size={20} className="flex-shrink-0" />
             <p>{error}</p>
           </div>
         )}

         <div className="space-y-6">
           <div className="space-y-2">
             <div className="flex justify-between items-end">
               <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 px-1">اللوحة (الغرفة أو المنطقة)</label>
               <button 
                 type="button" 
                 onClick={handleScan}
                 disabled={isScanning}
                 className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-2 py-1 rounded-lg"
               >
                 {isScanning ? <RefreshCw size={12} className="animate-spin" /> : <Radar size={12} className="animate-pulse" />}
                 {isScanning ? 'جاري البحث...' : 'اكتشاف تلقائي'}
               </button>
             </div>
             <select 
               name="boardId" 
               required 
               value={selectedBoardId}
               onChange={(e) => setSelectedBoardId(e.target.value)}
               className="w-full p-4 bg-black/5 dark:bg-black/30 rounded-2xl border border-white/10 focus:border-primary outline-none text-gray-900 dark:text-white text-sm appearance-none cursor-pointer transition-colors"
             >
               <option value="" className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">-- اختر اللوحة --</option>
               {boardList.map(b => (
                 <option key={b.id} value={b.id} className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">{b.name || b.id} {b.ip ? `(${b.ip})` : '(بدون IP)'}</option>
               ))}
             </select>
             {scanMessage && <p className={`text-[10px] font-bold ${scanMessage.includes('تم') ? 'text-green-500' : 'text-blue-500'}`}>{scanMessage}</p>}
             {boardList.length === 0 && !scanMessage && <p className="text-[10px] text-red-500">لا توجد لوحات مكتشفة. استخدم الاكتشاف التلقائي.</p>}
           </div>

           <div className="space-y-2">
             <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 px-1">اسم الجهاز</label>
             <input name="name" required placeholder="مثال: ضوء غرفة المعيشة" className="w-full p-4 bg-black/5 dark:bg-black/30 rounded-2xl border border-white/10 focus:border-primary outline-none transition-all text-gray-900 dark:text-white text-sm" />
           </div>
           
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 px-1">نوع الجهاز</label>
              <select name="type" className="w-full p-4 bg-black/5 dark:bg-black/30 rounded-2xl border border-white/10 focus:border-primary outline-none text-gray-900 dark:text-white text-sm appearance-none cursor-pointer transition-colors">
                <option value="light" className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">إضاءة (PWM/Toggle)</option>
                <option value="socket" className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">مقبس</option>
                <option value="fan" className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">مروحة (PWM/Toggle)</option>
                <option value="sensor" className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">مقياس حرارة ورطوبة</option>
              </select>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 px-1">GPIO (الريلاي/التحكم)</label>
                <select name="pin" required className="w-full p-4 bg-black/5 dark:bg-black/30 rounded-2xl border border-white/10 focus:border-primary outline-none text-gray-900 dark:text-white text-sm appearance-none cursor-pointer transition-colors">
                  <option value="" className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">-- اختر منفذ الريلاي --</option>
                  {RELAY_PINS.filter(r => !usedPins.includes(r.pin)).map(r => (
                    <option key={`relay-${r.pin}`} value={r.pin} className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 px-1">GPIO (السويتش)</label>
                <select name="inpin" className="w-full p-4 bg-black/5 dark:bg-black/30 rounded-2xl border border-white/10 focus:border-primary outline-none text-gray-900 dark:text-white text-sm appearance-none cursor-pointer transition-colors">
                  <option value="" className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">-- بدون سويتش (اتركه فارغاً) --</option>
                  {SWITCH_PINS.filter(s => !usedPins.includes(s.pin)).map(s => (
                    <option key={`switch-${s.pin}`} value={s.pin} className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">{s.name}</option>
                  ))}
                </select>
              </div>
           </div>
           
           <div className="pt-4">
            <button type="submit" className="w-full bg-blue-600/80 backdrop-blur-md hover:bg-primary py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              تثبيت الجهاز في المنزل <Plus size={18} />
            </button>
           </div>
           
           <div className="mt-6 border border-yellow-500/30 bg-yellow-500/10 rounded-2xl p-4 flex gap-3 items-start shadow-[0_0_15px_rgba(234,179,8,0.1)]">
              <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5 drop-shadow-sm" />
              <div className="space-y-2">
                <p className="text-xs text-yellow-700 dark:text-yellow-500/90 font-bold leading-relaxed">
                  تنبيهات هامة عند ربط ESP32-S3:
                </p>
                <ul className="text-[11px] text-yellow-700 dark:text-yellow-500/80 list-disc list-inside space-y-1">
                  <li>تم حجز المنافذ الأخرى لحساسات التيار (10) والحرارة (11) والحركة (12).</li>
                  <li>لا تقم بتكرار نفس الرقم لجهازين مختلفين.</li>
                </ul>
              </div>
           </div>
         </div>
      </form>
    </div>
  );
}
