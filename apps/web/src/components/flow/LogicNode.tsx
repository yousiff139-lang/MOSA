"use client";

import { Handle, Position, useReactFlow } from 'reactflow';
import { GitMerge } from 'lucide-react';

export function LogicNode({ id, data }: any) {
  const { setNodes } = useReactFlow();

  const handleOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const operator = e.target.value;
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, operator } } : n));
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, value } } : n));
  };
  return (
    <div className="bg-slate-900 border-2 border-amber-500 rounded-xl p-4 shadow-xl min-w-[180px] text-white">
      <Handle type="target" position={Position.Right} className="w-3 h-3 bg-amber-500 border-2 border-slate-900" />
      
      <div className="flex items-center gap-3 mb-2 pb-2 border-b border-white/10">
        <div className="bg-amber-500/20 p-2 rounded-lg">
          <GitMerge size={18} className="text-amber-400" />
        </div>
        <div className="font-bold text-sm">شرط (Logic)</div>
      </div>
      
      <div className="text-xs text-gray-400 mb-1 mt-2">المعامل المنطقي:</div>
      <select 
        value={data.operator || '>'} 
        onChange={handleOperatorChange}
        className="w-full bg-slate-950 border border-amber-500/50 rounded-lg p-2 text-sm text-white mb-2 outline-none nodrag"
      >
        <option value=">">أكبر من ( &gt; )</option>
        <option value="<">أصغر من ( &lt; )</option>
        <option value="==">يساوي ( == )</option>
        <option value="!=">لا يساوي ( != )</option>
      </select>
      
      <div className="text-xs text-gray-400 mb-1">القيمة:</div>
      <input 
        type="number"
        value={data.value || 30}
        onChange={handleValueChange}
        className="w-full bg-slate-950 border border-amber-500/50 rounded-lg p-2 text-sm text-white outline-none nodrag"
      />
      
      <Handle type="source" position={Position.Left} id="true" className="w-3 h-3 bg-emerald-500 border-2 border-slate-900 top-1/3" />
      <Handle type="source" position={Position.Left} id="false" className="w-3 h-3 bg-red-500 border-2 border-slate-900 top-2/3" />
    </div>
  );
}
