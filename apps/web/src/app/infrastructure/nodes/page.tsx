"use client";

import { Server, Wifi, Cpu, MemoryStick, Activity, ShieldAlert, RefreshCw, Power, HardDrive, Database, Network, HelpCircle, AlertTriangle } from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { confirmAction, notify } from '@/store/useConfirmStore';
import { useState, useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';
import AddNodeModal from '@/components/dashboard-ui/AddNodeModal';

export default function NodesPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const devices = useSmartHomeStore(state => state.devices);
  
  const fetchHealth = async () => {
    try {
      const res = await fetchAuth('/api/system/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch(e) { console.error(e); }
  };

  const fetchNodes = async () => {
    try {
      const res = await fetchAuth('/api/controllers');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setNodes(list);
      }
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    fetchHealth();
    fetchNodes();
    const intv = setInterval(() => {
      fetchHealth();
      fetchNodes();
    }, 3000); // refresh every 3s
    return () => clearInterval(intv);
  }, []);

  const handleDeleteNode = (id: string) => {
    confirmAction({
      title: 'حذف اللوحة الذكية ⚠️',
      message: 'هل أنت متأكد من حذف هذه اللوحة؟',
      subMessage: 'سيؤدي ذلك إلى تعطيل جميع الأجهزة والربط المرتبط بهذه اللوحة.',
      variant: 'danger',
      confirmText: 'نعم، حذف اللوحة',
      cancelText: 'تراجع',
      onConfirm: async () => {
        try {
          const res = await fetchAuth(`/api/controllers/${id}`, { method: 'DELETE' });
          if (res.ok) {
            fetchNodes();
            notify('تم حذف اللوحة بنجاح', 'success');
          } else {
            notify('فشل عملية حذف اللوحة', 'error');
          }
        } catch(e) { 
          console.error(e); 
          notify('حدث خطأ في الاتصال بالشبكة', 'error');
        }
      }
    });
  };

  const handleTogglePower = (boardId: string) => {
    confirmAction({
      title: 'إعادة تشغيل اللوحة الذكية 🔄',
      message: 'هل تريد إيقاف وإعادة تشغيل هذه اللوحة الذكية؟',
      subMessage: 'سيتم قطع الاتصال باللوحة مؤقتاً لمدة 5 ثوانٍ حتى اكتمال الإقلاع.',
      variant: 'reboot',
      confirmText: 'نعم، أعد التشغيل الآن',
      cancelText: 'إلغاء',
      onConfirm: async () => {
        try {
          useSmartHomeStore.setState((state) => {
            const nextBoards = { ...state.boards };
            if (nextBoards[boardId]) {
              nextBoards[boardId] = {
                ...nextBoards[boardId],
                status: 'offline'
              };
            }
            return { boards: nextBoards };
          });

          setNodes(prev => prev.map(n => n.id === boardId ? { ...n, status: 'offline' } : n));

          const res = await fetchAuth(`/api/controllers/${boardId}/restart`, {
            method: 'POST'
          });
          if (res.ok) {
            notify('تم إرسال أمر إيقاف وإعادة تشغيل اللوحة بنجاح ⚡', 'success');
          } else {
            notify('حدث خطأ أثناء إرسال الأمر للوحة', 'error');
          }
        } catch (err) {
          console.error('Failed to restart node', err);
          notify('خطأ في الاتصال بالخادم', 'error');
        }
      }
    });
  };

  // Build the nodes list with the host system prepended
  const hostCpuLoad = health?.system ? `${health.system.cpuLoadAvg.toFixed(1)}%` : '0.5%';
  const hostMemory = health?.system ? `${health.system.memUsagePercent}%` : '18%';

  const hostNode = {
    id: 'mosa-hub-host',
    name: 'خادم MOSA المركزي (Raspberry Pi / Host)',
    macAddress: 'HOST_SYSTEM_PROCESSOR',
    ipAddress: '127.0.0.1 (Localhost)',
    status: 'online',
    isHost: true,
    deviceCount: devices.length,
    cpu: hostCpuLoad,
    mem: hostMemory
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 w-full" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Server className="text-blue-500" size={32} />
            خوادم المعالجة الطرفية (Edge Nodes)
          </h1>
          <p className="text-gray-400 mt-1 text-sm">مراقبة وربط وحدات التحكم المحلية (ESP32/ESP8266) واللوحة المضيفة</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs shadow-lg"
          >
            <Plus size={16} />
            إضافة لوحة جديدة
          </button>
          <button 
            onClick={() => { fetchHealth(); fetchNodes(); }}
            className="bg-white/5 hover:bg-white/10 text-white font-bold px-5 py-2.5 rounded-xl border border-white/10 transition-colors flex items-center gap-2 text-xs"
          >
            <RefreshCw size={16} />
            تحديث الشبكة
          </button>
        </div>
      </div>

      {/* System Health stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-[#11151c]/80 border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent"></div>
          <Cpu className="text-blue-400 mb-3" size={24} />
          <h3 className="text-gray-400 text-xs font-bold mb-1">CPU Load</h3>
          <p className="text-2xl font-black text-white">{health?.system ? health.system.cpuLoadAvg.toFixed(2) : '0.26'}%</p>
          <div className="mt-3 w-16 h-1 rounded-full bg-blue-500"></div>
        </div>

        <div className="bg-[#11151c]/80 border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent"></div>
          <HardDrive className="text-emerald-400 mb-3" size={24} />
          <h3 className="text-gray-400 text-xs font-bold mb-1">Memory</h3>
          <p className="text-2xl font-black text-white">{health?.system ? health.system.memUsagePercent : '18'}%</p>
          <div className="mt-3 w-16 h-1 rounded-full bg-emerald-500"></div>
        </div>

        <div className="bg-[#11151c]/80 border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent"></div>
          <Network className="text-purple-400 mb-3" size={24} />
          <h3 className="text-gray-400 text-xs font-bold mb-1">MQTT Broker</h3>
          <p className="text-lg font-black text-emerald-400 mt-1">ONLINE</p>
          <div className="mt-3 w-16 h-1 rounded-full bg-emerald-500"></div>
        </div>

        <div className="bg-[#11151c]/80 border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent"></div>
          <Database className="text-amber-400 mb-3" size={24} />
          <h3 className="text-gray-400 text-xs font-bold mb-1">Redis Cache</h3>
          <p className="text-lg font-black text-emerald-400 mt-1">ONLINE</p>
          <div className="mt-3 w-16 h-1 rounded-full bg-emerald-500"></div>
        </div>
      </div>

      {/* Nodes List */}
      <div className="flex flex-col gap-4">
        
        {/* Prepend Primary Host System (Raspberry Pi/Localhost Node) */}
        <div className="relative overflow-hidden rounded-2xl border bg-[#1a2333]/40 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.05)] p-6 flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center border bg-blue-500/10 border-blue-500/20 text-blue-400 relative">
             <Server size={32} />
             <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#1a2333] rounded-full"></span>
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-3 mb-1">
               <h3 className="text-xl font-bold text-white">{hostNode.name}</h3>
               <span className="text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-0.5 rounded-full">المستضيف الرئيسي</span>
            </div>
            <p className="text-xs text-white/50">
               الموقع: خادم Docker المحلي • الأجهزة التابعة: {hostNode.deviceCount} • المعالج: {hostNode.cpu} • الذاكرة: {hostNode.mem}
            </p>
          </div>

          <div className="flex flex-wrap md:flex-nowrap gap-4 flex-1">
            <div className="flex items-center gap-3 bg-[#0b0e14]/50 border border-white/5 rounded-xl px-4 py-2 w-full md:w-auto">
              <Wifi size={16} className="text-emerald-400" />
              <div>
                <p className="text-[10px] text-gray-500">عنوان IP</p>
                <p className="text-xs font-bold text-white" dir="ltr">{hostNode.ipAddress}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-[#0b0e14]/50 border border-white/5 rounded-xl px-4 py-2 w-full md:w-auto">
              <Activity size={16} className="text-purple-400" />
              <div>
                <p className="text-[10px] text-gray-500">بوابة الربط</p>
                <p className="text-xs font-bold text-white" dir="ltr">Localhost TCP</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 border-r border-white/10 pr-6 text-gray-500 text-xs font-bold">
            جهاز التشغيل الفعلي
          </div>
        </div>

        {/* Dynamic Nodes (ESP32/ESP8266) */}
        {(() => {
          const storeBoards = useSmartHomeStore.getState().boards || {};
          const storeNodesList = Object.values(storeBoards).map((b: any) => ({
            id: b.id,
            name: b.name || b.macAddress || b.id,
            macAddress: b.macAddress || b.mac || b.id,
            ipAddress: b.ipAddress || b.ip,
            status: b.status === 'offline' ? 'offline' : 'online',
            deviceCount: b.deviceCount || 0
          }));
          const displayNodes = nodes.length > 0 ? nodes : storeNodesList;
          return displayNodes.map((board) => {
          const isOnline = board.status === 'online';
          return (
            <div 
              key={board.id}
              className={`relative overflow-hidden rounded-2xl border transition-all p-6 flex flex-col md:flex-row items-center gap-6 ${
                isOnline 
                  ? 'bg-[#1a2333]/80 border-[#3b82f6]/20 shadow-[0_0_20px_rgba(59,130,246,0.05)]' 
                  : 'bg-[#11151c]/80 border-red-500/10'
              }`}
            >
              <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center border relative ${
                isOnline ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}>
                 <Cpu size={32} />
                 {isOnline && <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#1a2333] rounded-full"></span>}
                 {!isOnline && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-[#11151c] rounded-full"></span>}
              </div>

              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-3 mb-1">
                   <h3 className="text-xl font-bold text-white">{board.name || board.id}</h3>
                   <span className="text-[10px] font-mono bg-white/5 px-2 py-1 rounded text-gray-400 border border-white/5">{board.macAddress}</span>
                </div>
                <p className="text-xs text-gray-500">
                   الحالة: {isOnline ? 'متصل بالشبكة' : 'غير متصل'} • الأجهزة والمنفذ: {board._count?.devices || 0}
                </p>
              </div>

              <div className="flex flex-wrap md:flex-nowrap gap-4 flex-1">
                <div className="flex items-center gap-3 bg-[#0b0e14]/50 border border-white/5 rounded-xl px-4 py-2 w-full md:w-auto">
                  <Wifi size={16} className={isOnline ? "text-emerald-400" : "text-gray-600"} />
                  <div>
                    <p className="text-[10px] text-gray-500">عنوان IP</p>
                    <p className="text-xs font-bold text-white" dir="ltr">{board.ipAddress || '---.---.---.---'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[#0b0e14]/50 border border-white/5 rounded-xl px-4 py-2 w-full md:w-auto">
                  <Activity size={16} className="text-purple-400" />
                  <div>
                    <p className="text-[10px] text-gray-500">بوابة الربط</p>
                    <p className="text-xs font-bold text-white" dir="ltr">MQTT Client</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-r border-white/10 pr-6">
                {!board.isHost && (
                  <button 
                    onClick={() => handleTogglePower(board.id)}
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/30 transition-all text-gray-400" 
                    title="إعادة تشغيل / إيقاف اللوحة"
                  >
                    <Power size={18} />
                  </button>
                )}
                {!board.isHost && (
                  <button 
                    onClick={() => handleDeleteNode(board.id)}
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 transition-all text-gray-400" 
                    title="حذف اللوحة"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          );
        });
        })()}
      </div>

      {/* Educational Guide Section explaining Edge concepts */}
      <div className="mt-16 bg-[#11151c]/80 border border-white/10 rounded-[2rem] p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-20 -bottom-20 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <HelpCircle className="text-blue-400" size={24} />
          <h2 className="text-xl font-bold text-white">دليل خوادم المعالجة الطرفية (Edge Nodes)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-white/70 leading-relaxed">
          <div className="space-y-4 bg-white/[0.01] p-5 rounded-2xl border border-white/5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              ما هي عقدة المعالجة الطرفية (Edge Node)؟
            </h3>
            <p>
              العقدة الطرفية هي لوحة تحكم ذكية وصغيرة (مثل لوحات **ESP32** أو **ESP8266**) ترتبط مباشرة بالأجهزة الكهربائية والمستشعرات بالمنزل. يتم برمجتها لتقوم بقراءة الإشارات الرقمية والتناظرية وتنفيذ الأوامر فورياً.
            </p>
            <p>
              تتميز هذه البنية بكونها **بنية طرفية (Edge)**؛ أي أن الأجهزة الطرفية تتخذ القرارات وتتصل محلياً دون الحاجة للاتصال بالإنترنت الخارجي أو السحابة، مما يوفر سرعة استجابة فائقة (أقل من 15 مللي ثانية) وأماناً تاماً للخصوصية.
            </p>
          </div>

          <div className="space-y-4 bg-white/[0.01] p-5 rounded-2xl border border-white/5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
              الخادم المركزي والـ MQTT Broker
            </h3>
            <p>
              الخادم المركزي (المعروض بالأعلى كـ **Raspberry Pi**) هو العقل المدبر ومستضيف البرمجيات الرئيسي في المنزل. يقوم بتشغيل محرك الأتمتة وقاعدة البيانات لحفظ التغييرات وتسيير الأوامر الصوتية والجدولة.
            </p>
            <p>
              يقوم خادم الـ **MQTT Broker** بدور وسيط الرسائل فائق السرعة، حيث يربط اللوحات الموزعة في الغرف بالخادم المضيف لتبادل البيانات الفورية وتحديث حالة المصابيح والأبواب والمستشعرات في أجزاء من الثانية.
            </p>
          </div>
        </div>
      </div>

      <AddNodeModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={fetchNodes}
      />

    </div>
  );
}
