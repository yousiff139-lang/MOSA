import { useState } from 'react';
import { Cpu, X } from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';

export default function AddNodeModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void, onSuccess?: () => void }) {
  const [name, setName] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const finalMac = macAddress.trim() || `00:MOSA:${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
      const res = await fetchAuth('/api/controllers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, macAddress: finalMac, ipAddress: ipAddress || undefined })
      });
      
      if (res.ok) {
        alert('تمت إضافة العقدة (ESP) بنجاح!');
        setName('');
        setMacAddress('');
        setIpAddress('');
        onClose();
        if (onSuccess) onSuccess();
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
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-fade-up">
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Cpu size={20} />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">إضافة عقدة ESP جديدة</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-800 p-2 rounded-full">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">اسم العقدة (مثال: لوحة الصالة)</label>
            <input 
              type="text" 
              required 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" 
              dir="rtl" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">عنوان MAC (اختياري)</label>
            <input 
              type="text" 
              placeholder="AA:BB:CC:DD:EE:FF"
              value={macAddress} 
              onChange={e => setMacAddress(e.target.value.toUpperCase())} 
              className="w-full font-mono bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" 
              dir="ltr" 
            />
            <p className="text-xs text-slate-500 mt-2">يستخدم النظام عنوان MAC للتعرف التلقائي على اللوحة فور اتصالها بالشبكة.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">عنوان IP (اختياري)</label>
            <input 
              type="text" 
              placeholder="192.168.1.xxx"
              value={ipAddress} 
              onChange={e => setIpAddress(e.target.value)} 
              className="w-full font-mono bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" 
              dir="ltr" 
            />
          </div>
          
          <div className="pt-6">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all text-white font-bold flex justify-center items-center gap-2"
            >
              {loading ? 'جاري الإضافة...' : 'حفظ اللوحة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
