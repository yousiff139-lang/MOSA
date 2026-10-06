"use client";

import { useState, useEffect } from 'react';
import { 
  BarChart3, Zap, Activity, Calendar, Download, DollarSign, 
  MapPin, Printer, ShieldAlert, FileText, CheckCircle
} from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { GlassCard } from '@/components/ui/GlassCard';

export default function ReportsPage() {
  const devices = useSmartHomeStore(state => state.devices);

  // States
  const [selectedDuration, setSelectedDuration] = useState<'WEEK' | 'MONTH' | '2MONTHS' | '6MONTHS' | 'YEAR'>('MONTH');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [unitPrice, setUnitPrice] = useState<number>(0.05);
  const [rooms, setRooms] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [retentionDays, setRetentionDays] = useState<number>(30);

  // Real Report Data state from database
  const [report, setReport] = useState<{
    totalKWh: number;
    calculatedCost: string;
    avgPower: number;
    chartBars: Array<{ label: string; value: number; percent: number }>;
  }>({
    totalKWh: 0,
    calculatedCost: '0.00',
    avgPower: 0,
    chartBars: []
  });

  useEffect(() => {
    setIsClient(true);
    const uniqueRooms = new Set<string>();
    devices.forEach(d => {
      const room = typeof d.room === 'object' && d.room ? (d.room as any).name : d.room;
      if (room) uniqueRooms.add(room);
    });
    setRooms(Array.from(uniqueRooms));

    fetchAuth('/api/logs/retention')
      .then(res => res.json())
      .then(data => { if (data.retentionDays) setRetentionDays(data.retentionDays); })
      .catch(() => null);
  }, [devices]);

  // Fetch real database report stats whenever duration, room, or price changes
  useEffect(() => {
    if (!isClient) return;
    const query = new URLSearchParams({
      duration: selectedDuration,
      room: selectedRoom,
      unitPrice: unitPrice.toString()
    });

    fetchAuth(`/api/analytics/report-stats?${query.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setReport(data);
        }
      })
      .catch(console.error);
  }, [selectedDuration, selectedRoom, unitPrice, isClient]);

  const handleSaveRetention = async (newDays: number) => {
    setRetentionDays(newDays);
    try {
      const res = await fetchAuth('/api/logs/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: newDays })
      });
      if (res.ok) {
        alert(`تم تحديث مدة حفظ الأرشيف والتفريغ التلقائي إلى ${newDays} يوم بنجاح! 🧹`);
      }
    } catch (e) {
      alert('خطأ في الاتصال بالخادم');
    }
  };

  const durationLabels: Record<string, string> = {
    'WEEK': 'أسبوع',
    'MONTH': 'شهر',
    '2MONTHS': 'شهرين',
    '6MONTHS': '6 أشهر',
    'YEAR': 'سنة كاملة'
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };
  const handleExportPDF = handlePrint;

  if (!isClient) return null;

  return (
    <div className="p-4 sm:p-6 md:p-10 w-full animate-fade-in" dir="rtl">
      
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .glass-panel {
            background: transparent !important;
            border: 1px solid #ccc !important;
            color: black !important;
          }
          h1, h2, h3, h4, p, span, td, th {
            color: black !important;
          }
          .chart-bar-fill {
            background-color: #3b82f6 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Main print container */}
      <div id="print-area" className="space-y-8">
        
        {/* Invoice Header */}
        <div className="hidden print:flex justify-between items-center border-b-2 border-black pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-black">تقرير استهلاك الطاقة الموحد</h1>
            <p className="text-xs text-gray-600 mt-1">المنصة الذكية MOSA Smart Home</p>
          </div>
          <div className="text-left">
            <p className="text-xs font-bold">تاريخ التصدير: {new Date().toLocaleDateString('ar-EG')}</p>
            <p className="text-xs text-gray-600">نطاق السجل: {durationLabels[selectedDuration]}</p>
          </div>
        </div>

        {/* Header Banner */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6 no-print">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <BarChart3 className="text-emerald-400" size={32} />
              التقارير التحليلية وتجميع بيانات الـ ESP32
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              إصدار تقارير مجمعة للطاقة كلياً من لوحات ومحولات الـ ESP32 وحساب التكلفة التقديرية تلقائياً
            </p>
          </div>

          <button 
            onClick={handleExportPDF}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-bold px-5 py-3 rounded-2xl transition-all flex items-center gap-2 text-xs shadow-xl"
          >
            <Download size={18} />
            تصدير تقرير PDF / طباعة
          </button>
        </div>

        {/* Auto-Delete & Log Retention Alert Box */}
        <div className="bg-gradient-to-r from-[#111827] via-[#1a2333] to-[#111827] border border-emerald-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 no-print">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                تفعيل الحذف التلقائي وحفظ أرشيف التقارير
              </h3>
              <p className="text-gray-400 text-xs mt-1">تفريغ السجلات والتحديثات القديمة تلقائياً حسب الرغبة للحفاظ على سرعة الاستجابة والذاكرة</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-xs text-gray-400 font-bold whitespace-nowrap">حفظ الأرشيف لمدة:</span>
            <select 
              value={retentionDays}
              onChange={(e) => handleSaveRetention(Number(e.target.value))}
              className="bg-black/60 border border-emerald-500/40 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value={1}>1 يوم (24 ساعة)</option>
              <option value={7}>7 أيام (أسبوع واحد)</option>
              <option value={14}>14 يوم (أسبوعين)</option>
              <option value={30}>30 يوم (شهر كامل)</option>
              <option value={90}>90 يوم (3 أشهر)</option>
              <option value={365}>365 يوم (سنة كاملة)</option>
            </select>
          </div>
        </div>

        {/* Parameters Form (Inputs) */}
        <div className="bg-white/5 p-5 rounded-3xl border border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
          <div>
            <label className="block text-[10px] text-gray-400 mb-2 font-bold">تحديد مدة السجلات</label>
            <select
              value={selectedDuration}
              onChange={e => setSelectedDuration(e.target.value as any)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
            >
              <option value="WEEK">آخر أسبوع</option>
              <option value="MONTH">آخر شهر</option>
              <option value="2MONTHS">آخر شهرين</option>
              <option value="6MONTHS">آخر 6 أشهر</option>
              <option value="YEAR">سنة كاملة</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-gray-400 mb-2 font-bold">تحديد الغرفة المستهدفة</label>
            <select
              value={selectedRoom}
              onChange={e => setSelectedRoom(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
            >
              <option value="ALL">المنزل بالكامل (الإجمالي)</option>
              {rooms.map(room => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-gray-400 mb-2 font-bold">تعريف سعر الكيلوواط/ساعة (العملة المحلية)</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.001"
                value={unitPrice}
                onChange={e => setUnitPrice(parseFloat(e.target.value) || 0.01)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white pl-10"
                placeholder="0.05"
              />
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
            </div>
          </div>
        </div>

        {/* Printable Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassCard className="p-6 flex items-center gap-5 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="text-gray-400 text-xs font-bold">إجمالي الاستهلاك بالمدة</h3>
              <p className="text-3xl font-black text-white mt-1">{report.totalKWh} <span className="text-sm text-gray-500">kWh</span></p>
            </div>
          </GlassCard>

          <GlassCard className="p-6 flex items-center gap-5 relative overflow-hidden border-emerald-500/20 bg-emerald-500/5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <DollarSign size={24} />
            </div>
            <div>
              <h3 className="text-gray-400 text-xs font-bold">التكلفة المالية المحسوبة</h3>
              <p className="text-3xl font-black text-emerald-400 mt-1">{report.calculatedCost} <span className="text-xs text-emerald-500/60 font-bold">وحدة عملة</span></p>
            </div>
          </GlassCard>

          <GlassCard className="p-6 flex items-center gap-5 relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <MapPin size={24} />
            </div>
            <div>
              <h3 className="text-gray-400 text-xs font-bold">نطاق التقرير الحالي</h3>
              <p className="text-lg font-black text-white mt-1">
                {selectedRoom === 'ALL' ? 'المنزل بالكامل' : selectedRoom}
              </p>
              <span className="text-[10px] text-gray-500 block font-bold">المدة: {durationLabels[selectedDuration]}</span>
            </div>
          </GlassCard>
        </div>

        {/* Printable Chart section */}
        <div className="bg-[#0b0e14]/60 backdrop-blur-3xl border border-white/5 rounded-[2rem] p-6 min-h-[300px] flex flex-col">
          <h3 className="text-base font-bold text-white mb-6">تحليل الاستهلاك وتوزيعه بالمدة</h3>
          
          <div className="flex-1 flex items-end justify-between gap-3 relative pb-2 min-h-[180px]">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
              {[1, 2, 3, 4].map(i => <div key={i} className="w-full border-t border-white border-dashed" />)}
            </div>
            
            {report.chartBars.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-bold">
                لا توجد سجلات استهلاك كافية لهذه الفترة.
              </div>
            ) : (
              report.chartBars.map((d, i) => (
                <div key={i} className="w-full flex flex-col items-center gap-3 relative z-10 group">
                  <div className="text-[10px] text-gray-400 font-bold opacity-80">
                    {Math.round(d.value)}W
                  </div>
                  <div 
                    className="w-full max-w-[45px] bg-blue-600/30 border border-blue-500/20 rounded-t-lg transition-all duration-700 relative overflow-hidden chart-bar-fill" 
                    style={{ height: `${Math.max(8, d.percent)}%`, minHeight: '15px' }}
                  >
                    <div className="absolute top-0 w-full h-1 bg-white/20" />
                  </div>
                  <span className="text-gray-500 font-bold text-[10px] truncate max-w-full">{d.label}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cost summary table */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText size={16} />
            تفاصيل فواتير الطاقة والتقدير
          </h3>

          <div className="overflow-hidden border border-white/5 rounded-xl">
            <table className="w-full text-right text-xs text-gray-300">
              <thead className="bg-white/5 text-gray-400">
                <tr>
                  <th className="px-4 py-3">البند / النطاق</th>
                  <th className="px-4 py-3">سعر الوحدة</th>
                  <th className="px-4 py-3">إجمالي الاستهلاك</th>
                  <th className="px-4 py-3">قيمة الفاتورة الإجمالية</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3.5 font-bold">
                    {selectedRoom === 'ALL' ? 'إجمالي المنزل بالكامل' : `استهلاك منطقة: ${selectedRoom}`}
                  </td>
                  <td className="px-4 py-3.5 font-mono">{unitPrice} / kWh</td>
                  <td className="px-4 py-3.5 font-mono">{report.totalKWh} kWh</td>
                  <td className="px-4 py-3.5 font-mono font-bold text-emerald-400">{report.calculatedCost}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed font-bold">
            * تم احتساب الفاتورة بالاعتماد على قراءات الطاقة المباشرة من قاعدة بيانات وحساسات الـ ESP32 المسجلة فعلياً.
          </p>
        </div>

      </div>

    </div>
  );
}
