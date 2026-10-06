"use client";

import { Handle, Position, useReactFlow } from 'reactflow';
import { Zap } from 'lucide-react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

export function ActionNode({ id, data }: any) {
  const devices = useSmartHomeStore(s => s.devices);
  const { setNodes } = useReactFlow();

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    const device = devices.find(d => d.id.toString() === deviceId);
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, deviceId, targetLabel: device?.name || 'Unknown' } };
        }
        return n;
      })
    );
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const actionState = e.target.value;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, actionState } };
        }
        return n;
      })
    );
  };
  return (
    <div className="bg-slate-900 border-2 border-blue-500 rounded-xl p-4 shadow-xl min-w-[200px] text-white">
      <Handle type="target" position={Position.Right} className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
      
      <div className="flex items-center gap-3 mb-2 pb-2 border-b border-white/10">
        <div className="bg-blue-500/20 p-2 rounded-lg">
          <Zap size={18} className="text-blue-400" />
        </div>
        <div className="font-bold text-sm">أمر تنفيذي (Action)</div>
      </div>
      
      <div className="text-xs text-gray-400 mb-1 mt-2">الجهاز المستهدف:</div>
      <select 
        value={data.deviceId || ''} 
        onChange={handleDeviceChange}
        className="w-full bg-slate-950 border border-blue-500/50 rounded-lg p-2 text-sm text-white mb-2 outline-none nodrag"
      >
        <option value="" disabled>اختر جهازاً...</option>
        {devices.map(d => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
      
      <div className="text-xs text-gray-400 mb-1 mt-2">القرار (تغيير الحالة إلى):</div>
      <select 
        value={data.actionState || 'ON'} 
        onChange={handleStateChange}
        className="w-full bg-slate-950 border border-blue-500/50 rounded-lg p-2 text-sm text-white outline-none nodrag"
      >
        <option value="ON">تشغيل (ON)</option>
        <option value="OFF">إطفاء (OFF)</option>
      </select>
    </div>
  );
}
