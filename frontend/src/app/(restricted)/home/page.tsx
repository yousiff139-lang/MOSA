'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Power, Lightbulb, Thermometer, Droplets, Fan } from 'lucide-react';
import { motion } from 'framer-motion';

const allowedDevices = [
  { id: '1', name: 'إضاءة الصالة', type: 'light', state: true, room: 'الصالة' },
  { id: '2', name: 'المكيف', type: 'ac', state: false, room: 'الصالة' },
  { id: '3', name: 'إضاءة الممر', type: 'light', state: false, room: 'الممرات' },
];

export default function RestrictedHomePage() {
  return (
    <div className="animate-in fade-in duration-700">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white drop-shadow-md">أهلاً بك 👋</h1>
        <p className="text-sm text-zinc-400 mt-2">يمكنك التحكم بالأجهزة المسموحة لك أدناه</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {allowedDevices.map((device, idx) => (
          <motion.div
            key={device.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="glass-card border-[#1e293b] overflow-hidden rounded-3xl relative group cursor-pointer hover:border-white/20 transition-all">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-2xl ${device.state ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-zinc-400'}`}>
                    {device.type === 'light' ? <Lightbulb size={24} /> : <Fan size={24} />}
                  </div>
                  
                  <div 
                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${device.state ? 'bg-blue-500' : 'bg-zinc-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${device.state ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-white">{device.name}</h3>
                  <p className="text-xs text-zinc-400">{device.room}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
