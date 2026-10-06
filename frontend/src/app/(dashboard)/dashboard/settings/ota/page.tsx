'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Upload, Download, Trash2, Cpu, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useSocket } from '@/hooks/useSocket';

export default function OTAPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [versions, setVersions] = useState<any[]>([]);
  const [controllers, setControllers] = useState<any[]>([]);
  
  // Upload State
  const [file, setFile] = useState<File | null>(null);
  const [versionInput, setVersionInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Flash State
  const [selectedVersion, setSelectedVersion] = useState<Record<string, string>>({});
  const [flashStatus, setFlashStatus] = useState<Record<string, string>>({});

  const { toggleDevice } = useSocket(); // ensures socket connection

  const fetchData = async () => {
    try {
      const [vRes, cRes] = await Promise.all([
        api.get('/ota/versions'),
        api.get('/controllers')
      ]);
      setVersions(vRes.data);
      setControllers(cRes.data);
      
      // Auto-select latest stable version for each controller
      const stable = vRes.data.find((v: any) => v.isStable) || vRes.data[0];
      if (stable) {
        const initSelection: Record<string, string> = {};
        cRes.data.forEach((c: any) => initSelection[c.id] = stable.id);
        setSelectedVersion(initSelection);
      }
    } catch (err) {
      console.error('Failed to load OTA data');
    }
  };

  useEffect(() => {
    if (isAdmin) fetchData();

    const handleOtaStatus = (e: any) => {
      const { controllerId, status } = e.detail;
      setFlashStatus(prev => ({ ...prev, [controllerId]: status }));
    };

    window.addEventListener('ota:status', handleOtaStatus);
    return () => window.removeEventListener('ota:status', handleOtaStatus);
  }, [isAdmin]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('الرجاء اختيار ملف التحديث (.bin)');
    
    setUploading(true);
    setUploadProgress(10);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('version', versionInput);
    formData.append('notes', notesInput);

    try {
      // Since axios is preconfigured in api, we just pass formData
      // The backend uses fastify-multipart
      await api.post('/ota/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) setUploadProgress(Math.round((ev.loaded * 100) / ev.total));
        }
      });
      alert('تم رفع الإصدار بنجاح');
      setFile(null); setVersionInput(''); setNotesInput('');
      setUploadProgress(0);
      fetchData();
    } catch (err) {
      alert('فشل رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteVersion = async (id: string) => {
    if (!confirm('تأكيد حذف هذا الإصدار؟')) return;
    try {
      await api.delete(`/ota/versions/${id}`);
      fetchData();
    } catch (err) {
      alert('فشل الحذف');
    }
  };

  const toggleStable = async (id: string, isStable: boolean) => {
    try {
      await api.patch(`/ota/versions/${id}/stable`, { isStable });
      fetchData();
    } catch (err) {}
  };

  const handleFlash = async (controllerId: string) => {
    const vid = selectedVersion[controllerId];
    if (!vid) return alert('الرجاء اختيار إصدار');
    
    setFlashStatus(prev => ({ ...prev, [controllerId]: 'PENDING' }));
    
    try {
      await api.post(`/ota/flash/${controllerId}`, { versionId: vid });
    } catch (err) {
      alert('فشل إرسال طلب التحديث');
      setFlashStatus(prev => ({ ...prev, [controllerId]: 'FAILED' }));
    }
  };

  if (!isAdmin) return <div className="p-8 text-center text-zinc-500">غير مصرح لك بدخول هذه الصفحة</div>;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <Download className="text-blue-400" size={32} />
          تحديثات النظام الهوائية (OTA)
        </h1>
        <p className="text-zinc-500 mt-2">إدارة وتحديث البرمجيات الثابتة للمتحكمات عن بعد عبر شبكة WiFi.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Section 1: Upload */}
        <Card className="bg-zinc-900 border-zinc-800 lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload size={20} className="text-emerald-400"/> رفع الإصدار الجديد</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">رقم الإصدار (مثل 1.2.0)</label>
                <input required type="text" value={versionInput} onChange={e => setVersionInput(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">ملاحظات الإصدار</label>
                <textarea value={notesInput} onChange={e => setNotesInput(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 min-h-[80px]" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">ملف التحديث (.bin)</label>
                <input required type="file" accept=".bin" onChange={handleFileChange} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20" />
              </div>
              <Button type="submit" className="w-full" disabled={uploading || !file}>
                {uploading ? <><Loader2 className="animate-spin ml-2" size={16}/> جاري الرفع {uploadProgress}%</> : 'رفع النظام'}
              </Button>
              {uploading && (
                <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-8">
          
          {/* Section 2: Versions */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle>الإصدارات المتاحة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-zinc-300 text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="py-3 px-4 font-medium">الإصدار</th>
                      <th className="py-3 px-4 font-medium">الحجم</th>
                      <th className="py-3 px-4 font-medium">التاريخ</th>
                      <th className="py-3 px-4 font-medium">مستقر</th>
                      <th className="py-3 px-4 font-medium">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.length === 0 ? (
                      <tr><td colSpan={5} className="py-8 text-center text-zinc-500">لا توجد إصدارات متوفرة</td></tr>
                    ) : (
                      versions.map(v => (
                        <tr key={v.id} className="border-b border-zinc-800/50">
                          <td className="py-3 px-4 font-mono font-bold text-blue-400">v{v.version}</td>
                          <td className="py-3 px-4 font-mono text-xs">{(v.fileSize / 1024).toFixed(1)} KB</td>
                          <td className="py-3 px-4">{new Date(v.createdAt).toLocaleDateString('ar-SA')}</td>
                          <td className="py-3 px-4">
                            <Switch checked={v.isStable} onCheckedChange={(c) => toggleStable(v.id, c)} />
                          </td>
                          <td className="py-3 px-4">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteVersion(v.id)} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                              <Trash2 size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Flash */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Cpu size={20} className="text-purple-400"/> تحديث المتحكمات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {controllers.map(ctrl => {
                  const status = flashStatus[ctrl.id];
                  
                  return (
                    <div key={ctrl.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <p className="text-zinc-100 font-bold flex items-center gap-2">
                          {ctrl.name}
                          {ctrl.status === 'ONLINE' ? <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs py-0">متصل</Badge> : <Badge className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 text-xs py-0">غير متصل</Badge>}
                        </p>
                        <p className="text-xs text-zinc-500 font-mono mt-1">MAC: {ctrl.mac}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <select 
                          value={selectedVersion[ctrl.id] || ''} 
                          onChange={e => setSelectedVersion(prev => ({...prev, [ctrl.id]: e.target.value}))}
                          className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-300"
                        >
                          <option value="" disabled>اختر الإصدار...</option>
                          {versions.map(v => (
                            <option key={v.id} value={v.id}>v{v.version} {v.isStable ? '(مستقر)' : ''}</option>
                          ))}
                        </select>
                        
                        <Button 
                          onClick={() => handleFlash(ctrl.id)} 
                          disabled={!selectedVersion[ctrl.id] || status === 'PENDING' || ctrl.status !== 'ONLINE'}
                          className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
                        >
                          {status === 'PENDING' ? <><Loader2 className="animate-spin ml-2" size={16}/> انتظار...</> : 'تحديث الآن'}
                        </Button>
                      </div>
                      
                      {/* Status Indicator */}
                      {status && (
                        <div className="text-sm font-medium flex items-center justify-end min-w-[100px]">
                          {status === 'PENDING' && <span className="text-amber-400">جاري الإرسال...</span>}
                          {status === 'SUCCESS' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={14}/> نجاح</span>}
                          {status === 'FAILED' && <span className="text-rose-400 flex items-center gap-1"><XCircle size={14}/> فشل</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {controllers.length === 0 && <p className="text-center text-zinc-500 py-4">لا توجد متحكمات مضافة</p>}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
