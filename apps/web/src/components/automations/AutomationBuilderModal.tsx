'use client';
import React, { useState } from 'react';
import { X, Clock, Zap, PlayCircle, Settings2, Plus, Trash2, Thermometer, ShieldCheck } from 'lucide-react';
import { AnimatedButton } from '../ui/AnimatedButton';
import { fetchAuth, useSmartHomeStore } from '@/store/useSmartHomeStore';

export const AutomationBuilderModal = ({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void;
  onSuccess?: () => void;
}) => {
  const devices = useSmartHomeStore(state => state.devices);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'TIME' | 'SENSOR' | 'TEMP'>('TIME');
  const [triggerTime, setTriggerTime] = useState('07:00');
  const [triggerDeviceId, setTriggerDeviceId] = useState(devices[0] ? String(devices[0].id) : '');
  const [triggerCondition, setTriggerCondition] = useState('>');
  const [triggerValue, setTriggerValue] = useState('28');
  const [isSaving, setIsSaving] = useState(false);
  
  const [actions, setActions] = useState<Array<{ id: number; deviceId: string; state: 'ON' | 'OFF' }>>([
    { id: 1, deviceId: devices[0] ? String(devices[0].id) : '', state: 'ON' }
  ]);

  const addAction = () => {
    setActions([...actions, { 
      id: Date.now() + Math.random(), 
      deviceId: devices[0] ? String(devices[0].id) : '', 
      state: 'ON' 
    }]);
  };

  const removeAction = (id: number) => {
    if (actions.length <= 1) return;
    setActions(actions.filter(a => a.id !== id));
  };

  const handleActionChange = (id: number, field: 'deviceId' | 'state', value: string) => {
    setActions(actions.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('يرجى كتابة اسم للأتمتة الذكية');
      return;
    }

    setIsSaving(true);
    try {
      let conditions: any[] = [];
      if (triggerType === 'TIME') {
        conditions = [{
          type: 'time',
          time: triggerTime
        }];
      } else if (triggerType === 'TEMP') {
        conditions = [{
          type: 'sensor_value',
          deviceId: triggerDeviceId,
          operator: triggerCondition as any,
          value: Number(triggerValue),
          unit: '°C'
        }];
      } else {
        conditions = [{
          type: 'device_state',
          deviceId: triggerDeviceId,
          state: 'ON'
        }];
      }

      const formattedActions = actions.map(act => ({
        type: 'device_control' as const,
        deviceId: act.deviceId,
        state: act.state
      }));

      const res = await fetchAuth('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          conditions,
          actions: formattedActions,
          isActive: true
        })
      });

      if (res.ok) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'فشل حفظ الأتمتة');
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ الأتمتة');
    } finally {
      setIsSaving(false);
    }
  };

  const sensorDevices = devices.filter(d => 
    ['sensor_temp', 'sensor_motion', 'sensor_door', 'temperature', 'moisture', 'energy'].includes(d.type?.toLowerCase() || '')
  );

  const controllableDevices = devices.filter(d => 
    !['sensor_temp', 'moisture', 'energy'].includes(d.type?.toLowerCase() || '')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
      <div className="bg-[#0b0f19] border border-[#1e293b] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-[#1e293b] flex justify-between items-center bg-[#080b12]">
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Zap size={20} />
            </div>
            <span>بناء أتمتة جديدة (Automation Rule)</span>
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white bg-[#1e293b] rounded-xl cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          
          {/* Name */}
          <div>
            <label className="block text-slate-300 font-bold mb-2 text-xs sm:text-sm">اسم الأتمتة (Rule Name):</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: تشغيل مكيف الصالة عند تجاوز 28°C"
              className="w-full bg-[#161e2e] border border-[#2a374a] rounded-2xl px-4 py-3 text-white text-xs sm:text-sm outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* IF (Trigger) */}
            <div className="bg-[#161e2e] border border-[#2a374a] rounded-3xl p-5 relative">
              <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black px-4 py-1 rounded-full text-xs shadow-lg">
                IF (عندما يتحقق الشرط)
              </div>
              
              <div className="space-y-4 mt-2">
                <label className="block text-slate-400 font-bold text-xs">نوع المحفز (Trigger Type):</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button 
                    type="button"
                    onClick={() => setTriggerType('TIME')} 
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${triggerType === 'TIME' ? 'bg-blue-600 border-blue-400 text-white shadow-md' : 'bg-black/30 border-[#2a374a] text-slate-400 hover:text-white'}`}
                  >
                    <Clock size={14} /> وقت
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTriggerType('TEMP')} 
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${triggerType === 'TEMP' ? 'bg-blue-600 border-blue-400 text-white shadow-md' : 'bg-black/30 border-[#2a374a] text-slate-400 hover:text-white'}`}
                  >
                    <Thermometer size={14} /> حرارة
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTriggerType('SENSOR')} 
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${triggerType === 'SENSOR' ? 'bg-blue-600 border-blue-400 text-white shadow-md' : 'bg-black/30 border-[#2a374a] text-slate-400 hover:text-white'}`}
                  >
                    <Zap size={14} /> حساس
                  </button>
                </div>

                {triggerType === 'TIME' && (
                  <div>
                    <label className="block text-slate-400 font-bold mb-1.5 text-xs">الوقت اليومي (Daily Time):</label>
                    <input 
                      type="time" 
                      value={triggerTime}
                      onChange={(e) => setTriggerTime(e.target.value)}
                      className="w-full bg-black/40 border border-[#2a374a] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                )}

                {triggerType === 'TEMP' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1.5 text-xs">الشرط:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <select 
                          value={triggerCondition} 
                          onChange={(e) => setTriggerCondition(e.target.value)}
                          className="bg-black/40 border border-[#2a374a] rounded-xl p-2 text-white text-xs outline-none"
                        >
                          <option value=">">أكبر من (&gt;)</option>
                          <option value="<">أصغر من (&lt;)</option>
                          <option value="==">يساوي (==)</option>
                        </select>
                        <input 
                          type="number" 
                          value={triggerValue}
                          onChange={(e) => setTriggerValue(e.target.value)}
                          placeholder="28"
                          className="bg-black/40 border border-[#2a374a] rounded-xl p-2 text-white text-xs outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {triggerType === 'SENSOR' && (
                  <div>
                    <label className="block text-slate-400 font-bold mb-1.5 text-xs">اختر الحساس:</label>
                    <select 
                      value={triggerDeviceId} 
                      onChange={(e) => setTriggerDeviceId(e.target.value)}
                      className="w-full bg-black/40 border border-[#2a374a] rounded-xl p-2.5 text-white text-xs outline-none"
                    >
                      {(sensorDevices.length > 0 ? sensorDevices : devices).map(d => (
                        <option key={d.id} value={d.id}>{d.name} (GPIO {d.pin})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* THEN (Action) */}
            <div className="bg-[#161e2e] border border-[#2a374a] rounded-3xl p-5 relative">
              <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-purple-600 to-rose-600 text-white font-black px-4 py-1 rounded-full text-xs shadow-lg flex items-center gap-1">
                THEN (نفذ الإجراءات التالية)
              </div>
              
              <div className="space-y-3 mt-2">
                {actions.map((act, index) => (
                  <div key={act.id} className="bg-black/40 border border-[#2a374a] rounded-2xl p-3 relative group">
                    {actions.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => removeAction(act.id)} 
                        className="absolute left-2.5 top-2.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <label className="block text-slate-400 font-bold mb-1.5 text-xs">الإجراء #{index + 1}:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select 
                        value={act.deviceId}
                        onChange={(e) => handleActionChange(act.id, 'deviceId', e.target.value)}
                        className="bg-black/60 border border-[#2a374a] rounded-xl p-2 text-white text-xs outline-none focus:border-purple-500"
                      >
                        {(controllableDevices.length > 0 ? controllableDevices : devices).map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <select 
                        value={act.state}
                        onChange={(e) => handleActionChange(act.id, 'state', e.target.value as any)}
                        className="bg-black/60 border border-[#2a374a] rounded-xl p-2 text-white text-xs outline-none focus:border-purple-500 font-bold"
                      >
                        <option value="ON" className="text-emerald-400">تشغيل (ON)</option>
                        <option value="OFF" className="text-red-400">إطفاء (OFF)</option>
                      </select>
                    </div>
                  </div>
                ))}
                
                <button 
                  type="button"
                  onClick={addAction} 
                  className="w-full py-2.5 border border-dashed border-[#2a374a] hover:border-purple-500 rounded-xl text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
                >
                  <Plus size={14} /> إضافة جهاز آخر للتنفيذ
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#1e293b] flex justify-end gap-3 bg-[#080b12]">
          <button 
            type="button"
            onClick={onClose} 
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:text-white hover:bg-[#1e293b] transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <AnimatedButton 
            onClick={handleSave} 
            variant="primary" 
            disabled={isSaving}
            className="gap-2 px-6 text-xs font-black cursor-pointer"
          >
            <PlayCircle size={16} /> 
            <span>{isSaving ? 'جاري الحفظ...' : 'حفظ وتفعيل الأتمتة'}</span>
          </AnimatedButton>
        </div>
      </div>
    </div>
  );
};
