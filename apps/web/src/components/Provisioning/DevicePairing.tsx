'use client';
import { useState } from 'react';

export default function DevicePairing() {
  const [macAddress, setMacAddress] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateCode = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/devices/provision/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ macAddress })
      });
      const data = await res.json();
      if (res.ok) {
        setPairingCode(data.pairingCode);
        setExpiresAt(new Date(data.expiresAt));
      } else {
        setError(data.error || 'فشل توليد رمز الإقران');
      }
    } catch (err) {
      setError('خطأ في الاتصال بالخادم');
    }
    setLoading(false);
  };

  return (
    <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 text-white shadow-2xl max-w-md w-full">
      <h2 className="text-2xl font-bold mb-4 text-emerald-400">إضافة جهاز جديد</h2>
      <p className="text-sm text-slate-400 mb-6">يرجى إدخال عنوان الـ MAC الخاص بالجهاز لتوليد رمز الإقران الآمن.</p>
      
      {!pairingCode ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">MAC Address</label>
            <input 
              type="text" 
              placeholder="00:1B:44:11:3A:B7"
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button 
            onClick={generateCode}
            disabled={loading || !macAddress}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors"
          >
            {loading ? 'جاري التوليد...' : 'توليد الرمز'}
          </button>
        </div>
      ) : (
        <div className="text-center space-y-6 animate-fade-in">
          <div className="bg-slate-950 p-6 rounded-xl border border-emerald-900/50">
            <p className="text-slate-400 text-sm mb-2">رمز الإقران الخاص بجهازك</p>
            <p className="text-5xl font-mono font-bold tracking-widest text-emerald-400">{pairingCode}</p>
          </div>
          <p className="text-xs text-slate-500">
            هذا الرمز صالح للاستخدام مرة واحدة وينتهي صلاحيته في:
            <br/>
            <span className="text-slate-300">{expiresAt?.toLocaleTimeString()}</span>
          </p>
          <button 
            onClick={() => setPairingCode(null)}
            className="text-emerald-400 hover:text-emerald-300 text-sm underline"
          >
            إضافة جهاز آخر
          </button>
        </div>
      )}
    </div>
  );
}
