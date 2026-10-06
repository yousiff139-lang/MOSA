"use client";

import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  Edge,
  Node
} from 'reactflow';
import 'reactflow/dist/style.css';

import { TriggerNode } from './flow/TriggerNode';
import { LogicNode } from './flow/LogicNode';
import { ActionNode } from './flow/ActionNode';
import { Plus, Save, Play, Loader2 } from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';

const nodeTypes = {
  trigger: TriggerNode,
  logic: LogicNode,
  action: ActionNode,
};

let id = 0;
const getId = () => `dndnode_${id++}`;

export function VisualAutomations() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);


  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds)), [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      let defaultData = {};
      if (type === 'trigger') defaultData = { deviceLabel: 'حساس حرارة الغرفة' };
      if (type === 'logic') defaultData = { condition: 'أكبر من ( > )', value: 25 };
      if (type === 'action') defaultData = { targetLabel: 'مكيف الهواء', actionState: 'ON' };

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: defaultData,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Basic parse logic: find triggers, logic, actions linked
      // This maps the visual nodes to the MOSA backend JSON format.
      const triggerNodes = nodes.filter(n => n.type === 'trigger');
      const actionNodes = nodes.filter(n => n.type === 'action');
      const logicNodes = nodes.filter(n => n.type === 'logic');

      const conditions = triggerNodes.map(t => ({
        type: 'device_state',
        deviceId: (t.data as any).deviceId || 'device-1',
        state: (t.data as any).triggerState || 'ON'
      })).concat(logicNodes.map(l => ({
        type: 'sensor_value',
        operator: (l.data as any).operator || '>',
        value: Number((l.data as any).value) || 0
      })) as any);

      const actions = actionNodes.map(a => ({
        type: 'device_control',
        deviceId: (a.data as any).deviceId || 'device-2',
        state: (a.data as any).actionState || 'ON'
      }));

      const payload = {
        name: `قاعدة بصرية #${Math.floor(Math.random() * 1000)}`,
        conditions,
        actions,
        isActive: true
      };

      const res = await fetchAuth(`/api/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('تم حفظ الأتمتة بنجاح!');
      } else {
        alert('فشل في حفظ الأتمتة');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-up">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-white">الأتمتة البصرية (Visual Rules)</h1>
          <p className="text-gray-400">اسحب العقد واربطها لإنشاء أتمتة معقدة</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-colors">
            <Play size={18} /> اختبار القاعدة
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-xl flex items-center gap-2 font-bold transition-colors shadow-[0_0_15px_rgba(59,130,246,0.5)] disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} حفظ
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-[600px]">
        {/* Sidebar */}
        <div className="w-64 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
          <h3 className="text-white font-bold mb-2">العقد (Nodes)</h3>
          
          <div className="bg-slate-800 border-l-4 border-emerald-500 p-3 rounded-lg cursor-grab hover:bg-slate-700 transition-colors" onDragStart={(e) => onDragStart(e, 'trigger')} draggable>
            <div className="font-bold text-white text-sm">محفز (Trigger)</div>
            <div className="text-xs text-gray-400">حساس أو جهاز</div>
          </div>
          
          <div className="bg-slate-800 border-l-4 border-amber-500 p-3 rounded-lg cursor-grab hover:bg-slate-700 transition-colors" onDragStart={(e) => onDragStart(e, 'logic')} draggable>
            <div className="font-bold text-white text-sm">شرط (Logic)</div>
            <div className="text-xs text-gray-400">مقارنة وتوقيت</div>
          </div>
          
          <div className="bg-slate-800 border-l-4 border-blue-500 p-3 rounded-lg cursor-grab hover:bg-slate-700 transition-colors" onDragStart={(e) => onDragStart(e, 'action')} draggable>
            <div className="font-bold text-white text-sm">تنفيذ (Action)</div>
            <div className="text-xs text-gray-400">تشغيل أو إطفاء</div>
          </div>
          
          <div className="mt-auto p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 text-center">
            <p className="text-xs text-blue-200">اسحب العقدة إلى مساحة العمل واربطها بالنقاط</p>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-[#0f1422] rounded-2xl border border-white/10 overflow-hidden relative" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              fitView
              className="dark"
            >
              <Background color="#ffffff" gap={16} size={1} className="opacity-5" />
              <Controls className="bg-slate-800 border-white/10 fill-white" />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}
