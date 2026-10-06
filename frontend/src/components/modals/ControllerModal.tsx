'use client';
import { useState } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';

export default function ControllerModal({ onClose, onSuccess, initialData }: any) {
  const [name, setName] = useState('');
  const [macAddress, setMacAddress] = useState(initialData?.mac || '');
  const [ipAddress, setIpAddress] = useState(initialData?.ip || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await api.post('/controllers', { name, macAddress, ipAddress });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'خطأ غير معروف');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" dir="rtl">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold text-zinc-100 mb-4">إضافة متحكم جديد</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400">اسم المتحكم (مثال: صالة 1)</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100" />
          </div>
          <div>
            <label className="text-sm text-zinc-400">عنوان MAC</label>
            <input required value={macAddress} onChange={e => setMacAddress(e.target.value)} placeholder="XX:XX:XX:XX:XX:XX" className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 font-mono" />
          </div>
          <div>
            <label className="text-sm text-zinc-400">عنوان IP (اختياري)</label>
            <input value={ipAddress} onChange={e => setIpAddress(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 font-mono" />
          </div>
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button type="submit">حفظ المتحكم</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
