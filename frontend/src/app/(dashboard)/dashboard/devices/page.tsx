'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Cpu, Wifi, Lightbulb, Zap, Search, Filter, Tv } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import { RemoteControlModal } from '@/components/modals/RemoteControlModal';

const API_BASE = 'http://localhost:8080/api';
export default function DevicesPage() {
  const [activeTab, setActiveTab] = useState<'devices' | 'controllers'>('devices');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRemoteDevice, setActiveRemoteDevice] = useState<any>(null);
  
  // Missing states from previous edits
  const [isScanning, setIsScanning] = useState(false);
  const [networkScan, setNetworkScan] = useState<any[]>([]);
  const [showControllerModal, setShowControllerModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedMacForPin, setSelectedMacForPin] = useState<any>(null);

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const handleNetworkScan = async () => {
    setIsScanning(true);
    try {
      await axios.post(`${API_BASE}/discovery/scan`, {}, { withCredentials: true });
      // In reality, this might stream or we poll, but we'll simulate for now
      setTimeout(() => setIsScanning(false), 10000);
    } catch (e) {
      console.error(e);
      setIsScanning(false);
    }
  };

  const deleteController = async (id: string) => {
    if(confirm('هل أنت متأكد من الحذف؟')) {
      await axios.delete(`${API_BASE}/controllers/${id}`, { withCredentials: true });
      queryClient.invalidateQueries({ queryKey: ['controllers'] });
    }
  };

  const fetchData = () => {
    queryClient.invalidateQueries({ queryKey: ['devices'] });
    queryClient.invalidateQueries({ queryKey: ['controllers'] });
  };

  const { data: devices = [], isLoading: isLoadingDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/devices`, { withCredentials: true });
      return res.data;
    }
  });

  const { data: controllers = [], isLoading: isLoadingControllers } = useQuery({
    queryKey: ['controllers'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/controllers`, { withCredentials: true });
      return res.data;
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, state }: { id: string, state: string }) => {
      // ACTIVE-LOW INVERSION LOGIC
      // If user wants ON, we send OFF (HIGH voltage = 1 = OFF for active-low)
      // If user wants OFF, we send ON (LOW voltage = 0 = ON for active-low)
      // Note: The physical hardware is active-low, so we invert the command.
      const invertedCommand = state === 'ON' ? 'OFF' : 'ON';
      await axios.post(`${API_BASE}/devices/${id}/toggle`, { state: invertedCommand }, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    }
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${API_BASE}/devices/${id}`, { withCredentials: true });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] })
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-700" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white drop-shadow-md">إدارة الأجهزة</h1>
          <p className="text-sm text-zinc-400 mt-1">التحكم في جميع أجهزة ومتحكمات المنزل</p>
        </div>
        
        <div className="flex gap-2 bg-[#111827] p-1 rounded-xl border border-[#1e293b]">
          <Button 
            className={`rounded-lg ${activeTab === 'devices' ? 'bg-[#3b82f6] text-white' : 'bg-transparent text-zinc-400 hover:text-white'}`}
            onClick={() => setActiveTab('devices')}
          >
            الأجهزة
          </Button>
          <Button 
            className={`rounded-lg ${activeTab === 'controllers' ? 'bg-[#3b82f6] text-white' : 'bg-transparent text-zinc-400 hover:text-white'}`}
            onClick={() => setActiveTab('controllers')}
          >
            المتحكمات
          </Button>
        </div>
      </div>

      {activeTab === 'devices' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-3 w-5 h-5 text-zinc-500" />
              <input 
                type="text" 
                placeholder="ابحث عن جهاز..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e293b] text-white rounded-xl py-3 pr-10 pl-4 focus:outline-none focus:border-[#3b82f6] transition-colors"
              />
            </div>
            {isAdmin && (
              <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl shadow-lg shadow-blue-500/20">
                <Plus size={18} className="ml-2"/> إضافة جهاز جديد
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {isLoadingDevices ? (
              <div className="col-span-full text-center text-zinc-500 py-12 glass-card">جاري التحميل...</div>
            ) : devices.filter((d:any) => d.name.includes(searchQuery)).length === 0 ? (
              <div className="col-span-full text-center text-zinc-500 py-12 glass-card rounded-3xl border border-[#1e293b]">لا توجد أجهزة مطابقة للبحث.</div>
            ) : (
              devices.filter((d:any) => d.name.includes(searchQuery)).map((device: any, idx: number) => {
                // ACTIVE-LOW DISPLAY LOGIC
                // The DB stores the raw state. If it's 'OFF', it means the relay is receiving HIGH, 
                // which means it's physically OFF. Wait, earlier we inverted the command.
                // If the hardware is Active-Low, and we sent 'OFF' to turn it ON...
                // The DB will store 'OFF'. So if DB == 'OFF', the UI should show it as ON!
                const isUIOn = device.currentState === 'OFF'; 

                return (
                  <motion.div key={device.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}>
                    <Card className="glass-card border-[#1e293b] hover:border-blue-500/30 transition-all duration-300 rounded-3xl overflow-hidden group hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                      <CardHeader className="pb-3 border-b border-[#1e293b]/50 bg-black/10">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-2xl transition-all duration-500 ${isUIOn ? 'bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-[#111827] text-zinc-500'}`}>
                              {device.type === 'LIGHT' ? <Lightbulb size={24} /> : <Zap size={24} />}
                            </div>
                            <div>
                              <CardTitle className="text-lg text-white">{device.name}</CardTitle>
                              <p className="text-xs text-zinc-400 font-mono mt-1">{device.ipAddress ? `IP: ${device.ipAddress}` : `Pin: ${device.pinNumber}`} | {device.type}</p>
                            </div>
                          </div>
                          
                          {(device.type === 'smart_tv' || device.type === 'media_player') ? (
                            <Button 
                              variant="secondary" 
                              className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded-xl"
                              onClick={() => setActiveRemoteDevice(device)}
                            >
                              <Tv size={16} className="mr-2" />
                              ريموت
                            </Button>
                          ) : (
                            <Switch 
                              checked={isUIOn}
                              onCheckedChange={(checked) => toggleMutation.mutate({ id: device.id, state: checked ? 'ON' : 'OFF' })}
                              className="data-[state=checked]:bg-blue-500"
                              disabled={toggleMutation.isPending}
                            />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 flex justify-between items-center bg-[#0a0f1e]/30">
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Cpu size={14} /> {device.controller?.name || 'متحكم غير معروف'}
                        </span>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              if(confirm('هل أنت متأكد من الحذف؟')) deleteDeviceMutation.mutate(device.id);
                            }} 
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-xl h-8 w-8"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'controllers' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            {isAdmin && <Button onClick={() => setShowControllerModal(true)}><Plus size={16} className="ml-2"/> إضافة متحكم (ESP32)</Button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {controllers.map(ctrl => (
              <Card key={ctrl.id} className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row justify-between items-start pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-800 rounded-lg"><Cpu size={20} className="text-zinc-300"/></div>
                    <div>
                      <CardTitle className="text-lg">{ctrl.name}</CardTitle>
                      <span className="text-xs text-zinc-500 font-mono">{ctrl.macAddress}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => deleteController(ctrl.id)} className="text-red-400 hover:bg-red-400/10 -mt-2 -mr-2">
                      <Trash2 size={16} />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">الأجهزة المتصلة:</span>
                    <span className="text-zinc-100 font-bold">{ctrl._count?.devices || 0}</span>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-800">
                    <Badge variant={ctrl.status === 'ONLINE' ? 'default' : 'destructive'} className={ctrl.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : ''}>
                      {ctrl.status}
                    </Badge>
                    <span className="text-xs text-zinc-500">{ctrl.ipAddress || 'IP غير متوفر'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'network' && isAdmin && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>اكتشاف الشبكة المحلية</CardTitle>
            <Button onClick={handleNetworkScan} disabled={isScanning} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isScanning ? <RefreshCw className="animate-spin ml-2" size={16}/> : <Wifi className="ml-2" size={16}/>}
              {isScanning ? 'جاري الفحص...' : 'فحص الشبكة'}
            </Button>
          </CardHeader>
          <CardContent>
            {networkScan.length === 0 && !isScanning ? (
              <div className="text-center py-12 text-zinc-500">قم بفحص الشبكة للبحث عن متحكمات ESP32 الجديدة.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-zinc-300">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="py-3 px-4">عنوان IP</th>
                      <th className="py-3 px-4">عنوان MAC</th>
                      <th className="py-3 px-4">اسم المضيف</th>
                      <th className="py-3 px-4">تخمين النوع</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {networkScan.map((dev, i) => (
                      <tr key={i} className="border-b border-zinc-800/50">
                        <td className="py-3 px-4 font-mono">{dev.ip}</td>
                        <td className="py-3 px-4 font-mono">{dev.mac}</td>
                        <td className="py-3 px-4">{dev.hostname}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={dev.deviceType === 'ESP32' ? 'text-purple-400 border-purple-400/30' : 'text-zinc-400 border-zinc-700'}>
                            {dev.deviceType || 'مجهول'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={dev.status === 'REGISTERED' ? 'outline' : 'secondary'} className={dev.status === 'REGISTERED' ? 'text-emerald-400 border-emerald-400/30' : 'bg-blue-500/20 text-blue-400'}>
                            {dev.status === 'REGISTERED' ? 'مسجل مسبقاً' : 'جهاز جديد'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {dev.status !== 'REGISTERED' && (
                            <Button size="sm" onClick={() => {
                              setSelectedMacForPin({ mac: dev.mac, ip: dev.ip });
                              setShowControllerModal(true);
                            }}>
                              إضافة كمتحكم
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showControllerModal && (
        <ControllerModal 
          onClose={() => { setShowControllerModal(false); setSelectedMacForPin(null); }}
          onSuccess={() => { setShowControllerModal(false); fetchData(); }}
          initialData={selectedMacForPin}
        />
      )}

      {showPinModal && (
        <PinMappingModal 
          controllers={controllers}
          onClose={() => setShowPinModal(false)}
          onSuccess={() => { setShowPinModal(false); fetchData(); }}
        />
      )}

      {activeRemoteDevice && (
        <RemoteControlModal 
          device={activeRemoteDevice}
          onClose={() => setActiveRemoteDevice(null)}
        />
      )}
    </div>
  );
}
