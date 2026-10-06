'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function MfaSetupPage() {
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Fetch MFA setup details
    const fetchMfaSetup = async () => {
      try {
        const res = await fetch('/api/auth/mfa/setup', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        setSecret(data.secret);
        setQrCode(data.qrCodeUrl);
      } catch (e) {
        setError('فشل جلب بيانات المصادقة');
      }
    };
    fetchMfaSetup();
  }, []);

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ code })
      });
      
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'رمز خاطئ');
      }
    } catch (e) {
      setError('خطأ في الاتصال');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/20 blur-[60px] rounded-full pointer-events-none"></div>

        <div className="text-center mb-8 relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4 border border-emerald-500/20">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">تفعيل المصادقة الثنائية</h2>
          <p className="text-sm text-slate-400">
            قم بمسح الكود باستخدام تطبيق Google Authenticator لزيادة حماية حسابك.
          </p>
        </div>

        <div className="space-y-6 relative z-10">
          <div className="flex justify-center bg-white p-4 rounded-xl border-4 border-slate-800 mx-auto w-48 h-48">
            {/* Fallback box since we mock QR in API */}
            <div className="w-full h-full bg-slate-200 border-2 border-dashed border-slate-400 flex items-center justify-center">
              <span className="text-slate-500 text-xs font-medium text-center">QR Code<br/>(Mocked)</span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-slate-500 mb-1 uppercase tracking-widest">المفتاح السري</p>
            <p className="font-mono text-emerald-400 bg-emerald-500/10 py-2 rounded-lg border border-emerald-500/20 tracking-wider">
              {secret || 'LOADING...'}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <label className="block text-sm font-medium text-slate-300 mb-2 text-center">أدخل الرمز المكون من 6 أرقام</label>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="block w-full py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="000000"
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] disabled:opacity-50 flex justify-center items-center gap-2 group"
          >
            {loading ? 'جاري التحقق...' : 'تأكيد الرمز'}
            {!loading && <ArrowRight className="w-4 h-4 group-hover:-translate-x-1 transition-transform rtl:rotate-180" />}
          </button>
        </div>
      </div>
    </div>
  );
}
