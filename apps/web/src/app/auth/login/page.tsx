'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, Eye, EyeOff, ShieldCheck, Sparkles, Activity, CheckCircle2 } from 'lucide-react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const router = useRouter();

  const [branding, setBranding] = useState<any>(null);

  useEffect(() => {
    // Check for QR Token in URL query params for instant camera scan login
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const qrToken = urlParams.get('qr_token') || urlParams.get('token');
      if (qrToken && qrToken.startsWith('mosa_qr_')) {
        setLoading(true);
        fetch('/api/auth/qr-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: qrToken })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.accessToken) {
              const PERM_MAX_AGE = 100 * 365 * 24 * 60 * 60;
              localStorage.setItem('token', data.accessToken);
              document.cookie = `token=${data.accessToken}; path=/; max-age=${PERM_MAX_AGE}; SameSite=Lax`;
              document.cookie = `access_token=${data.accessToken}; path=/; max-age=${PERM_MAX_AGE}; SameSite=Lax`;
              if (data.user) {
                localStorage.setItem('mosa_ui_mode', 'full');
                useSmartHomeStore.getState().setUiMode('full');
                useSmartHomeStore.getState().setUser(data.user);
              }
              useSmartHomeStore.getState().initBackendConnection();
              router.push('/');
            } else {
              setError(data.error || 'رمز الباركود غير صالح أو انتهت صلاحيته');
              setLoading(false);
            }
          })
          .catch(() => {
            setError('تعذر تسجيل الدخول عبر الباركود');
            setLoading(false);
          });
      }
    }

    // Check if system is initialized, redirect to setup if not
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => {
        if (!data.isInitialized) {
          router.push('/setup');
        }
      })
      .catch(() => {});

    fetch('/api/branding')
      .then(res => res.json())
      .then(data => {
        setBranding(data);
        document.title = `تسجيل الدخول - ${data.platformName || 'Mosa Smart Platform'}`;
        if (data.colorPrimary) {
          document.documentElement.style.setProperty('--primary', data.colorPrimary);
          document.documentElement.style.setProperty('--color-primary', data.colorPrimary);
          document.documentElement.style.setProperty('--primary-glow', data.colorPrimary + '80');
        }
      })
      .catch(err => {
        console.error('Failed to load branding', err);
        document.title = "تسجيل الدخول - Mosa Smart Platform";
      });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, pinCode })
      });
      const data = await res.json();

      if (res.ok) {
        if (data.requiresMfa) {
          setTempToken(data.tempToken);
          setRequiresMfa(true);
        } else {
          const PERM_MAX_AGE = 100 * 365 * 24 * 60 * 60;
          localStorage.setItem('token', data.accessToken);
          document.cookie = `token=${data.accessToken}; path=/; max-age=${PERM_MAX_AGE}; SameSite=Lax`;
          document.cookie = `access_token=${data.accessToken}; path=/; max-age=${PERM_MAX_AGE}; SameSite=Lax`;
          if (data.user) {
            localStorage.setItem('mosa_user', JSON.stringify(data.user));
            useSmartHomeStore.getState().setUser(data.user);
            const role = (data.user.role || '').toUpperCase();
            if (role === 'SUPER_OWNER' || role === 'ADMIN' || role === 'OWNER') {
              localStorage.setItem('mosa_ui_mode', 'full');
              useSmartHomeStore.getState().setUiMode('full');
            }
          }
          useSmartHomeStore.getState().initBackendConnection();
          if (data.user?.mustChangePin) {
            window.location.href = '/settings/security?force=true';
          } else {
            window.location.href = '/';
          }
        }
      } else {
        setError(data.error || 'اسم المستخدم أو رمز الدخول غير صحيح');
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم. يرجى التحقق من اتصال الشبكة.');
    }
    setLoading(false);
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tempToken, mfaCode })
      });
      const data = await res.json();

      if (res.ok) {
        const PERM_MAX_AGE = 100 * 365 * 24 * 60 * 60;
        localStorage.setItem('token', data.accessToken);
        document.cookie = `token=${data.accessToken}; path=/; max-age=${PERM_MAX_AGE}; SameSite=Lax`;
        useSmartHomeStore.getState().initBackendConnection();
        if (data.user?.mustChangePin) {
          router.push('/settings/security?force=true');
        } else {
          router.push('/dashboard');
        }
      } else {
        setError(data.error || 'رمز التحقق غير صحيح');
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم. يرجى المحاولة لاحقاً.');
    }
    setLoading(false);
  };

  const primaryColor = branding?.colorPrimary || '#00f0ff';

  return (
    <div 
      className="min-h-[100dvh] w-full flex items-center justify-center p-4 relative overflow-hidden bg-[#070d1a]"
      dir="rtl"
    >
      {/* ── Ambient Glowing Background Atmosphere (GPU-Optimized Static Mesh) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full blur-[90px] opacity-40 bg-cyan-500/30" />
        <div className="absolute top-[20%] -right-[10%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full blur-[100px] opacity-35 bg-blue-600/30" />
        <div className="absolute -bottom-[15%] left-[25%] w-[60vw] h-[60vw] max-w-[750px] max-h-[750px] rounded-full blur-[110px] opacity-30 bg-purple-600/25" />
        <div className="absolute inset-0 bg-cyber-dots opacity-20" />
      </div>

      {/* ── Main Centered Login Card ── */}
      <div className="w-full max-w-[440px] relative z-10 my-auto">
        <div className="bg-[#0b1324]/85 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative overflow-hidden">
          
          {/* Top Neon Accent Glow Line */}
          <div 
            className="absolute top-0 inset-x-0 h-[3px]"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${primaryColor} 50%, transparent 100%)`
            }}
          />

          {/* Logo & Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4 relative group">
              {branding?.logoUrl ? (
                <img 
                  src={branding.logoUrl} 
                  alt="Logo" 
                  className="w-16 h-16 object-contain rounded-2xl shadow-xl border border-white/10" 
                />
              ) : (
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center border border-cyan-500/30 shadow-[0_0_25px_rgba(0,240,255,0.25)]"
                  style={{ background: 'linear-gradient(135deg, rgba(0,240,255,0.15), rgba(59,130,246,0.15))' }}
                >
                  <Activity className="w-8 h-8 text-cyan-400" />
                </div>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {branding?.platformName || 'MOSA Smart Platform'}
            </h1>
            <p className="text-slate-400 text-sm mt-1.5 font-medium">
              المنصة الذكية للتحكم بالمنزل وإنترنت الأشياء
            </p>
          </div>

          {/* Login Form */}
          {!requiresMfa ? (
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Username Field */}
              <div>
                <label htmlFor="username" className="block text-xs font-semibold text-slate-300 mb-2">
                  اسم المستخدم
                </label>
                <div className="relative flex items-center">
                  <div className="absolute right-3.5 text-slate-400 pointer-events-none">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pr-11 pl-4 py-3 bg-[#060b17]/90 border border-slate-700/70 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm font-medium"
                    placeholder="اسم المستخدم أو البريد"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* PIN / Password Field */}
              <div>
                <label htmlFor="pinCode" className="block text-xs font-semibold text-slate-300 mb-2">
                  رمز المرور / PIN
                </label>
                <div className="relative flex items-center">
                  <div className="absolute right-3.5 text-slate-400 pointer-events-none">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="pinCode"
                    type={showPassword ? 'text' : 'password'}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    className="w-full pr-11 pl-11 py-3 bg-[#060b17]/90 border border-slate-700/70 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm font-medium"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 text-slate-400 hover:text-slate-200 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-medium text-center flex items-center justify-center gap-2">
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 rounded-2xl font-bold text-sm text-slate-950 transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,240,255,0.35)] hover:shadow-[0_0_35px_rgba(0,240,255,0.5)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, #3b82f6)`
                }}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>جاري التحقق...</span>
                  </div>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>تسجيل الدخول</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* MFA Screen */
            <form onSubmit={handleMfaSubmit} className="space-y-6">
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3 text-cyan-400">
                  <ShieldCheck size={28} />
                </div>
                <h3 className="text-lg font-bold text-white">التحقق بخطوتين (MFA)</h3>
                <p className="text-xs text-slate-400 mt-1">أدخل الرمز المكون من 6 أرقام من تطبيق الموثق</p>
              </div>

              <div>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="w-full text-center tracking-[0.4em] text-2xl font-mono py-3.5 bg-[#060b17]/90 border border-slate-700/70 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-medium text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-slate-950 transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,240,255,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, #3b82f6)`
                }}
              >
                {loading ? 'جاري التحقق...' : 'تأكيد الدخول'}
              </button>
            </form>
          )}

          {/* Subtle System Status Footer */}
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>النظام متصل</span>
            </span>
            <span className="text-slate-400 font-mono">v3.0.0</span>
          </div>

        </div>
      </div>
    </div>
  );
}
