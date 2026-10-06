import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';

export default function QuickAddUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [username, setUsername] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetchAuth('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pinCode, role: 'RESTRICTED_USER' })
      });
      
      if (res.ok) {
        alert('تمت إضافة المستخدم بنجاح! يمكنه الآن تسجيل الدخول بهذا الاسم والرمز السري.');
        setUsername('');
        setPinCode('');
        onClose();
      } else {
        const err = await res.json();
        alert(err.message || 'حدث خطأ أثناء الإضافة');
      }
    } catch (e) {
      alert('خطأ في الاتصال');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(99,102,241,0.15)] animate-fade-up">
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">إضافة فرد للعائلة</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-800 p-2 rounded-full">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">الاسم (يستخدم لتسجيل الدخول)</label>
            <input 
              type="text" 
              required 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="مثال: Ali, Sara"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
              dir="ltr" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">الرمز السري الدائم (٤ أرقام)</label>
            <input 
              type="password" 
              required 
              minLength={4} 
              maxLength={8}
              value={pinCode} 
              onChange={e => setPinCode(e.target.value)} 
              placeholder="****"
              className="w-full text-center tracking-[1em] font-mono text-2xl bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
              dir="ltr" 
            />
          </div>
          
          <div className="pt-6">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all text-white font-bold flex justify-center items-center gap-2"
            >
              {loading ? 'جاري الإضافة...' : 'إضافة الحساب الآن'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
