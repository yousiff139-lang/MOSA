"use client";

import { useState } from 'react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { Clock, Activity, Plus, Trash2, Power, HelpCircle, Thermometer, ShieldAlert, Sparkles, Check } from 'lucide-react';
import { AutomationRule } from '@/types';

export function Automations() {
  const automationRules = useSmartHomeStore(state => state.automationRules);
  const addAutomationRule = useSmartHomeStore(state => state.addAutomationRule);
  const removeAutomationRule = useSmartHomeStore(state => state.removeAutomationRule);
  const toggleAutomationRule = useSmartHomeStore(state => state.toggleAutomationRule);
  const devices = useSmartHomeStore(state => state.devices);

  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
    name: '',
    enabled: true,
    triggerType: 'time',
    triggerCondition: '>',
    actionState: 'ON',
    logicOperator: 'NONE',
    triggerSensorType: 'temperature',
    triggerValue: 25,
    triggerTime: '08:00'
  });

  const [selectedTriggerDeviceId, setSelectedTriggerDeviceId] = useState<string>('');

  // Filter devices that can act as triggers (sensors, metrics)
  const triggerDevices = devices.filter(d => {
    const typeLower = d.type?.toLowerCase() || '';
    return ['sensor_temp', 'sensor_motion', 'sensor_door', 'temperature', 'moisture', 'energy', 'light', 'socket'].includes(typeLower);
  });

  const selectedTriggerDevice = devices.find(d => d.id.toString() === selectedTriggerDeviceId);

  const handleAdd = () => {
    if (!newRule.name || !newRule.actionDeviceId) {
      alert('يرجى ملء اسم القاعدة واختيار الجهاز المستهدف.');
      return;
    }

    const targetDevice = devices.find(d => d.id.toString() === newRule.actionDeviceId?.toString());
    const actionBoardId = targetDevice?.boardId || 'local';

    const rulePayload = {
      ...newRule,
      id: Date.now().toString(),
      actionBoardId,
      // If trigger is a specific device, store its details
      triggerSensorType: selectedTriggerDevice 
        ? selectedTriggerDevice.type?.toLowerCase() === 'temperature' || selectedTriggerDevice.type?.toLowerCase() === 'sensor_temp'
          ? 'temperature'
          : selectedTriggerDevice.type?.toLowerCase() === 'moisture'
            ? 'humidity' // map to analog checks
            : 'motion'
        : newRule.triggerSensorType
    };

    addAutomationRule(rulePayload as AutomationRule);
    setActiveTab('list');
    
    // Reset Form
    setNewRule({
      name: '',
      enabled: true,
      triggerType: 'time',
      triggerCondition: '>',
      actionState: 'ON',
      logicOperator: 'NONE',
      triggerSensorType: 'temperature',
      triggerValue: 25,
      triggerTime: '08:00'
    });
    setSelectedTriggerDeviceId('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-up" dir="rtl">
      
      {/* Header bar */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-white/10 pb-6 gap-6">
        <div>
          <h2 className="text-3xl font-black text-white">الأتمتة والقواعد الذكية</h2>
          <p className="text-sm text-white/50 mt-1">اجعل بيتك الذكي يتخذ القرارات تلقائياً بناءً على الوقت أو قراءة الحساسات</p>
        </div>

        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-white/50 hover:text-white'
            }`}
          >
            القواعد الفعالة ({automationRules.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'create'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-white/50 hover:text-white'
            }`}
          >
            + إنشاء قاعدة جديدة
          </button>
        </div>
      </header>

      {/* Content tabs */}
      {activeTab === 'create' ? (
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="space-y-6">
            
            {/* Step 1: Rule Name */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-white block">1. اسم القاعدة الذكية</label>
              <input
                type="text"
                className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-emerald-500 outline-none text-white transition-all text-sm"
                placeholder="مثال: تشغيل مكيف الصالة عند الظهر أو تشغيل الممر عند الحركة"
                value={newRule.name}
                onChange={e => setNewRule({ ...newRule, name: e.target.value })}
              />
            </div>

            {/* Step 2: Trigger Selection */}
            <div className="space-y-3 pt-2">
              <label className="text-sm font-bold text-white block">2. متى يتم التفعيل؟ (المحفز)</label>
              
              {/* Selector buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setNewRule({ ...newRule, triggerType: 'time' })}
                  className={`p-4 rounded-2xl border font-bold text-xs flex flex-col items-center gap-2 transition-all ${
                    newRule.triggerType === 'time'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[inset_0_0_15px_rgba(16,185,129,0.15)]'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  <Clock size={20} />
                  وقت محدد من اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setNewRule({ ...newRule, triggerType: 'sensor' })}
                  className={`p-4 rounded-2xl border font-bold text-xs flex flex-col items-center gap-2 transition-all ${
                    newRule.triggerType === 'sensor'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[inset_0_0_15px_rgba(16,185,129,0.15)]'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  <Activity size={20} />
                  حالة حساس أو درجة حرارة
                </button>
              </div>

              {/* Trigger Options details */}
              {newRule.triggerType === 'time' ? (
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 animate-fade-in space-y-3">
                  <span className="text-[10px] text-white/40 font-bold block">تحديد وقت التفعيل اليومي</span>
                  <input
                    type="time"
                    className="w-full p-3.5 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-emerald-500 text-center text-lg font-mono font-bold"
                    value={newRule.triggerTime || '08:00'}
                    onChange={e => setNewRule({ ...newRule, triggerTime: e.target.value })}
                  />
                </div>
              ) : (
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 animate-fade-in space-y-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-2 font-bold">اختيار الحساس المتصل</label>
                    <select
                      value={selectedTriggerDeviceId}
                      onChange={(e) => setSelectedTriggerDeviceId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white"
                    >
                      <option value="">اختر حساساً من القائمة...</option>
                      {triggerDevices.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({typeof d.room === 'object' && d.room ? (d.room as any).name : d.room})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTriggerDevice && (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                      {/* If temperature / humidity / energy / moisture sensor */}
                      {['sensor_temp', 'temperature', 'moisture', 'energy'].includes(selectedTriggerDevice.type?.toLowerCase() || '') ? (
                        <>
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1.5 font-bold">الشرط</label>
                            <select
                              value={newRule.triggerCondition || '>'}
                              onChange={(e) => setNewRule({ ...newRule, triggerCondition: e.target.value as any })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                            >
                              <option value=">">أكبر من (&gt;)</option>
                              <option value="<">أصغر من (&lt;)</option>
                              <option value="==" font-bold>يساوي (=)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1.5 font-bold">درجة الحرارة / القيمة</label>
                            <input
                              type="number"
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                              value={newRule.triggerValue || ''}
                              onChange={(e) => setNewRule({ ...newRule, triggerValue: parseFloat(e.target.value) })}
                              placeholder="مثال: 28"
                            />
                          </div>
                        </>
                      ) : (
                        /* If motion / door sensor or simple relay */
                        <div className="col-span-2">
                          <label className="block text-[10px] text-gray-400 mb-1.5 font-bold">الحالة المحفزة</label>
                          <select
                            value={newRule.triggerValue === 'ON' ? 'ON' : 'OFF'}
                            onChange={(e) => setNewRule({ ...newRule, triggerValue: e.target.value, triggerCondition: '==' })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                          >
                            <option value="ON">كشف حركة / فتح الباب (ON)</option>
                            <option value="OFF">هدوء / إغلاق الباب (OFF)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Action Execution */}
            <div className="space-y-4 pt-2">
              <label className="text-sm font-bold text-white block">3. ماذا يحدث؟ (الإجراء)</label>
              
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1.5 font-bold">الجهاز المستهدف</label>
                    <select
                      value={newRule.actionDeviceId || ''}
                      onChange={(e) => setNewRule({ ...newRule, actionDeviceId: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                    >
                      <option value="">اختر جهازاً للتحكم به...</option>
                      {devices.filter(d => !['sensor_temp', 'moisture', 'energy'].includes(d.type?.toLowerCase())).map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({typeof d.room === 'object' && d.room ? (d.room as any).name : d.room})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1.5 font-bold">حالة التشغيل المطلوبة</label>
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                      <button
                        type="button"
                        onClick={() => setNewRule({ ...newRule, actionState: 'ON' })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          newRule.actionState === 'ON'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-white/40 hover:text-white'
                        }`}
                      >
                        تشغيل (ON)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRule({ ...newRule, actionState: 'OFF' })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          newRule.actionState === 'OFF'
                            ? 'bg-red-600 text-white shadow-md'
                            : 'text-white/40 hover:text-white'
                        }`}
                      >
                        إطفاء (OFF)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 pt-4 border-t border-white/10">
              <button
                onClick={handleAdd}
                disabled={!newRule.name || !newRule.actionDeviceId}
                className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl text-sm transition-all disabled:opacity-50"
              >
                حفظ وتفعيل القاعدة التلقائية
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl text-sm transition-all"
              >
                إلغاء
              </button>
            </div>

          </div>
        </div>
      ) : (
        /* List Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {automationRules.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center bg-black/20 border border-dashed border-white/10 rounded-[2rem] text-center">
              <Activity size={48} className="text-white/20 mb-4 animate-pulse" />
              <p className="text-white/60 font-bold text-sm">لا توجد قواعد أتمتة مضافة حالياً.</p>
              <p className="text-white/30 text-xs mt-1">اضغط على "إنشاء قاعدة جديدة" بالأعلى لجعل المنزل يعمل من تلقاء نفسه.</p>
            </div>
          ) : (
            automationRules.map(rule => (
              <div 
                key={rule.id} 
                className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-3xl relative overflow-hidden group shadow-xl flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                      rule.enabled 
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]' 
                        : 'bg-white/5 border-white/5 text-white/30'
                    }`}>
                      {rule.triggerType === 'time' ? <Clock size={20} /> : <Activity size={20} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base">{rule.name}</h4>
                      <span className="text-[10px] text-white/40 block mt-0.5">قاعدة تلقائية نشطة</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 relative z-10">
                    <button
                      onClick={() => toggleAutomationRule(rule.id)}
                      className={`p-2 rounded-xl transition-all border ${
                        rule.enabled 
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                          : 'text-white/30 bg-white/5 border-white/5'
                      }`}
                      title={rule.enabled ? 'تعطيل القاعدة' : 'تفعيل القاعدة'}
                    >
                      <Power size={16} />
                    </button>
                    <button
                      onClick={() => removeAutomationRule(rule.id)}
                      className="p-2 rounded-xl text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/40">شرط التفعيل (IF):</span>
                    <span className="font-bold text-white">
                      {rule.triggerType === 'time' 
                        ? `الوقت = ${rule.triggerTime}`
                        : `${rule.triggerSensorType === 'temperature' ? 'درجة الحرارة' : rule.triggerSensorType === 'humidity' ? 'الرطوبة' : 'كشف حركة'} ${rule.triggerCondition} ${rule.triggerValue}`
                      }
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-white/40">الإجراء المنفذ (THEN):</span>
                    <span className={`font-bold px-3 py-1 rounded-full text-[10px] ${
                      rule.actionState === 'ON' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/10' 
                        : 'bg-red-500/20 text-red-400 border border-red-500/10'
                    }`}>
                      تغيير إلى {rule.actionState === 'ON' ? 'تشغيل' : 'إيقاف'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}