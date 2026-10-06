'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [isResetting, setIsResetting] = useState(false);
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleFactoryReset = async () => {
    if (!confirm('تحذير خطير ⚠️: هل أنت متأكد أنك تريد فرمتة النظام بالكامل ومسح كافة البيانات والأجهزة والمستخدمين؟ لا يمكن التراجع عن هذه الخطوة!')) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('http://localhost:8080/api/settings/reset', {
        method: 'POST',
      });
      if (res.ok) {
        alert('تمت فرمتة النظام بنجاح. سيتم تسجيل خروجك الآن.');
        logout();
        router.push('/login');
      } else {
        alert('فشل في فرمتة النظام.');
      }
    } catch (err) {
      alert('حدث خطأ في الاتصال بالخادم.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-8">إعدادات النظام العامة</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Factory Reset Section */}
        <Card className="glass-card border-red-500/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/20 rounded-xl text-red-500">
                <AlertTriangle size={24} />
              </div>
              <div>
                <CardTitle className="text-red-500">إعادة ضبط المصنع (فرمتة)</CardTitle>
                <CardDescription>مسح كافة البيانات وإعادة النظام لحالته الأولى</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              هذا الإجراء سيقوم بمسح كافة المنازل، الأجهزة، الغرف، الإضاءة، الأتمتة، الأعضاء، والملاك تماماً وبشكل نهائي. عند تسجيل الدخول مرة أخرى سيتم إنشائك كأول مستخدم مالك من جديد.
            </p>
            <Button 
              variant="destructive" 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold"
              onClick={handleFactoryReset}
              disabled={isResetting}
            >
              {isResetting ? 'جاري المسح...' : 'تأكيد الفرمتة ومسح الكل'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
