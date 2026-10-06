'use client';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';

export default function PinMappingModal({ controllers, onClose, onSuccess }: any) {
  const [name, setName] = useState('');
  const [type, setType] = useState('LIGHT');
  const [pinNumber, setPinNumber] = useState(0);
  const [pinMode, setPinMode] = useState('OUTPUT');
  const [controllerId, setControllerId] = useState(controllers[0]?.id || '');
  const [roomId, setRoomId] = useState('');
  const [mqttTopic, setMqttTopic] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/rooms').then(res => setRooms(res.data)).catch(console.error);
  }, []);

  // Auto-generate MQTT Topic
  useEffect(() => {
    const room = rooms.find(r => r.id === roomId);
    const roomSlug = room ? room.name.toLowerCase().replace(/ /g, '_') : 'unassigned';
    const deviceSlug = name ? name.toLowerCase().replace(/ /g, '_') : 'device';
    setMqttTopic(`mosa/${roomSlug}/${deviceSlug}`);
  }, [name, roomId, rooms]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await api.post('/devices', { name, type, pinNumber: Number(pinNumber), pinMode, mqttTopic, controllerId, roomId });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'خطأ غير معروف');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" dir="rtl">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-zinc-100 mb-4">ربط جهاز جديد</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400">اسم الجهاز</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100" />
            </div>
            <div>
              <label className="text-sm text-zinc-400">نوع الجهاز</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100">
                <option value="LIGHT">إضاءة (LIGHT)</option>
                <option value="SOCKET">مقبس (SOCKET)</option>
                <option value="SENSOR_TEMP">حرارة (SENSOR_TEMP)</option>
                <option value="SENSOR_MOTION">حركة (SENSOR_MOTION)</option>
                <option value="CLIMATE">مكيف (CLIMATE)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400">رقم المنفذ (Pin 0-40)</label>
              <input type="number" min={0} max={40} required value={pinNumber} onChange={e => setPinNumber(Number(e.target.value))} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100" />
            </div>
            <div>
              <label className="text-sm text-zinc-400">وضع المنفذ (Mode)</label>
              <select value={pinMode} onChange={e => setPinMode(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100">
                <option value="OUTPUT">إخراج (OUTPUT)</option>
                <option value="INPUT">إدخال (INPUT)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400">المتحكم (ESP32)</label>
              <select required value={controllerId} onChange={e => setControllerId(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100">
                {controllers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-zinc-400">الغرفة</label>
              <select required value={roomId} onChange={e => setRoomId(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100">
                <option value="">اختر الغرفة...</option>
                {rooms.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-zinc-400">موضوع MQTT (قابل للتعديل)</label>
            <input required value={mqttTopic} onChange={e => setMqttTopic(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 font-mono text-sm" dir="ltr" />
          </div>
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button type="submit">إضافة الجهاز</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
