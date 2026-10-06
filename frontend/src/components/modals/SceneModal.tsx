'use client';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';

const ICONS = ['🌙', '🏠', '🎬', '☀️', '🔒', '🔓', '🍽️', '🎮', '💼', '🏃'];

export default function SceneModal({ onClose, onSuccess, initialData = null }: any) {
  const [name, setName] = useState(initialData?.name || '');
  const [icon, setIcon] = useState(initialData?.icon || '🎬');
  const [actions, setActions] = useState<any[]>(initialData?.actions || []);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Schedule states
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDays, setScheduleDays] = useState<string[]>([]);
  const WEEK_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const WEEK_DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  useEffect(() => {
    api.get('/devices').then(res => setDevices(res.data)).catch(console.error);
  }, []);

  const addAction = () => {
    setActions([...actions, { type: 'device_control', deviceId: '', state: 'ON', mqttTopic: '' }]);
  };

  const updateAction = (index: number, field: string, value: any) => {
    const newActions = [...actions];
    newActions[index][field] = value;
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

  const toggleDay = (day: string) => {
    if (scheduleDays.includes(day)) {
      setScheduleDays(scheduleDays.filter(d => d !== day));
    } else {
      setScheduleDays([...scheduleDays, day]);
    }
  };

  const handleSubmit = async () => {
    if (!name) return setError('الرجاء إدخال اسم السيناريو');
    if (actions.length === 0) return setError('يجب إضافة فعل واحد على الأقل');

    setLoading(true);
    try {
      // 1. Create Scene
      const res = await api.post('/scenes', { name, actions, icon });
      const newSceneId = res.data.id;

      // 2. Add Schedule if enabled
      if (enableSchedule && scheduleTime) {
        await api.post(`/scenes/${newSceneId}/schedule`, {
          time: scheduleTime,
          days: scheduleDays.length > 0 ? scheduleDays : WEEK_DAYS
        });
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
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-zinc-100 mb-6">
          {initialData ? 'تعديل السيناريو' : 'سيناريو جديد'}
        </h2>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <label className="text-sm text-zinc-400">اسم السيناريو</label>
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="مثال: وضع النوم" className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100" />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">الأيقونة</label>
              <div className="relative">
                <select value={icon} onChange={e => setIcon(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 text-center appearance-none text-xl">
                  {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500">▼</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-zinc-100 font-medium">الأفعال (الأجهزة التي سيتم التحكم بها)</h3>
              <Button variant="outline" size="sm" onClick={addAction} className="text-xs border-zinc-700 hover:bg-zinc-800">
                <Plus size={14} className="ml-1" /> إضافة فعل
              </Button>
            </div>

            {actions.length === 0 && (
              <div className="text-center p-6 border border-dashed border-zinc-800 rounded-lg text-zinc-500">
                لم تقم بإضافة أجهزة.
              </div>
            )}

            {actions.map((act, idx) => (
              <div key={idx} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex items-center gap-3 relative pr-10">
                <button onClick={() => removeAction(idx)} className="absolute right-3 text-zinc-500 hover:text-red-400">
                  <Trash2 size={16} />
                </button>
                
                <div className="grid grid-cols-2 gap-3 flex-1">
                  <select value={act.deviceId} onChange={e => updateAction(idx, 'deviceId', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200">
                    <option value="">اختر الجهاز...</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select value={act.state} onChange={e => updateAction(idx, 'state', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-200">
                    <option value="ON">تشغيل (ON)</option>
                    <option value="OFF">إطفاء (OFF)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Scheduling (Optional) */}
          <div className="border border-zinc-800 p-4 rounded-lg bg-zinc-950/50">
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input type="checkbox" checked={enableSchedule} onChange={e => setEnableSchedule(e.target.checked)} className="rounded border-zinc-700 bg-zinc-900 text-blue-600" />
              <span className="text-zinc-300 font-medium">جدولة السيناريو (تشغيل تلقائي)</span>
            </label>

            {enableSchedule && (
              <div className="space-y-4 pt-2 border-t border-zinc-800">
                <div>
                  <label className="text-sm text-zinc-400 block mb-2">وقت التشغيل</label>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded p-2 text-zinc-200" />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 block mb-2">الأيام</label>
                  <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map((day, i) => (
                      <button 
                        key={day} 
                        type="button" 
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors ${scheduleDays.includes(day) ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                      >
                        {WEEK_DAYS_AR[i]}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">إذا لم تحدد أياماً، سيعمل يومياً.</p>
                </div>
              </div>
            )}
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-zinc-800">
          <Button variant="ghost" onClick={onClose} disabled={loading}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'جاري الحفظ...' : 'حفظ السيناريو'}
          </Button>
        </div>
      </div>
    </div>
  );
}
