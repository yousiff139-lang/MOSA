"use client";

import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { useState, useEffect, useRef } from 'react';
import { Server, Wifi, Zap, Activity, RefreshCw, Trash2, RotateCcw } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { motion } from 'framer-motion';

interface NodeCoords {
  x: number;
  y: number;
}

export default function TopologyPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const devices = useSmartHomeStore(state => state.devices);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map of node ID to coordinates {x, y}
  const [nodePositions, setNodePositions] = useState<Record<string, NodeCoords>>({});

  const fetchNodes = async () => {
    try {
      const res = await fetchAuth('/api/controllers');
      if (res.ok) {
        const data = await res.json();
        setNodes(data);
        
        // Initialize positions if not already in local storage
        const saved = localStorage.getItem('mosa_topology_coords');
        const savedCoords = saved ? JSON.parse(saved) : {};
        const newCoords = { ...savedCoords };

        data.forEach((node: any, index: number) => {
          if (!newCoords[node.id]) {
            // Default orbiting math if no saved position exists
            const angle = (index / (data.length || 1)) * Math.PI * 2;
            const radius = 180;
            newCoords[node.id] = {
              x: Math.round(Math.cos(angle) * radius),
              y: Math.round(Math.sin(angle) * radius)
            };
          }
        });

        setNodePositions(newCoords);
      }
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    fetchNodes();
    const intv = setInterval(fetchNodes, 15000);
    return () => clearInterval(intv);
  }, []);

  // Update position while dragging
  const handleDrag = (nodeId: string, info: any) => {
    setNodePositions(prev => {
      const updated = {
        ...prev,
        [nodeId]: {
          x: prev[nodeId].x + info.delta.x,
          y: prev[nodeId].y + info.delta.y
        }
      };
      // Persist coordinate layout configuration
      localStorage.setItem('mosa_topology_coords', JSON.stringify(updated));
      return updated;
    });
  };

  // Reset positions back to circle orbit
  const handleResetLayout = () => {
    if (!confirm('هل تريد إعادة تعيين توزيع الأجهزة التلقائي؟')) return;
    localStorage.removeItem('mosa_topology_coords');
    fetchNodes();
  };

  return (
    <div className="p-6 md:p-10 h-full w-full flex flex-col pb-32" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Activity className="text-blue-500" size={32} />
            خريطة الشبكة التفاعلية (Topology Map)
          </h1>
          <p className="text-gray-400 mt-1 text-sm">اسحب ووزع الأجهزة على الخريطة لتثبيتها وترتيبها حسب غرف المنزل الفعلي</p>
        </div>

        <div className="flex gap-2.5">
          <button 
            onClick={handleResetLayout} 
            className="bg-white/5 hover:bg-white/10 text-white font-bold px-4 py-2.5 rounded-xl border border-white/10 transition-all flex items-center gap-2 text-xs"
          >
            <RotateCcw size={14} />
            إعادة الترتيب التلقائي
          </button>
          <button 
            onClick={fetchNodes} 
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs"
          >
            <RefreshCw size={14} />
            تحديث الاتصال
          </button>
        </div>
      </div>

      {/* Main Canvas Workspace */}
      <GlassCard 
        className="flex-1 min-h-[550px] relative overflow-hidden flex items-center justify-center bg-black/40 border border-white/10 rounded-[2.5rem]"
        ref={containerRef}
      >
        
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

        {/* Central Host Hub (MOSA Core) */}
        <div className="absolute z-20 flex flex-col items-center justify-center bg-blue-600 border-4 border-blue-400/50 w-24 h-24 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.3)]">
          <Server className="text-white" size={32} />
          <span className="text-white font-black text-[10px] mt-1.5">MOSA Core</span>
          <span className="text-white/60 text-[8px] font-mono">127.0.0.1</span>
        </div>

        {/* Nodes layer */}
        {nodes.map((node) => {
          const isOnline = node.status === 'online';
          const pos = nodePositions[node.id] || { x: 0, y: 0 };

          return (
            <div 
              key={node.id} 
              className="absolute z-10" 
              style={{ left: `calc(50% + ${pos.x}px - 48px)`, top: `calc(50% + ${pos.y}px - 48px)` }}
            >
              {/* Dynamic SVG connection line pointing to center */}
              <svg 
                className="absolute pointer-events-none z-0" 
                style={{ 
                  width: Math.abs(pos.x) + 20, 
                  height: Math.abs(pos.y) + 20,
                  left: pos.x >= 0 ? -pos.x + 48 : 48,
                  top: pos.y >= 0 ? -pos.y + 48 : 48,
                  overflow: 'visible'
                }}
              >
                <line 
                  x1={pos.x >= 0 ? 0 : -pos.x} 
                  y1={pos.y >= 0 ? 0 : -pos.y} 
                  x2={pos.x >= 0 ? pos.x : 0} 
                  y2={pos.y >= 0 ? pos.y : 0} 
                  stroke={isOnline ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.2)"} 
                  strokeWidth="2" 
                  strokeDasharray={isOnline ? "none" : "5,5"} 
                />
              </svg>

              {/* Draggable Node Card wrapper */}
              <motion.div 
                drag
                dragConstraints={containerRef}
                dragMomentum={false}
                onDrag={(event, info) => handleDrag(node.id, info)}
                className={`w-24 h-24 rounded-2xl border flex flex-col items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-md transition-shadow hover:shadow-xl ${
                  isOnline 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                {node.protocol === 'WIFI' || !node.protocol ? <Wifi size={24} /> : <Zap size={24} />}
                <span className="text-white font-bold text-[9px] mt-2 text-center w-full truncate px-1 bg-black/45 rounded-full py-0.5">
                  {node.name || 'عقدة مجهولة'}
                </span>
                <span className="text-[8px] text-white/40 font-mono mt-0.5">
                  {node.ipAddress || 'ESP32'}
                </span>
              </motion.div>
            </div>
          );
        })}

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30 backdrop-blur-sm rounded-2xl">
            <div className="text-center">
              <Activity className="text-gray-600 mx-auto mb-4" size={48} />
              <h3 className="text-xl font-bold text-gray-400">لا توجد عقد متصلة بالشبكة حالياً</h3>
              <p className="text-gray-500 text-xs mt-1">سجل اللوحات والـ ESP32 لتوزيعها على خريطة الربط</p>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
