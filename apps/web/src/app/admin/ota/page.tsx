'use client';
import { useState } from 'react';
import { UploadCloud, Server, ShieldAlert, Cpu } from 'lucide-react';

export default function SuperAdminOtaPage() {
  const [version, setVersion] = useState('v2.1.0-stable');
  const [target, setTarget] = useState('ALL');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFile(selected);
      
      // Auto-upload the file
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', selected);
        formData.append('version', version);
        
        const res = await fetch(`/api/ota/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
        });
        const data = await res.json();
        if (res.ok) {
          setVersionId(data.id);
          alert('تم رفع الفيرم وير وتوقيعه بنجاح!');
        } else {
          alert('خطأ: ' + data.message);
        }
      } catch (err) {
        alert('فشل الاتصال بالخادم لرفع الملف');
      } finally {
        setUploading(false);
      }
    }
  };

  const startRollout = async () => {
    if (!versionId) return alert('يرجى رفع ملف تحديث أولاً');
    
    setUploading(true);
    try {
      const res = await fetch(`/api/ota/rollout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ versionId, targetType: target })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`تم إرسال أمر التحديث لـ ${data.count} جهاز بنجاح!`);
      } else {
        alert('خطأ: ' + data.message);
      }
    } catch (err) {
      alert('فشل بدء التحديث');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center gap-4 mb-10 border-b border-red-500/20 pb-6">
          <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
            <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-red-100">إدارة التحديثات الهوائية (Super Admin)</h1>
            <p className="text-red-400/70 mt-1">منطقة خطرة: التحديثات الخاطئة قد تتسبب في إيقاف آلاف الأجهزة</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
            
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <UploadCloud className="text-blue-400" /> رفع ملف النظام (Firmware)
            </h2>
            
            <label className="border-2 border-dashed border-slate-700 bg-slate-950/50 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all block">
              <input type="file" accept=".bin" className="hidden" onChange={handleFileChange} />
              <UploadCloud className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-300">
                {file ? file.name : 'اسحب ملف .bin هنا أو انقر للاستعراض'}
              </p>
              <p className="text-xs text-slate-500 mt-2">الحد الأقصى للملف: 4MB</p>
            </label>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-400 mb-2">رقم الإصدار الجديد</label>
              <input 
                type="text" 
                value={version}
                onChange={e => setVersion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Rollout Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full"></div>
            
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Server className="text-amber-400" /> توجيه التحديث (Rollout Target)
            </h2>

            <div className="space-y-4 mb-8">
              <label className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer hover:border-amber-500/50 transition-colors">
                <input type="radio" name="target" checked={target === 'ALL'} onChange={() => setTarget('ALL')} className="w-5 h-5 accent-amber-500" />
                <div>
                  <p className="font-medium">جميع الأجهزة (Global Rollout)</p>
                  <p className="text-xs text-slate-500 mt-1">سيتم إرسال التحديث لـ 1,450 جهاز نشط</p>
                </div>
              </label>

              <label className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer hover:border-amber-500/50 transition-colors">
                <input type="radio" name="target" checked={target === 'BETA'} onChange={() => setTarget('BETA')} className="w-5 h-5 accent-amber-500" />
                <div>
                  <p className="font-medium">المجموعة التجريبية (Beta Testers)</p>
                  <p className="text-xs text-slate-500 mt-1">تحديث 50 جهاز فقط كاختبار أولي</p>
                </div>
              </label>
            </div>

            <button 
              onClick={startRollout}
              disabled={uploading}
              className="w-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-500/20 transition-all flex justify-center items-center gap-2"
            >
              {uploading ? 'جاري الإرسال للمحولات...' : <><Cpu className="w-5 h-5" /> بدء التحديث الجماعي للفلاش</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
