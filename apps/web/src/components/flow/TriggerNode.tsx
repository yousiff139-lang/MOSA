"use client";

import { Handle, Position, useReactFlow } from 'reactflow';
import { Activity } from 'lucide-react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

export function TriggerNode({ id, data }: any) {
  const devices = useSmartHomeStore(s => s.devices);
  const { setNodes } = useReactFlow();

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    const device = devices.find(d => d.id.toString() === deviceId);
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, deviceId, deviceLabel: device?.name || 'Unknown' } };
        }
        return n;
      })
    );
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const triggerState = e.target.value;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, triggerState } };
        }
        return n;
      })
    );
  };
  return (
    <div className="bg-slate-900 border-2 border-emerald-500 rounded-xl p-4 shadow-xl min-w-[200px] text-white">
      <div className="flex items-center gap-3 mb-2 pb-2 border-b border-white/10">
        <div className="bg-emerald-500/20 p-2 rounded-lg">
          <Activity size={18} className="text-emerald-400" />
        </div>
        <div className="font-bold text-sm">محفز (Trigger)</div>
      </div>
      
      <div className="text-xs text-gray-400 mb-1 mt-2">الجهاز المستهدف:</div>
      <select 
        value={data.deviceId || ''} 
        onChange={handleDeviceChange}
        className="w-full bg-slate-950 border border-emerald-500/50 rounded-lg p-2 text-sm text-white mb-2 outline-none nodrag"
      >
        <option value="" disabled>اختر جهازاً...</option>
        {devices.map(d => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>

      <div className="text-xs text-gray-400 mb-1 mt-2">عندما تصبح حالته:</div>
      <select 
        value={data.triggerState || 'ON'} 
        onChange={handleStateChange}
        className="w-full bg-slate-950 border border-emerald-500/50 rounded-lg p-2 text-sm text-white outline-none nodrag"
      >
        <option value="ON">قيد التشغيل (ON)</option>
        <option value="OFF">مطفأ (OFF)</option>
      </select>
      
      <Handle type="source" position={Position.Left} className="w-3 h-3 bg-emerald-500 border-2 border-slate-900" />
    </div>
  );
}
