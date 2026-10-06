'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cpu, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Auto-login as 'admin' without user input
      const res = await authApi.login('admin', '');
      const token = res.data.accessToken || res.data.token;
      setAuth(res.data.user, token);
      router.push('/dashboard');
    } catch (err) {
      setError('تعذر تسجيل الدخول، تأكد من اتصال الخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] text-[#f1f5f9] overflow-hidden relative" dir="rtl">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md z-10 p-4"
      >
        <Card className="bg-[#1a2235]/80 backdrop-blur-xl border border-[#1e293b] shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden">
          <CardHeader className="flex flex-col items-center space-y-4 pt-12 pb-6 border-b border-[#1e293b]/50">
            <motion.div 
              initial={{ rotate: -90, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)]"
            >
              <Cpu className="w-10 h-10 text-white drop-shadow-md" />
            </motion.div>
            <div className="text-center">
              <CardTitle className="text-3xl font-bold tracking-tight text-white drop-shadow-sm mb-2">MOSA Smart</CardTitle>
              <p className="text-[#94a3b8] text-sm">أهلاً بك في منصة إدارة منزلك الذكي</p>
            </div>
          </CardHeader>
          <CardContent className="pt-8 pb-10 px-8">
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm text-center font-medium"
                >
                  {error}
                </motion.div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] py-6 font-medium text-lg rounded-xl shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] transition-all hover:shadow-[0_6px_20px_rgba(59,130,246,0.23)] flex items-center justify-center gap-2 group"
                disabled={loading}
              >
                {loading ? 'جارٍ الدخول...' : (
                  <>
                    <span>الدخول للوحة التحكم</span>
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
