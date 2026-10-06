'use client';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Palette, Shield, Download, Upload, AlertTriangle, Monitor, Trash2, Key, MessageSquare } from 'lucide-react';
import { setThemeMode, getThemeMode, setColorTheme, getColorTheme, Theme, ColorTheme } from '@/lib/theme';
import { useAuthStore } from '@/store/auth.store';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Section 1: Appearance
  const [themeMode, setThemeModeState] = useState<Theme>('dark');
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('zinc');

  // Section 2: Security
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);

  // Section 3: System (Admin)
  const [retentionDays, setRetentionDays] = useState(30);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  
  const [resetInput, setResetInput] = useState('');
  const [sysInfo] = useState({ platform: 'MOSA v2.4.1', db: 'متصل', mqtt: 'متصل', uptime: '14 يوم, 5 ساعات' });

  useEffect(() => {
    setThemeModeState(getThemeMode());
    setColorThemeState(getColorTheme());

    api.get('/settings').then(res => {
      const data = res.data;
      setRetentionDays(data.retentionDays || 30);
      setTelegramEnabled(data.telegramEnabled || false);
      setTelegramToken(data.telegramToken || '');
      setTelegramChatId(data.telegramChatId || '');
    }).catch(console.error);
    api.get('/auth/sessions').then(res => setSessions(res.data || [])).catch(console.error);
  }, []);

  const handleThemeModeToggle = (isDark: boolean) => {
    const val = isDark ? 'dark' : 'light';
    setThemeModeState(val);
    setThemeMode(val);
  };

  const handleColorChange = (color: ColorTheme) => {
    setColorThemeState(color);
    setColorTheme(color);
  };

  const testTelegram = async () => {
    try {
      await handleSaveSystemSettings();
      await api.post('/settings/telegram/test');
      alert('تم إرسال رسالة الاختبار بنجاح');
    } catch (error) {
      alert('فشل إرسال رسالة الاختبار');
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) return alert('الرمز السري الجديد غير متطابق');
    try {
      await api.put('/users/me/pin', { oldPin, newPin });
      alert('تم تغيير الرمز السري بنجاح');
      setOldPin(''); setNewPin(''); setConfirmPin('');
    } catch (err) {
      alert('فشل تغيير الرمز السري');
    }
  };

  const handleRevokeSession = async (id: string) => {
    await api.delete(`/auth/sessions/${id}`);
    setSessions(sessions.filter(s => s.id !== id));
  };

  const handleRevokeAllSessions = async () => {
    await api.delete('/auth/sessions');
    // For demo purposes, we fetch again or clear all except current.
    api.get('/auth/sessions').then(res => setSessions(res.data || []));
  };

  const handleSaveSystemSettings = async () => {
    try {
      await api.patch('/settings', { retentionDays, telegramEnabled, telegramToken, telegramChatId });
      alert('تم حفظ إعدادات النظام بنجاح');
    } catch (error) {
      alert('فشل حفظ الإعدادات');
    }
  };

  const handleExportBackup = async () => {
    try {
      const res = await api.get('/settings/backup');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'mosa_backup.json';
      link.click();
    } catch (err) {
      alert('فشل التصدير');
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('سيتم استبدال البيانات الحالية. هل أنت متأكد؟')) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = JSON.parse(ev.target?.result as string);
        await api.post('/settings/restore', content);
        alert('تمت الاستعادة بنجاح');
      } catch (err) {
        alert('ملف غير صالح أو فشلت الاستعادة');
      }
    };
    reader.readAsText(file);
  };

  const handleFactoryReset = async () => {
    if (resetInput !== 'RESET') return alert('الرجاء كتابة RESET للتأكيد');
    try {
      await api.post('/settings/reset', {});
      alert('تم إعادة ضبط النظام');
      window.location.reload();
    } catch (err) {
      alert('فشل إعادة الضبط');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <Monitor className="text-blue-400" size={32} />
          إعدادات النظام
        </h1>
        <p className="text-zinc-500 mt-2">تخصيص المظهر، الأمان، وإدارة النظام المركزي.</p>
      </div>

      {/* Section 1: Appearance */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="text-emerald-400" size={20} /> المظهر</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-between items-center pb-6 border-b border-zinc-800">
            <div>
              <p className="text-zinc-200 font-medium">الوضع الليلي (Dark Mode)</p>
              <p className="text-xs text-zinc-500">تبديل واجهة النظام بين الوضع الداكن والفاتح</p>
            </div>
            <Switch checked={themeMode === 'dark'} onCheckedChange={handleThemeModeToggle} />
          </div>
          <div>
            <p className="text-zinc-200 font-medium mb-3">اللون الأساسي (Theme Color)</p>
            <div className="flex gap-4">
              {['zinc', 'slate', 'stone', 'gray'].map(color => (
                <button 
                  key={color} 
                  onClick={() => handleColorChange(color as ColorTheme)}
                  className={`px-4 py-2 rounded-lg border text-sm capitalize ${colorTheme === color ? 'bg-zinc-800 border-emerald-500/50 text-emerald-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Security */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="text-rose-400" size={20} /> الأمان</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <form onSubmit={handleChangePin} className="space-y-4 max-w-md pb-8 border-b border-zinc-800">
            <h3 className="text-zinc-200 font-medium flex items-center gap-2 mb-4"><Key size={16}/> تغيير الرمز السري</h3>
            <input type="password" placeholder="الرمز السري القديم" required value={oldPin} onChange={e => setOldPin(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200" />
            <input type="password" placeholder="الرمز السري الجديد" required value={newPin} onChange={e => setNewPin(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200" />
            <input type="password" placeholder="تأكيد الرمز السري الجديد" required value={confirmPin} onChange={e => setConfirmPin(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200" />
            <Button type="submit" variant="secondary">حفظ الرمز السري</Button>
          </form>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-zinc-200 font-medium">الجلسات النشطة</h3>
              <Button variant="outline" size="sm" onClick={handleRevokeAllSessions} className="text-red-400 border-red-900/50 hover:bg-red-900/20">تسجيل الخروج من جميع الأجهزة</Button>
            </div>
            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s.id} className="flex justify-between items-center p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <div>
                    <p className="text-sm text-zinc-300">{s.device}</p>
                    <p className="text-xs text-zinc-500">تم الدخول: {new Date(s.createdAt).toLocaleString('ar-SA')}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRevokeSession(s.id)} className="text-zinc-500 hover:text-red-400 hover:bg-zinc-900"><Trash2 size={16}/></Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: System (Admin) */}
      {isAdmin && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Monitor className="text-amber-400" size={20} /> إدارة النظام (للمسؤولين فقط)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex justify-between items-end pb-8 border-b border-zinc-800">
              <div>
                <p className="text-zinc-200 font-medium mb-1">فترة الاحتفاظ بالسجلات (أيام)</p>
                <p className="text-xs text-zinc-500 mb-2">تحديد عدد الأيام للاحتفاظ بسجلات الحركة واستهلاك الطاقة</p>
                <input type="number" min="1" max="365" value={retentionDays} onChange={e => setRetentionDays(parseInt(e.target.value) || 1)} className="w-32 bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 text-center" />
              </div>
              <Button onClick={handleSaveSystemSettings}>حفظ الإعدادات</Button>
            </div>

            <div className="pb-8 border-b border-zinc-800">
              <p className="text-zinc-200 font-medium mb-4">النسخ الاحتياطي والاستعادة</p>
              <div className="flex gap-4">
                <Button variant="outline" onClick={handleExportBackup} className="bg-zinc-950"><Download size={16} className="ml-2"/> تصدير نسخة احتياطية</Button>
                <div className="relative">
                  <input type="file" accept=".json" onChange={handleRestoreBackup} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <Button variant="outline" className="bg-zinc-950 pointer-events-none"><Upload size={16} className="ml-2"/> استعادة من ملف JSON</Button>
                </div>
              </div>
            </div>
            
            <div className="pb-8 border-b border-zinc-800">
              <p className="text-zinc-200 font-medium mb-4">التحديثات الهوائية (OTA)</p>
              <div className="flex gap-4">
                <Button variant="outline" className="bg-zinc-950 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20" onClick={() => window.location.href = '/dashboard/settings/ota'}>
                  <Monitor size={16} className="ml-2" /> إدارة التحديثات الهوائية للمتحكمات
                </Button>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-900/50 rounded-xl p-6">
              <h3 className="text-red-400 font-bold flex items-center gap-2 mb-2"><AlertTriangle size={20}/> منطقة الخطر: إعادة ضبط المصنع</h3>
              <p className="text-sm text-red-400/80 mb-4">سيتم مسح جميع الأجهزة، السيناريوهات، الأتمتة، والسجلات نهائياً. سيتم الاحتفاظ بحساب المسؤول فقط.</p>
              <div className="flex gap-2 max-w-sm">
                <input type="text" placeholder="اكتب RESET للتأكيد" value={resetInput} onChange={e => setResetInput(e.target.value)} className="w-full bg-zinc-950 border border-red-900/50 rounded p-2 text-red-200" />
                <Button variant="destructive" onClick={handleFactoryReset} disabled={resetInput !== 'RESET'}>إعادة ضبط المصنع</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 5: Telegram Notifications */}
      {isAdmin && (
        <Card className="bg-zinc-900 border-zinc-800 mt-6">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <MessageSquare size={20} className="text-blue-500" /> إشعارات تيليغرام
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <p className="text-zinc-200 font-medium">تفعيل إشعارات تيليغرام</p>
                <p className="text-sm text-zinc-500">استلام تنبيهات فورية عند الحركة وانقطاع الأجهزة</p>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${telegramEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`} onClick={() => setTelegramEnabled(!telegramEnabled)}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${telegramEnabled ? '-translate-x-6' : 'translate-x-0'}`} />
              </div>
            </div>

            {telegramEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Bot Token (رمز البوت)</label>
                  <input type="password" value={telegramToken} onChange={e => setTelegramToken(e.target.value)} className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 focus:outline-none focus:border-blue-500" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Chat ID (معرف الدردشة)</label>
                  <input type="text" value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 focus:outline-none focus:border-blue-500" placeholder="-1001234567890" />
                </div>
                <div className="flex gap-4 pt-4">
                  <Button onClick={handleSaveSystemSettings} className="bg-emerald-600 hover:bg-emerald-500">حفظ الإعدادات</Button>
                  <Button onClick={testTelegram} variant="outline" className="bg-zinc-950 border-blue-900/50 text-blue-400 hover:bg-blue-900/30">إرسال رسالة تجريبية</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 4: System Info */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-400 text-sm">معلومات النظام</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-zinc-950 rounded-lg">
              <p className="text-xs text-zinc-500 mb-1">المنصة</p>
              <p className="text-sm font-medium text-zinc-300">{sysInfo.platform}</p>
            </div>
            <div className="p-4 bg-zinc-950 rounded-lg">
              <p className="text-xs text-zinc-500 mb-1">قاعدة البيانات</p>
              <p className="text-sm font-medium text-emerald-400">{sysInfo.db}</p>
            </div>
            <div className="p-4 bg-zinc-950 rounded-lg">
              <p className="text-xs text-zinc-500 mb-1">MQTT Broker</p>
              <p className="text-sm font-medium text-emerald-400">{sysInfo.mqtt}</p>
            </div>
            <div className="p-4 bg-zinc-950 rounded-lg">
              <p className="text-xs text-zinc-500 mb-1">مدة التشغيل</p>
              <p className="text-sm font-medium text-zinc-300" dir="ltr">{sysInfo.uptime}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
