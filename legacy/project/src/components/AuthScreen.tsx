import React, { useState } from 'react';
import { Lock } from 'lucide-react';

interface AuthScreenProps {
  onLogin: () => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = localStorage.getItem('app_pin') || '1234';
    if (pin === storedPin) {
      onLogin();
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-theme-base flex items-center justify-center p-4 transition-colors duration-1000">
      <div className="bg-white dark:bg-[#101728] p-8 rounded-3xl border border-gray-200 dark:border-[#1a2235] shadow-2xl max-w-md w-full animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Lock size={32} className="text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Mosa Smart</h2>
          <p className="text-sm text-gray-500 font-medium">أدخل رمز الدخول للنظام</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input 
              type="password" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className={`w-full text-center text-3xl tracking-[1em] p-4 bg-gray-50 dark:bg-[#0a0f1c] rounded-xl border ${error ? 'border-red-500' : 'border-gray-200 dark:border-[#1a2235]'} focus:border-primary outline-none transition-all text-gray-900 dark:text-white`}
              maxLength={4}
              required
              autoFocus
            />
            {error && <p className="text-red-500 text-xs text-center mt-2 font-bold animate-pulse">الرمز غير صحيح</p>}
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-primary py-4 rounded-xl font-bold text-white transition-colors shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            دخول
          </button>
        </form>
      </div>
    </div>
  );
}
