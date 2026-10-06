'use client';
import { useState } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';

export default function InviteUserModal({ onClose, onSuccess }: any) {
  const [username, setUsername] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [role, setRole] = useState('RESTRICTED_USER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (pinCode.length < 4) {
      setError('الرمز يجب أن يكون 4 أرقام على الأقل');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/users/invite', { username, pinCode, role });
      alert(res.data.inviteMessage || 'تم إنشاء المستخدم بنجاح');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'خطأ غير معروف');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" dir="rtl">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold text-zinc-100 mb-4">دعوة مستخدم جديد</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400">اسم المستخدم</label>
            <input required value={username} onChange={e => setUsername(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100" />
          </div>
          <div>
            <label className="text-sm text-zinc-400">الرمز السري (PIN Code)</label>
            <input type="password" required value={pinCode} onChange={e => setPinCode(e.target.value)} placeholder="مثال: 1234" className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 font-mono tracking-widest" />
          </div>
          <div>
            <label className="text-sm text-zinc-400">الصلاحية (الدور)</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100">
              <option value="RESTRICTED_USER">مستخدم محدود (الغرف المحددة فقط)</option>
              <option value="ADMIN">مدير النظام (وصول كامل)</option>
            </select>
          </div>
          
          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>إلغاء</Button>
            <Button type="submit" disabled={loading} className="bg-zinc-100 text-zinc-900 hover:bg-zinc-300">
              {loading ? 'جاري الحفظ...' : 'إنشاء المستخدم'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
