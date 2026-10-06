"use client";
import React, { useState, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge, 
  Node, 
  Edge,
  NodeChange,
  EdgeChange,
  Connection
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ArrowLeft, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

const initialNodes: Node[] = [
  {
    id: 'trigger-1',
    type: 'input',
    data: { label: '👁️ كاميرا الصالة (اكتشاف حركة)' },
    position: { x: 250, y: 50 },
    style: { background: '#1e293b', color: '#fff', border: '1px solid #3b82f6', borderRadius: '8px', padding: '15px' }
  },
  {
    id: 'condition-1',
    data: { label: '🕒 الوقت بعد 8:00 مساءً' },
    position: { x: 250, y: 150 },
    style: { background: '#1e293b', color: '#fff', border: '1px solid #f59e0b', borderRadius: '8px', padding: '15px' }
  },
  {
    id: 'action-1',
    type: 'output',
    data: { label: '💡 تشغيل إضاءة السقف (50%)' },
    position: { x: 250, y: 250 },
    style: { background: '#1e293b', color: '#fff', border: '1px solid #10b981', borderRadius: '8px', padding: '15px' }
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'trigger-1', target: 'condition-1', animated: true, style: { stroke: '#fff' } },
  { id: 'e2-3', source: 'condition-1', target: 'action-1', animated: true, style: { stroke: '#fff' } },
];

export default function FlowBuilder() {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#fff' } }, eds)),
    []
  );

  return (
    <div className="h-screen w-full flex flex-col bg-[#050505] text-white">
      {/* Topbar */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-lg">أتمتة الدخول الليلي (V2 Flow)</h1>
            <p className="text-xs text-gray-500">برمجة بصرية مرئية (Node-Based)</p>
          </div>
        </div>
        <button 
          onClick={async () => {
            try {
              const ast = {
                type: 'AUTOMATION_RULE',
                trigger: nodes.find(n => n.id.startsWith('trigger'))?.data.label || '',
                conditions: nodes.filter(n => n.id.startsWith('condition')).map(n => n.data.label),
                actions: nodes.filter(n => n.id.startsWith('action')).map(n => n.data.label)
              };
              
              const res = await fetch('/api/automations/ast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ast)
              });
              
              if (!res.ok) throw new Error('فشل الحفظ');
              alert('تم حفظ الأتمتة وتفعيلها في المحرك الرئيسي بنجاح!');
            } catch (err) {
              alert('حدث خطأ أثناء الاتصال بالخادم');
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-sm font-bold rounded-xl transition-colors"
        >
          <Save size={16} /> حفظ وتفعيل
        </button>
      </div>

      {/* Flow Editor */}
      <div className="flex-1 w-full" dir="ltr">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background color="#222" gap={16} />
          <Controls className="bg-black border border-white/10 fill-white" />
        </ReactFlow>
      </div>
    </div>
  );
}
