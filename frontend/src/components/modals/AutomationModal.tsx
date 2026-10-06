'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';

export default function AutomationModal({ onClose, onSuccess, initialData = null }: any) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.conditions?.length > 0 ? 'AUTOMATION' : 'SCENE');
  
  const [conditions, setConditions] = useState<any[]>(initialData?.conditions || []);
  const [actions, setActions] = useState<any[]>(initialData?.actions || []);
  
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    api.get('/devices').then(res => setDevices(res.data)).catch(console.error);
  }, []);

  const addCondition = () => {
    setConditions([...conditions, { type: 'device_state', deviceId: '', state: 'ON' }]);
  };

  const updateCondition = (index: number, field: string, value: any) => {
    const newConds = [...conditions];
    newConds[index][field] = value;
    setConditions(newConds);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addAction = () => {
    setActions([...actions, { type: 'device_control', deviceId: '', state: 'ON', mqttTopic: '' }]);
  };

  const updateAction = (index: number, field: string, value: any) => {
    const newActions = [...actions];
    newActions[index][field] = value;
    
    // Auto-fill mqttTopic if device selected
    if (field === 'deviceId' && value) {
      const dev = devices.find(d => d.id === value);
      if (dev && dev.state?.mqttTopic) {
        newActions[index].mqttTopic = dev.state.mqttTopic;
      }
    }
    
    setActions(newActions);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name) return setError('الرجاء إدخال اسم الأتمتة');
    if (actions.length === 0) return setError('يجب إضافة فعل واحد على الأقل');
    if (type === 'AUTOMATION' && conditions.length === 0) return setError('يجب إضافة شرط واحد على الأقل للأتمتة');

    setLoading(true);
    try {
      const payload = {
        name,
        conditions: type === 'AUTOMATION' ? conditions : null,
        actions,
        isActive: true
      };

      if (initialData?.id) {
        await api.patch(`/automations/${initialData.id}`, payload);
      } else {
        await api.post('/automations', payload);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <h2 className="text-xl font-bold text-zinc-100 mb-6">
          {initialData ? 'تعديل الأتمتة' : 'قاعدة أتمتة جديدة'}
        </h2>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <label className="text-sm text-zinc-400">اسم القاعدة</label>
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="مثال: تشغيل الإضاءة عند الحركة" className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100" />
              </div>
              <div>
                <label className="text-sm text-zinc-400">نوع القاعدة</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100">
                  <option value="AUTOMATION">أتمتة (شرط ← فعل)</option>
                  <option value="SCENE">سيناريو مباشر (بدون شرط)</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Conditions */}
          {step === 2 && type === 'AUTOMATION' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-zinc-100 font-medium">الشروط (إذا حدث...)</h3>
                <Button variant="outline" size="sm" onClick={addCondition} className="text-xs border-zinc-700 hover:bg-zinc-800">
                  <Plus size={14} className="ml-1" /> إضافة شرط
                </Button>
              </div>

              {conditions.length === 0 && (
                <div className="text-center p-8 border border-dashed border-zinc-800 rounded-lg text-zinc-500">
                  لم تقم بإضافة أي شروط.
                </div>
              )}

              {conditions.map((cond, idx) => (
                <div key={idx} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex flex-col gap-3 relative">
                  <button onClick={() => removeCondition(idx)} className="absolute top-2 left-2 text-zinc-500 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={cond.type} onChange={e => updateCondition(idx, 'type', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200">
                      <option value="device_state">حالة جهاز (مفتاح، إضاءة)</option>
                      <option value="sensor_value">قيمة حساس (حرارة، رطوبة)</option>
                      <option value="time">وقت محدد</option>
                    </select>
                    
                    {cond.type === 'device_state' && (
                      <select value={cond.deviceId} onChange={e => updateCondition(idx, 'deviceId', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200">
                        <option value="">اختر الجهاز...</option>
                        {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    )}
                    
                    {cond.type === 'time' && (
                      <input type="time" value={cond.time || ''} onChange={e => updateCondition(idx, 'time', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200" />
                    )}

                    {cond.type === 'sensor_value' && (
                      <select value={cond.operator} onChange={e => updateCondition(idx, 'operator', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200">
                        <option value=">">أكبر من</option>
                        <option value="<">أصغر من</option>
                        <option value="==">يساوي</option>
                      </select>
                    )}
                  </div>

                  {cond.type === 'device_state' && (
                    <select value={cond.state} onChange={e => updateCondition(idx, 'state', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200 mt-2">
                      <option value="ON">تعمل (ON)</option>
                      <option value="OFF">مطفأة (OFF)</option>
                    </select>
                  )}

                  {cond.type === 'sensor_value' && (
                    <input type="number" placeholder="القيمة المطلوبة (مثال: 30)" value={cond.value || ''} onChange={e => updateCondition(idx, 'value', Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200 mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Actions */}
          {(step === 3 || (step === 2 && type === 'SCENE')) && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-zinc-100 font-medium">الأفعال (قم بـ...)</h3>
                <Button variant="outline" size="sm" onClick={addAction} className="text-xs border-zinc-700 hover:bg-zinc-800">
                  <Plus size={14} className="ml-1" /> إضافة فعل
                </Button>
              </div>

              {actions.length === 0 && (
                <div className="text-center p-8 border border-dashed border-zinc-800 rounded-lg text-zinc-500">
                  لم تقم بإضافة أي أفعال.
                </div>
              )}

              {actions.map((act, idx) => (
                <div key={idx} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex flex-col gap-3 relative">
                  <button onClick={() => removeAction(idx)} className="absolute top-2 left-2 text-zinc-500 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                  
                  <select value={act.type} onChange={e => updateAction(idx, 'type', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200">
                    <option value="device_control">تحكم بجهاز</option>
                    <option value="notification">إرسال إشعار</option>
                  </select>

                  {act.type === 'device_control' && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <select value={act.deviceId} onChange={e => updateAction(idx, 'deviceId', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200">
                        <option value="">اختر الجهاز...</option>
                        {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <select value={act.state} onChange={e => updateAction(idx, 'state', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200">
                        <option value="ON">تشغيل</option>
                        <option value="OFF">إطفاء</option>
                      </select>
                    </div>
                  )}

                  {act.type === 'notification' && (
                    <input type="text" placeholder="محتوى الإشعار" value={act.message || ''} onChange={e => updateAction(idx, 'message', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200 mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">{error}</div>}
        </div>

        <div className="flex justify-between items-center pt-6 mt-6 border-t border-zinc-800">
          <Button variant="ghost" onClick={onClose} disabled={loading}>إلغاء</Button>
          
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={loading}>السابق</Button>
            )}
            
            {(step < 3 && type === 'AUTOMATION') || (step < 2 && type === 'SCENE') ? (
              <Button onClick={() => { setError(''); setStep(step + 1); }} className="bg-zinc-100 text-zinc-900">التالي</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                {loading ? 'جاري الحفظ...' : 'حفظ القاعدة'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
