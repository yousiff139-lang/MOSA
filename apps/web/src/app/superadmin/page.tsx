'use client';
import { useState, useEffect } from 'react';
import { ShieldAlert, Users, Home, Cpu, UploadCloud, Rocket } from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetchAuth(`/api/admin/stats`);
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOtaBlast = async () => {
    const confirm = window.confirm("⚠️ هل أنت متأكد من رغبتك في إرسال التحديث لـ 10,000 جهاز حول العالم؟");
    if (!confirm) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetchAuth(`/api/admin/ota/blast`, {
        method: 'POST'
      });
      if (res.ok) alert("تم إطلاق أمر التحديث (OTA Blast) بنجاح!");
    } catch (err) {
      alert("حدث خطأ.");
    }
  };

  if (loading) return <div className="p-8 text-white">Loading God Mode...</div>;

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white p-8">
      <header className="mb-10 flex items-center gap-4 border-b border-white/10 pb-6">
        <div className="p-4 rounded-2xl bg-red-500/20 text-red-500">
          <ShieldAlert size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
            شاشة الإدارة العليا (God Mode)
          </h1>
          <p className="text-gray-400 mt-1">خاصة بالرئيس التنفيذي - بيانات حية للسيرفرات العالمية</p>
        </div>
      </header>

      {/* Global Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-[#1a1d24] border border-white/5 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 text-emerald-400 mb-4">
            <Users size={24} /> <span className="font-bold">المستخدمين النشطين</span>
          </div>
          <div className="text-5xl font-black">{stats?.metrics.totalUsers || 0}</div>
        </div>
        <div className="bg-[#1a1d24] border border-white/5 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 text-blue-400 mb-4">
            <Home size={24} /> <span className="font-bold">المنازل المتصلة</span>
          </div>
          <div className="text-5xl font-black">{stats?.metrics.totalHomes || 0}</div>
        </div>
        <div className="bg-[#1a1d24] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full" />
          <div className="flex items-center gap-3 text-amber-400 mb-4">
            <span className="font-bold">الدخل الشهري (MRR)</span>
          </div>
          <div className="text-5xl font-black">${stats?.metrics.mrr || 0}</div>
        </div>
        <div className="bg-[#1a1d24] border border-white/5 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 text-purple-400 mb-4">
            <Cpu size={24} /> <span className="font-bold">ضغط السيرفر (Load)</span>
          </div>
          <div className="text-4xl font-black">{stats?.server.cpuLoad.toFixed(2)}%</div>
          <p className="text-xs text-gray-500 mt-2">Memory: {stats?.server.memoryUsagePercent.toFixed(1)}%</p>
        </div>
      </div>

      {/* OTA Fleet Management */}
      <div className="bg-gradient-to-br from-[#1a1d24] to-[#0b0e14] border border-red-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-red-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-3 text-red-400">
          <Rocket size={28} />
          إدارة الأسطول الموحد (Global OTA Blast)
        </h2>
        <p className="text-gray-400 mb-8 max-w-2xl">
          تحذير: إرسال تحديث من هنا سيجبر جميع شرائح ESP32 حول العالم على إعادة التشغيل وتنزيل التحديث الجديد. لا تقم بالضغط إلا إذا كنت متأكداً من استقرار النسخة.
        </p>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer">
            <UploadCloud size={48} className="text-gray-500 mb-4" />
            <p className="text-sm font-bold text-gray-300">اسحب ملف firmware.bin هنا</p>
            <p className="text-xs text-gray-500 mt-1">النسخة المدعومة v2.0.0+</p>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <button 
              onClick={handleOtaBlast}
              className="w-full h-full min-h-[120px] bg-red-600 hover:bg-red-500 text-white text-2xl font-black rounded-2xl shadow-[0_0_40px_rgba(220,38,38,0.3)] transition-all active:scale-95 flex items-center justify-center gap-4"
            >
              <Rocket size={32} />
              إطلاق التحديث لـ 10,000 جهاز!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
