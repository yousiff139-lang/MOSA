'use client';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Download, Trash2, Filter } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';

export default function MotionLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  
  const [filterDevice, setFilterDevice] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const { toggleDevice } = useSocket(); // initializes socket implicitly

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDevice) params.append('deviceId', filterDevice);
      if (filterFrom) params.append('from', filterFrom);
      if (filterTo) params.append('to', filterTo);
      
      const res = await api.get(`/motion/logs?${params.toString()}`);
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch motion logs');
      // Mock for UI dev
      if (logs.length === 0) {
        setLogs([
          { id: '1', timestamp: new Date().toISOString(), status: 'DETECTED', device: { name: 'حساس المدخل', room: { name: 'المدخل' } } },
          { id: '2', timestamp: new Date(Date.now() - 60000).toISOString(), status: 'CLEARED', device: { name: 'حساس المدخل', room: { name: 'المدخل' } } }
        ]);
      }
    }
  };

  useEffect(() => {
    fetchLogs();
    api.get('/devices').then(res => {
      setDevices(res.data.filter((d: any) => d.type === 'SENSOR_MOTION'));
    }).catch(console.error);
  }, [filterDevice, filterFrom, filterTo]);

  // Handle socket event directly or just poll for demo?
  // Real app: we'd listen to 'sensor:motion' in a useEffect and prepend to logs array.
  useEffect(() => {
    // Ideally we subscribe to socket here to prepend new logs without refresh
    const handleNewMotion = (e: any) => {
      // Assuming event is dispatched via window for decoupling, or we import socket instance
      fetchLogs();
    };
    window.addEventListener('sensor:motion', handleNewMotion);
    return () => window.removeEventListener('sensor:motion', handleNewMotion);
  }, []);

  const exportCSV = () => {
    const header = 'التاريخ,الوقت,الجهاز,الغرفة,الحالة\n';
    const csv = logs.map(l => {
      const d = new Date(l.timestamp);
      return `${d.toLocaleDateString('ar-SA')},${d.toLocaleTimeString('ar-SA')},${l.device?.name || '-'},${l.device?.room?.name || '-'},${l.status === 'DETECTED' ? 'حركة' : 'سكون'}`;
    }).join('\n');

    const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'motion_logs.csv';
    link.click();
  };

  const clearLogs = async () => {
    if (!confirm('هل أنت متأكد من مسح جميع السجلات؟')) return;
    try {
      await api.delete('/motion/logs');
      setLogs([]);
    } catch (err) {
      alert('فشل المسح');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <Activity className="text-emerald-400" size={32} />
          سجل الحركة
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white">
            <Download size={16} className="ml-2" /> تصدير CSV
          </Button>
          <Button variant="outline" onClick={clearLogs} className="bg-zinc-900 border-red-900/50 text-red-400 hover:bg-red-900/20">
            <Trash2 size={16} className="ml-2" /> مسح السجل
          </Button>
        </div>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-zinc-500" />
              <span className="text-sm text-zinc-400">تصفية:</span>
            </div>
            <select value={filterDevice} onChange={e => setFilterDevice(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200">
              <option value="">جميع الأجهزة</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200" placeholder="من تاريخ" />
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200" placeholder="إلى تاريخ" />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right text-zinc-400">
              <thead className="text-xs text-zinc-500 bg-zinc-950/50 uppercase border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium">الوقت والتاريخ</th>
                  <th className="px-6 py-4 font-medium">اسم الجهاز</th>
                  <th className="px-6 py-4 font-medium">الغرفة</th>
                  <th className="px-6 py-4 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">لا توجد سجلات حركة في هذه الفترة.</td>
                  </tr>
                ) : (
                  logs.map(log => {
                    const date = new Date(log.timestamp);
                    return (
                      <tr key={log.id} className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-zinc-300 font-medium">{date.toLocaleTimeString('ar-SA')}</span>
                          <span className="text-zinc-500 mr-2 text-xs">{date.toLocaleDateString('ar-SA')}</span>
                        </td>
                        <td className="px-6 py-4 text-zinc-300">{log.device?.name || '-'}</td>
                        <td className="px-6 py-4 text-zinc-500">{log.device?.room?.name || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${log.status === 'DETECTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                            {log.status === 'DETECTED' ? 'اكتشاف حركة' : 'سكون'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
