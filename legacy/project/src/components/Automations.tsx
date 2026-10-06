import { useState } from 'react';
import { useSmartHomeStore } from '../store/useSmartHomeStore';
import { Clock, Activity, Plus, Trash2, Power } from 'lucide-react';
import { AutomationRule } from '../types';

export function Automations() {
  const { automationRules, addAutomationRule, removeAutomationRule, toggleAutomationRule, devices } = useSmartHomeStore();
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
    name: '',
    enabled: true,
    triggerType: 'time',
    triggerCondition: '>',
    actionState: 'ON',
    logicOperator: 'NONE',
    secondarySensorType: 'temperature',
    secondaryCondition: '>'
  });

  const handleAdd = () => {
    if (!newRule.name || !newRule.actionDeviceId || !newRule.actionBoardId) return;

    addAutomationRule({
      ...newRule,
      id: Date.now().toString()
    } as AutomationRule);
    setActiveTab('list');
    setNewRule({ name: '', enabled: true, triggerType: 'time', triggerCondition: '>', actionState: 'ON', logicOperator: 'NONE', secondarySensorType: 'temperature', secondaryCondition: '>' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-white/10 pb-6 gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white drop-shadow-md mb-2">الأتمتة والقواعد</h2>
          <p className="text-sm text-gray-500">اجعل منزلك يعمل من تلقاء نفسه بناءً على الوقت أو الحساسات</p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide w-full md:w-auto">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'list'
              ? 'bg-primary text-white shadow-lg shadow-primary/30'
              : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            <Activity size={18} className={activeTab === 'list' ? "text-white" : "text-gray-400 dark:text-gray-500"} />
            القواعد الحالية
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'create'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
              : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            <Plus size={18} className={activeTab === 'create' ? "text-white" : "text-gray-400 dark:text-gray-500"} />
            إضافة قاعدة جديدة
          </button>
        </div>
      </header>

      <div className="animate-fade-in relative">
        {activeTab === 'create' && (
          <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-xl glow-primary">
            <div className="flex justify-between items-start mb-8 border-b border-white/10 pb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">إنشاء قاعدة جديدة</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">حدد الشروط والإجراءات المطلوبة لتنفيذ الأتمتة</p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                <Plus size={24} className="text-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">اسم القاعدة</label>
                  <input
                    type="text"
                    className="w-full p-4 rounded-2xl bg-black/5 dark:bg-black/30 border border-white/10 focus:ring-2 ring-primary outline-none transition-colors"
                    placeholder="مثال: تشغيل النور ليلاً"
                    value={newRule.name}
                    onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">نوع المحفز (Trigger)</label>
                  <select
                    className="w-full p-4 rounded-2xl bg-black/5 dark:bg-black/30 border border-white/10 focus:ring-2 ring-primary outline-none transition-colors appearance-none cursor-pointer"
                    value={newRule.triggerType}
                    onChange={e => setNewRule({ ...newRule, triggerType: e.target.value as 'time' | 'sensor' })}
                  >
                    <option value="time" className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">وقت محدد (ساعة/دقيقة)</option>
                    <option value="sensor" className="text-gray-900 dark:text-white bg-slate-100 dark:bg-slate-800">قراءة حساس (حرارة/حركة/طاقة)</option>
                  </select>
                </div>

                {newRule.triggerType === 'time' ? (
                  <div>
                    <label className="block text-sm font-semibold mb-2">الوقت (HH:MM)</label>
                    <input
                      type="time"
                      className="w-full p-4 rounded-2xl bg-black/5 dark:bg-black/30 border border-white/10 focus:ring-2 ring-primary outline-none transition-colors"
                      value={newRule.triggerTime || ''}
                      onChange={e => setNewRule({ ...newRule, triggerTime: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">الحساس</label>
                      <select
                        className="w-full p-4 rounded-2xl bg-black/5 dark:bg-black/30 border border-white/10 outline-none appearance-none cursor-pointer"
                        value={newRule.triggerSensorType || 'temperature'}
                        onChange={e => setNewRule({ ...newRule, triggerSensorType: e.target.value as any })}
                      >
                        <option value="temperature" className="bg-slate-100 dark:bg-slate-800">الحرارة</option>
                        <option value="humidity" className="bg-slate-100 dark:bg-slate-800">الرطوبة</option>
                        <option value="motion" className="bg-slate-100 dark:bg-slate-800">الحركة</option>
                        <option value="power" className="bg-slate-100 dark:bg-slate-800">استهلاك الطاقة (واط)</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="w-1/3 p-4 rounded-2xl bg-black/5 dark:bg-black/30 border border-white/10 outline-none appearance-none cursor-pointer"
                        value={newRule.triggerCondition || '>'}
                        onChange={e => setNewRule({ ...newRule, triggerCondition: e.target.value as any })}
                      >
                        <option value=">" className="bg-slate-100 dark:bg-slate-800">أكبر من</option>
                        <option value="<" className="bg-slate-100 dark:bg-slate-800">أصغر من</option>
                        <option value="==" className="bg-slate-100 dark:bg-slate-800">يساوي</option>
                      </select>
                      <input
                        type="number"
                        className="w-2/3 p-4 rounded-2xl bg-black/5 dark:bg-black/30 border border-white/10 outline-none"
                        placeholder="القيمة"
                        value={newRule.triggerValue as number || ''}
                        onChange={e => setNewRule({ ...newRule, triggerValue: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-white/10 mt-4">
                  <label className="block text-sm font-semibold mb-2">شرط إضافي (متقدم)</label>
                  <select
                    className="w-full p-4 rounded-2xl bg-black/5 dark:bg-black/30 border border-white/10 focus:ring-2 ring-primary outline-none appearance-none cursor-pointer mb-4"
                    value={newRule.logicOperator || 'NONE'}
                    onChange={e => setNewRule({ ...newRule, logicOperator: e.target.value as any })}
                  >
                    <option value="NONE" className="bg-slate-100 dark:bg-slate-800">بدون شرط إضافي</option>
                    <option value="AND" className="bg-slate-100 dark:bg-slate-800">وَ (AND) - يجب تحقق الشرطين معاً</option>
                    <option value="OR" className="bg-slate-100 dark:bg-slate-800">أو (OR) - يكفي تحقق أحد الشرطين</option>
                  </select>

                  {newRule.logicOperator !== 'NONE' && (
                    <div className="space-y-4 animate-fade-in bg-primary/5 p-4 rounded-2xl border border-primary/20">
                      <div>
                        <label className="block text-sm font-semibold mb-2">الحساس الإضافي</label>
                        <select
                          className="w-full p-4 rounded-2xl bg-black/5 dark:bg-white/10 border border-white/10 outline-none appearance-none cursor-pointer"
                          value={newRule.secondarySensorType || 'temperature'}
                          onChange={e => setNewRule({ ...newRule, secondarySensorType: e.target.value as any })}
                        >
                          <option value="temperature" className="bg-slate-100 dark:bg-slate-800">الحرارة</option>
                          <option value="humidity" className="bg-slate-100 dark:bg-slate-800">الرطوبة</option>
                          <option value="power" className="bg-slate-100 dark:bg-slate-800">استهلاك الطاقة (واط)</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <select
                          className="w-1/3 p-4 rounded-2xl bg-black/5 dark:bg-white/10 border border-white/10 outline-none appearance-none cursor-pointer"
                          value={newRule.secondaryCondition || '>'}
                          onChange={e => setNewRule({ ...newRule, secondaryCondition: e.target.value as any })}
                        >
                          <option value=">" className="bg-slate-100 dark:bg-slate-800">أكبر من</option>
                          <option value="<" className="bg-slate-100 dark:bg-slate-800">أصغر من</option>
                          <option value="==" className="bg-slate-100 dark:bg-slate-800">يساوي</option>
                        </select>
                        <input
                          type="number"
                          className="w-2/3 p-4 rounded-2xl bg-black/5 dark:bg-white/10 border border-white/10 outline-none"
                          placeholder="القيمة"
                          value={newRule.secondaryValue as number || ''}
                          onChange={e => setNewRule({ ...newRule, secondaryValue: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">الجهاز المستهدف (Action)</label>
                  <select
                    className="w-full p-4 rounded-2xl bg-black/5 dark:bg-black/30 border border-white/10 focus:ring-2 ring-primary outline-none appearance-none cursor-pointer"
                    value={`${newRule.actionBoardId}|${newRule.actionDeviceId}`}
                    onChange={e => {
                      const [boardId, deviceId] = e.target.value.split('|');
                      setNewRule({ ...newRule, actionBoardId: boardId, actionDeviceId: parseInt(deviceId) });
                    }}
                  >
                    <option value="" className="bg-slate-100 dark:bg-slate-800">اختر جهازاً...</option>
                    {devices.map(d => (
                      <option key={`${d.boardId}-${d.id}`} value={`${d.boardId}|${d.id}`} className="bg-slate-100 dark:bg-slate-800">{d.name} ({d.room})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">حالة الجهاز (ON/OFF)</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setNewRule({ ...newRule, actionState: 'ON' })}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-all ${newRule.actionState === 'ON' ? 'bg-primary text-white shadow-[0_0_15px_rgba(var(--color-primary),0.5)]' : 'bg-black/10 dark:bg-black/30 text-gray-500'}`}
                    >
                      تشغيل (ON)
                    </button>
                    <button
                      onClick={() => setNewRule({ ...newRule, actionState: 'OFF' })}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-all ${newRule.actionState === 'OFF' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-black/10 dark:bg-black/30 text-gray-500'}`}
                    >
                      إطفاء (OFF)
                    </button>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={handleAdd}
                    disabled={!newRule.name || !newRule.actionDeviceId}
                    className="w-full bg-blue-600/80 backdrop-blur-md hover:bg-primary disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all"
                  >
                    حفظ القاعدة
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-xl">
            <div className="flex justify-between items-start mb-8 border-b border-white/10 pb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">القواعد الحالية</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">إدارة قواعد الأتمتة المحفوظة في النظام</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                <Activity size={24} className="text-primary" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {automationRules.length === 0 ? (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-white/10 rounded-2xl">
                  <p className="text-gray-500 font-medium">لا توجد قواعد أتمتة مضافة حالياً. ابدأ بإضافة قاعدة جديدة!</p>
                </div>
              ) : (
                automationRules.map(rule => (
                  <div key={rule.id} className="bg-black/5 dark:bg-white/5 p-6 rounded-2xl border border-white/10 relative transition-all hover:border-primary/50 group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${rule.enabled ? 'bg-primary/20 text-primary' : 'bg-black/10 dark:bg-white/10 text-gray-500'}`}>
                          {rule.triggerType === 'time' ? <Clock size={20} /> : <Activity size={20} />}
                        </div>
                        <h4 className="font-bold text-lg text-gray-900 dark:text-white">{rule.name}</h4>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleAutomationRule(rule.id)}
                          className={`p-2 rounded-lg transition-colors ${rule.enabled ? 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-gray-400 bg-black/5 dark:bg-white/5 hover:bg-black/10'}`}
                          title={rule.enabled ? 'تفعيل' : 'تعطيل'}
                        >
                          <Power size={18} />
                        </button>
                        <button
                          onClick={() => removeAutomationRule(rule.id)}
                          className="p-2 rounded-lg text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 mt-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 font-bold">الشرط (Trigger):</span>
                        <div className="text-right flex flex-col items-end">
                          <span className="font-semibold text-gray-900 dark:text-gray-200">
                            {rule.triggerType === 'time'
                              ? `الوقت = ${rule.triggerTime}`
                              : `${rule.triggerSensorType} ${rule.triggerCondition} ${rule.triggerValue}`
                            }
                          </span>
                          {rule.logicOperator && rule.logicOperator !== 'NONE' && (
                            <span className="text-xs text-primary font-bold mt-1 bg-primary/10 px-2 py-1 rounded-md">
                              {rule.logicOperator === 'AND' ? 'وَ (AND) ' : 'أو (OR) '}
                              {`${rule.secondarySensorType} ${rule.secondaryCondition} ${rule.secondaryValue}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-white/5">
                        <span className="text-gray-500 font-bold">النتيجة (Action):</span>
                        <span className={`font-bold px-2 py-1 rounded-md ${rule.actionState === 'ON' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                          تغيير إلى {rule.actionState}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}