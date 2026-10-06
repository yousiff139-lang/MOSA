import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, ShieldCheck, AlertTriangle, Cpu, Zap, Check, Sliders, Layers } from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';

interface NodeController {
  id: string;
  name: string;
  mac: string;
  status: string;
}

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddDeviceModal({ isOpen, onClose, onSuccess }: AddDeviceModalProps) {
  const [nodes, setNodes] = useState<NodeController[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('LIGHT');
  const [pinNumber, setPinNumber] = useState(4);
  const [activeState, setActiveState] = useState<'HIGH' | 'LOW'>('HIGH');
  const [switchPin, setSwitchPin] = useState<number | ''>('');
  const [switchMode, setSwitchMode] = useState<'GND' | 'VCC'>('GND');
  const [controllerId, setControllerId] = useState('');
  const [streamUrl, setStreamUrl] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    fetchNodes();
  }, [isOpen]);

  const fetchNodes = async () => {
    try {
      const res = await fetchAuth(`/api/controllers`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setNodes(list);
        if (list.length > 0) {
          setControllerId(prev => prev || list[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch nodes', err);
    }
  };

  // ESP32-S3-WROOM-2 (8MB Octal PSRAM) Hardware Constraints:
  // - Non-existent silicon gap: 22..25
  // - Internal SPI Flash bus: 26..32
  // - 8MB Octal SPI PSRAM bus: 33..37
  // - UART0 CH343 USB Serial bridge: 43, 44
  const hardwareReservedPins = [22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 43, 44];
  const inputOnlyPins = [46]; // GPIO 46 is a fixed input-only pad in silicon (no output driver)
  const bootStrappingPins = [0, 3, 45, 46];

  const getPinSafetyStatus = (pin: number, isSwitch = false) => {
    if (pin < 0 || pin > 48) {
      return { level: 'error', text: '⚠️ غير صالح: شريحة ESP32-S3 تدعم المنافذ من 0 إلى 48 فقط.' };
    }
    if (pin === 43 || pin === 44) {
      return { level: 'error', text: '⚠️ محظور: منفذ اتصال السيريال بالكمبيوتر (CH343 UART0 TX/RX).' };
    }
    if (pin >= 33 && pin <= 37) {
      return { level: 'error', text: '⚠️ محظور: مخصص لذاكرة الرام السريعة (8MB Octal PSRAM على WROOM-2).' };
    }
    if (pin >= 26 && pin <= 32) {
      return { level: 'error', text: '⚠️ محظور: مخصص للذاكرة الفلاشية الداخلية للبرنامج (SPI Flash).' };
    }
    if (pin >= 22 && pin <= 25) {
      return { level: 'error', text: '⚠️ غير موجود: فجوة في سيليكون ESP32-S3 (المنافذ 22-25 غير مصنعة بالرقاقة).' };
    }
    if (!isSwitch && pin === 0) {
      return { level: 'error', text: '⚠️ محظور كخرج: المنفذ 0 مخصص لزر الإقلاع (BOOT) وتأكيد الحضور الفيزيائي.' };
    }
    if (!isSwitch && pin === 46) {
      return { level: 'error', text: '⚠️ محظور كخرج: المنفذ 46 في ESP32-S3 مدخل فقط (Input-Only بلا دائرة قيادة ريلاي).' };
    }
    if (isSwitch && pin === 46) {
      return { level: 'ok', text: '✅ المنفذ 46 مدخل فيزيائي آمن كمفتاح جداري (Switch).' };
    }
    if (bootStrappingPins.includes(pin)) {
      return { level: 'warning', text: '⚡ منفذ إقلاع (Strapping Pin)؛ تجنب سحبه لجهد مخالف أثناء الإقلاع.' };
    }
    return { level: 'ok', text: '✅ المنفذ آمن ومتاح للاستخدام الفعلي على ESP32-S3.' };
  };

  const currentPinSafety = getPinSafetyStatus(Number(pinNumber));
  const currentSwitchPinSafety = switchPin !== '' ? getPinSafetyStatus(Number(switchPin), true) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const numPin = Number(pinNumber);
    const numSwitchPin = switchPin !== '' ? Number(switchPin) : null;

    if (type !== 'CAMERA') {
      if (numPin < 0 || numPin > 48 || (numSwitchPin !== null && (numSwitchPin < 0 || numSwitchPin > 48))) {
        setError('نطاق الـ GPIO المتاح في متحكم ESP32-S3 هو من 0 إلى 48 فقط.');
        setLoading(false);
        return;
      }
      if (hardwareReservedPins.includes(numPin)) {
        setError(`المنفذ ${numPin} محجوز هاردويرياً (ذاكرة فلاش/رام/سيريال/فجوة سيليكون) ولا يمكن استخدامه.`);
        setLoading(false);
        return;
      }
      if (numSwitchPin !== null && hardwareReservedPins.includes(numSwitchPin)) {
        setError(`منفذ السويتش ${numSwitchPin} محجوز هاردويرياً ولا يمكن استخدامه.`);
        setLoading(false);
        return;
      }
      if (numPin === 0) {
        setError('المنفذ 0 مخصص لزر الإقلاع (BOOT) ولا يمكن استخدامه كمخرج ريلاي.');
        setLoading(false);
        return;
      }
      if (numPin === 46) {
        setError('المنفذ 46 في ESP32-S3 هو مدخل فقط (Input-Only)، لا يمكن ربط ريلاي خرج عليه.');
        setLoading(false);
        return;
      }
    }

    try {
      const payload = {
        name,
        type,
        pinNumber: type === 'CAMERA' ? 0 : numPin,
        pinMode: ['ENERGY', 'TEMPERATURE', 'MOISTURE'].includes(type) ? 'INPUT' : 'OUTPUT',
        activeState,
        switchPin: (type !== 'CAMERA' && numSwitchPin !== null) ? numSwitchPin : undefined,
        switchMode: (type !== 'CAMERA' && numSwitchPin !== null) ? switchMode : undefined,
        controllerId: type === 'CAMERA' ? undefined : controllerId,
        ipAddress: type === 'CAMERA' ? streamUrl : undefined
      };

      const res = await fetchAuth(`/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onSuccess();
        onClose();
        setName('');
        setStreamUrl('');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || 'فشل في حفظ الجهاز');
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال بالسيرفر');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !isMounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 bg-[#070d1a] sm:bg-black/90" dir="rtl">
      <div className="bg-[#0b101d] border-0 sm:border sm:border-cyan-500/30 sm:rounded-3xl w-full sm:max-w-2xl shadow-2xl relative flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 z-10" />

        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 bg-[#0b101d] shrink-0 pt-[max(0.875rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-inner shrink-0">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                إضافة جهاز وتكوين العتاد ⚙️
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                <span>فحص العتاد وحماية شريحة ESP32</span>
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700 shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form id="add-device-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#0b101d] overscroll-contain">
          {error && (
            <div className="bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <Layers size={15} />
              <span>1. بيانات الجهاز واللوحة</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم الجهاز في اللوحة</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: إنارة المطبخ الرئيسية"
                  className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">نوع الجهاز والمهمة</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="LIGHT">💡 إنارة (Light)</option>
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
                </select>
              </div>
            </div>

            {type !== 'CAMERA' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Cpu size={14} className="text-cyan-400" />
                  المتحكم المربوط (ESP32 Controller Node)
                </label>
                <select
                  required
                  value={controllerId}
                  onChange={(e) => setControllerId(e.target.value)}
                  className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-cyan-400 cursor-pointer"
                >
                  {nodes.length === 0 && <option value="" className="bg-slate-900">لا يوجد متحكمات متصلة بالشبكة</option>}
                  {nodes.map(node => (
                    <option key={node.id} value={node.id} className="bg-slate-900">
                      🟢 {node.name || node.mac} ({node.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {type === 'CAMERA' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رابط بث الكاميرا (RTSP / HTTP Stream)</label>
                <input
                  type="text"
                  required
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="مثال: rtsp://192.168.1.50:554/live"
                  className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors text-left"
                  dir="ltr"
                />
              </div>
            )}
          </div>

          {/* Section 2: Relay GPIO Out */}
          {type !== 'CAMERA' && (
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Zap size={15} />
                <span>2. منفذ الريلاي (GPIO Out)</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم منفذ الخرج (Relay GPIO Out Pin)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={48}
                    value={pinNumber}
                    onChange={(e) => setPinNumber(Number(e.target.value))}
                    className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-400 transition-colors"
                  />
                </div>

                {!['TEMPERATURE', 'MOISTURE', 'ENERGY'].includes(type) ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">حالة تفعيل الـ Pin (Active State)</label>
                    <select
                      value={activeState}
                      onChange={(e) => setActiveState(e.target.value as 'HIGH' | 'LOW')}
                      className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="HIGH">⚡ تشغيل بـ 3.3V (Active HIGH)</option>
                      <option value="LOW">🔌 تشغيل بـ 0V / GND (Active LOW)</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">نوع الإشارة</label>
                    <div className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-bold flex items-center gap-2">
                      <span>📊 مدخل قراءات الحساس الرقمي/التماثلي</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Safety Indicator */}
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-medium ${
                currentPinSafety.level === 'error' ? 'bg-red-500/15 border-red-500/30 text-red-300' :
                currentPinSafety.level === 'warning' ? 'bg-amber-500/15 border-amber-500/30 text-amber-200' :
                'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
              }`}>
                <ShieldCheck size={16} className="shrink-0" />
                <span>{currentPinSafety.text}</span>
              </div>
            </div>
          )}

          {/* Section 3: Switch In */}
          {type !== 'CAMERA' && !['TEMPERATURE', 'MOISTURE', 'ENERGY'].includes(type) && (
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
              <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <Sliders size={15} />
                <span>3. مفتاح الجدار الخارجي (Switch In)</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-cyan-300 mb-1">منفذ السويتش الخارجي (Switch GPIO In)</label>
                  <input
                    type="number"
                    min={0}
                    max={48}
                    value={switchPin}
                    onChange={(e) => setSwitchPin(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="مثال: 15 (أو اتركه فارغاً)"
                    className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-cyan-400 font-mono font-bold focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-cyan-300 mb-1">نمط ربط مفتاح الجدار</label>
                  <select
                    value={switchMode}
                    onChange={(e) => setSwitchMode(e.target.value as 'GND' | 'VCC')}
                    className="w-full bg-[#070d1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-cyan-400 transition-colors cursor-pointer"
                  >
                    <option value="GND">🔻 سحب للأرضي (GND) - مستحسن للأمان</option>
                    <option value="VCC">🔺 سحب للموجب (3.3V)</option>
                  </select>
                </div>
              </div>

              {currentSwitchPinSafety && (
                <div className={`p-2.5 rounded-xl border text-[11px] font-medium flex items-center gap-2 ${
                  currentSwitchPinSafety.level === 'error' ? 'bg-red-500/15 border-red-500/30 text-red-300' :
                  currentSwitchPinSafety.level === 'warning' ? 'bg-amber-500/15 border-amber-500/30 text-amber-200' :
                  'bg-cyan-500/15 border-cyan-500/30 text-cyan-200'
                }`}>
                  <ShieldCheck size={14} className="shrink-0" />
                  <span>{currentSwitchPinSafety.text}</span>
                </div>
              )}

              <div className="bg-[#070d1a] p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                🛡️ <span className="font-bold text-cyan-300">نصيحة أمان:</span> يُنصح باختيار <span className="text-cyan-400 font-bold">GND</span> عند ربط المفتاح الخارجي لحماية شريحة الـ ESP32.
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-4 sm:p-5 border-t border-slate-800 bg-[#0b101d] shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="submit"
            form="add-device-form"
            disabled={loading || (type !== 'CAMERA' && nodes.length === 0)}
            className="flex-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check size={17} />
            <span>{loading ? 'جاري الحفظ والتأمين...' : 'حفظ وإضافة الجهاز وتأمين العتاد'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
