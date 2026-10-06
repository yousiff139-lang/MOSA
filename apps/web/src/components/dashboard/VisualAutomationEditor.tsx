'use client';

import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes: Node[] = [
  { id: '1', position: { x: 50, y: 50 }, data: { label: 'مستشعر الحركة (المدخل)' }, type: 'input' },
  { id: '2', position: { x: 50, y: 150 }, data: { label: 'شرط: بعد الساعة 10 مساءً' } },
  { id: '3', position: { x: 50, y: 250 }, data: { label: 'تشغيل المصباح (20%)' }, type: 'output' },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
];

export function VisualAutomationEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // ARCHITECTURAL TRAP AVOIDED: AST JSON Compiler
  const exportToAST = () => {
    // We convert the graph into an Abstract Syntax Tree (AST) JSON payload
    // In a real scenario, we recursively traverse from 'input' nodes to 'output' nodes
    const ast = {
      type: "AUTOMATION_RULE",
      trigger: nodes.find(n => n.type === 'input')?.data.label,
      conditions: nodes.filter(n => !n.type).map(n => n.data.label),
      actions: nodes.filter(n => n.type === 'output').map(n => n.data.label),
      rawGraph: { nodes, edges } // Keep raw graph for visual editing later
    };

    console.log("AST Compiled successfully:", JSON.stringify(ast, null, 2));
    alert("تم تجميع الكود (AST) بنجاح: " + JSON.stringify(ast));
    // Here we would POST this AST to /api/automations/ast
  };

  return (
    <div className="w-full h-[600px] bg-black/50 border border-white/10 rounded-[32px] overflow-hidden relative">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
         <button 
           onClick={exportToAST}
           className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-[0_0_15px_rgba(37,99,235,0.4)]"
         >
           حفظ وتجميع (Compile AST)
         </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        colorMode="dark"
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
