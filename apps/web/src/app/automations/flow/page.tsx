"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Save, Play, Plus, Cpu, Clock, Zap, ArrowDown, 
  Trash2, ShieldCheck, Thermometer, Droplets, Lightbulb, Power, Sun
} from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';

export default function FlowPage() {
  const devices = useSmartHomeStore(state => state.devices);
  const addAutomationRule = useSmartHomeStore(state => state.addAutomationRule);

  // Flow Builder simplified wizard state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'TIME' | 'SENSOR' | 'TEMP'>('TIME');
  
  // Trigger options
  const [triggerTime, setTriggerTime] = useState('08:00');
  const [triggerDeviceId, setTriggerDeviceId] = useState('');
  const [triggerCondition, setTriggerCondition] = useState('>');
  const [triggerValue, setTriggerValue] = useState('25');

  // Delay setting (Optional)
  const [hasDelay, setHasDelay] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(5);

  // Actions list
  const [actions, setActions] = useState<Array<{ deviceId: string; state: 'ON' | 'OFF' }>>([
    { deviceId: '', state: 'ON' }
  ]);

  const triggerDevices = devices.filter(d => 
    ['sensor_temp', 'sensor_motion', 'sensor_door', 'temperature', 'moisture', 'energy', 'light', 'socket'].includes(d.type?.toLowerCase() || '')
  );

  const actionDevices = devices.filter(d => 
    !['sensor_temp', 'moisture', 'energy'].includes(d.type?.toLowerCase() || '')
  );

  const handleAddAction = () => {
    setActions([...actions, { deviceId: '', state: 'ON' }]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleActionChange = (index: number, key: 'deviceId' | 'state', value: any) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [key]: value };
    setActions(updated);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('يرجى إدخال اسم للأتمتة الذكية');
      return;
    }
    if (actions.some(act => !act.deviceId)) {
      showToast('يرجى تحديد الأجهزة المستهدفة لجميع الإجراءات');
      return;
    }

    setIsSaving(true);
    try {
      let conditions: any[] = [];
      if (triggerType === 'TIME') {
        conditions = [{ type: 'time', time: triggerTime }];
      } else if (triggerType === 'TEMP') {
        conditions = [{ type: 'sensor_value', operator: triggerCondition, value: Number(triggerValue), unit: '°C' }];
      } else {
        conditions = [{ type: 'device_state', deviceId: triggerDeviceId, state: 'ON' }];
      }

      const formattedActions = actions.map(act => ({
        type: 'device_control',
        deviceId: act.deviceId,
        state: act.state
      }));

      // 1. Post to backend
      await fetchAuth('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          conditions,
          actions: formattedActions,
          isActive: true
        })
      });

      // 2. Update local state
      for (let i = 0; i < actions.length; i++) {
        const act = actions[i];
        const targetDevice = devices.find(d => d.id.toString() === act.deviceId.toString());
        const actionBoardId = targetDevice?.boardId || 'local';

        const payload = {
          id: `${Date.now()}_${i}`,
          name: `${name} (${i + 1})`,
          enabled: true,
          triggerType: triggerType === 'TIME' ? 'time' : 'sensor',
          triggerTime: triggerType === 'TIME' ? triggerTime : undefined,
          triggerSensorType: triggerType === 'TEMP' ? 'temperature' : 'motion',
          triggerCondition: triggerType !== 'TIME' ? triggerCondition : undefined,
          triggerValue: triggerType !== 'TIME' ? (triggerType === 'TEMP' ? Number(triggerValue) : triggerValue) : undefined,
          actionDeviceId: act.deviceId,
          actionBoardId,
          actionState: act.state,
          logicOperator: 'NONE'
        };

        addAutomationRule(payload as any);
      }

      showToast('تم حفظ وتفعيل الأتمتة التلقائية بنجاح! ⚡🎉');
      setName('');
      setActions([{ deviceId: '', state: 'ON' }]);
    } catch (err) {
      showToast('حدث خطأ أثناء الحفظ.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-8 pb-32" dir="rtl">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white">منشئ الأتمتة المساعد</h1>
          <p className="text-white/50 text-sm mt-1">طريقة مبسطة ومتسلسلة لربط الحساسات والمواقيت بإجراءات التشغيل التلقائي</p>
        </div>
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
          <Cpu className="text-primary animate-pulse" size={24} />
        </div>
      </div>

      <div className="space-y-6 relative">
        {/* Connection Line */}
        <div className="absolute top-16 bottom-16 right-[2.75rem] w-0.5 bg-dashed border-r border-white/10 z-0 pointer-events-none" />

        {/* BLOCK 1: Rule Name */}
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">1</div>
          <div className="flex-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
            <label className="text-sm font-bold text-white block mb-2">اسم الأتمتة الذكية</label>
            <input
              type="text"
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 outline-none text-white transition-all text-xs"
              placeholder="مثال: تشغيل مضخة ري الحديقة عند جفاف التربة"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
        </div>

        {/* BLOCK 2: Trigger (IF) */}
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">2</div>
          <div className="flex-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <div>
              <span className="text-xs text-white/50 font-bold block mb-3">إذا حدث المحفز التالي (IF):</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'TIME', label: 'وقت محدد', icon: Clock },
                  { id: 'TEMP', label: 'درجة حرارة', icon: Thermometer },
                  { id: 'SENSOR', label: 'حساس حركة/باب', icon: Zap }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = triggerType === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setTriggerType(item.id as any)}
                      className={`p-3 rounded-2xl border font-bold text-xs flex flex-col items-center gap-1.5 transition-all ${
                        isSelected 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'bg-white/5 border-white/5 text-white/50 hover:text-white'
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trigger detail inputs */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              {triggerType === 'TIME' && (
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-400 font-bold block">اختر وقت التفعيل اليومي</label>
                  <input
                    type="time"
                    value={triggerTime}
                    onChange={e => setTriggerTime(e.target.value)}
                    className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-center text-lg font-bold"
                  />
                </div>
              )}

              {triggerType === 'TEMP' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="col-span-3">
                    <label className="text-[10px] text-gray-400 font-bold block mb-1.5">اختر الحساس</label>
                    <select
                      value={triggerDeviceId}
                      onChange={e => setTriggerDeviceId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="">اختر حساس الحرارة...</option>
                      {triggerDevices.filter(d => d.type?.toLowerCase() === 'temperature' || d.type?.toLowerCase() === 'sensor_temp').map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-gray-400 font-bold block mb-1.5 font-bold">الشرط</label>
                    <select
                      value={triggerCondition}
                      onChange={e => setTriggerCondition(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value=">">أكبر من (&gt;)</option>
                      <option value="<">أصغر من (&lt;)</option>
                      <option value="==">يساوي (=)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1.5">القيمة</label>
                    <input
                      type="number"
                      value={triggerValue}
                      onChange={e => setTriggerValue(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white text-center"
                      placeholder="28"
                    />
                  </div>
                </div>
              )}

              {triggerType === 'SENSOR' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1.5">اختر الحساس</label>
                    <select
                      value={triggerDeviceId}
                      onChange={e => setTriggerDeviceId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="">اختر الحساس...</option>
                      {triggerDevices.filter(d => ['sensor_motion', 'sensor_door', 'light', 'socket'].includes(d.type?.toLowerCase() || '')).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1.5 font-bold">الحالة المطلوبة</label>
                    <select
                      value={triggerValue}
                      onChange={e => { setTriggerValue(e.target.value); setTriggerCondition('=='); }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                    >
                      <option value="ON">كشف حركة / الباب مفتوح (ON)</option>
                      <option value="OFF">لا توجد حركة / الباب مغلق (OFF)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BLOCK 3: Delay/Timer (Optional) */}
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-amber-500/20">3</div>
          <div className="flex-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/70 font-bold">إضافة وقت انتظار (Delay - اختياري)</span>
              <button
                onClick={() => setHasDelay(!hasDelay)}
                className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all ${
                  hasDelay ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/30'
                }`}
              >
                {hasDelay ? 'مفعل' : 'غير مفعل'}
              </button>
            </div>

            {hasDelay && (
              <div className="flex items-center gap-3 animate-fade-in bg-white/5 p-3 rounded-xl">
                <span className="text-xs text-white/50">انتظر مدة</span>
                <input
                  type="number"
                  min={1}
                  value={delayMinutes}
                  onChange={e => setDelayMinutes(Number(e.target.value))}
                  className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center text-xs text-white"
                />
                <span className="text-xs text-white/50">دقائق قبل التنفيذ</span>
              </div>
            )}
          </div>
        </div>

        {/* BLOCK 4: Actions (THEN) */}
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">4</div>
          <div className="flex-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/50 font-bold">الإجراءات المتخذة (THEN):</span>
              <button
                onClick={handleAddAction}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-bold"
              >
                <Plus size={10} /> إضافة جهاز آخر
              </button>
            </div>

            <div className="space-y-3">
              {actions.map((act, index) => (
                <div key={index} className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                  <div className="flex-1">
                    <select
                      value={act.deviceId}
                      onChange={e => handleActionChange(index, 'deviceId', e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-2 py-2 text-xs text-white"
                    >
                      <option value="">اختر الجهاز...</option>
                      {actionDevices.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={act.state}
                      onChange={e => handleActionChange(index, 'state', e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-2 py-2 text-xs text-white"
                    >
                      <option value="ON">تشغيل (ON)</option>
                      <option value="OFF">إطفاء (OFF)</option>
                    </select>
                  </div>
                  {actions.length > 1 && (
                    <button 
                      onClick={() => handleRemoveAction(index)}
                      className="text-red-400 hover:text-red-300 p-2 bg-red-400/10 rounded-xl"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <div className="flex gap-4">
        <button
          onClick={handleSave}
          className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold rounded-3xl text-sm transition-all shadow-xl"
        >
          حفظ وتفعيل الأتمتة الذكية
        </button>
      </div>

    </div>
  );
}
