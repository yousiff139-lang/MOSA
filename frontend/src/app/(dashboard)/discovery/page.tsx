'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Search, Plus, Cpu, Activity, Wifi, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// Mocking the discovery endpoint since we use Fastify locally on 8080
const DISCOVERY_API = 'http://localhost:8080/api/discovery';

export default function DiscoveryPage() {
  const [isScanning, setIsScanning] = useState(false);
  const queryClient = useQueryClient();

  // Fetch pending nodes
  const { data: pendingNodes = [], isLoading } = useQuery({
    queryKey: ['pendingNodes'],
    queryFn: async () => {
      const res = await axios.get(`${DISCOVERY_API}/pending`, { withCredentials: true }).catch(() => ({ data: [] }));
      return res.data || [];
    },
    refetchInterval: isScanning ? 2000 : false, // Poll every 2 seconds while scanning
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      await axios.post(`${DISCOVERY_API}/scan`, {}, { withCredentials: true });
    },
    onSuccess: () => {
      setIsScanning(true);
      setTimeout(() => setIsScanning(false), 10000); // Stop scanning animation after 10s
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      await axios.post(`${DISCOVERY_API}/approve`, {
        nodeId,
        homeId: 'default-home-id', // In a real app, this comes from the selected home
        name: 'Smart Node ' + Math.floor(Math.random() * 1000)
      }, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingNodes'] });
    }
  });

  return (
    <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white drop-shadow-md">اكتشاف الأجهزة</h1>
          <p className="text-sm text-zinc-400 mt-1">
            البحث عن لوحات ESP32 ومتحكمات الذكاء الصناعي في شبكتك المحلية
          </p>
        </div>
        <Button 
          onClick={() => scanMutation.mutate()} 
          disabled={isScanning}
          className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-6 rounded-xl transition-all shadow-lg ${isScanning ? 'shadow-blue-500/50 animate-pulse' : 'hover:shadow-blue-500/30'}`}
        >
          {isScanning ? (
            <span className="flex items-center gap-2"><Search className="animate-spin" /> جاري البحث...</span>
          ) : (
            <span className="flex items-center gap-2"><Search /> بدء المسح</span>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Radar Animation Card */}
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="col-span-full md:col-span-1 glass-card p-8 flex flex-col items-center justify-center rounded-3xl border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.15)] relative overflow-hidden h-64"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_70%)]" />
            <div className="w-32 h-32 rounded-full border border-blue-500/50 flex items-center justify-center relative">
              <div className="absolute w-full h-full rounded-full border border-blue-400/20 animate-ping duration-1000" />
              <div className="absolute w-24 h-24 rounded-full border border-blue-400/30 animate-ping duration-1000 delay-150" />
              <Wifi className="w-12 h-12 text-blue-400 animate-pulse" />
            </div>
            <p className="mt-6 text-blue-400 font-medium z-10">جاري مسح الشبكة المحلية (mDNS)...</p>
          </motion.div>
        )}

        {/* Found Nodes */}
        {!isLoading && pendingNodes.length === 0 && !isScanning && (
          <div className="col-span-full text-center text-zinc-500 py-20 glass-card rounded-3xl border border-white/5">
            <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">لم يتم العثور على أجهزة جديدة.</p>
            <p className="text-sm mt-2">تأكد من توصيل أجهزة ESP32 بالكهرباء ونفس شبكة الواي فاي.</p>
          </div>
        )}

        {pendingNodes.map((node: any, idx: number) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="glass-card border-white/10 hover:border-blue-500/30 transition-all duration-300 rounded-2xl overflow-hidden group">
              <div className="h-2 w-full bg-gradient-to-r from-blue-500 to-purple-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                      <Cpu className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <span>{node.name || 'لوحة ESP32 جديدة'}</span>
                      <p className="text-xs text-zinc-400 font-mono mt-1">{node.mac}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
                    <Activity size={12} /> متصل
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2 mb-6 text-sm text-zinc-300">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-zinc-500">عنوان IP</span>
                    <span className="font-mono text-blue-300">{node.ip || '192.168.1.xxx'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-zinc-500">نسخة النظام</span>
                    <span>{node.firmware || 'v1.0.0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">عدد المخارج</span>
                    <span>{node.devices?.length || 4} Relay</span>
                  </div>
                </div>
                <Button 
                  onClick={() => approveMutation.mutate(node.id)}
                  disabled={approveMutation.isPending}
                  className="w-full bg-white/5 hover:bg-blue-600 text-white font-medium py-5 border border-white/10 hover:border-transparent transition-all rounded-xl flex items-center justify-center gap-2"
                >
                  {approveMutation.isPending ? 'جاري الإضافة...' : <><Plus size={18} /> إضافة إلى المنزل</>}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
