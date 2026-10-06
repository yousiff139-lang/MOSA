"use client";

import { useState } from 'react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { confirmAction, notify } from '@/store/useConfirmStore';
import { Plus, Trash2, Home as HomeIcon } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RoomManager() {
  const rooms = useSmartHomeStore(s => s.rooms);
  const initBackendConnection = useSmartHomeStore(s => s.initBackendConnection);
  
  const [newRoomName, setNewRoomName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetchAuth('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName })
      });
      if (res.ok) {
        setNewRoomName('');
        initBackendConnection();
        notify('تم إضافة الغرفة بنجاح 🏠', 'success');
      } else {
        notify('فشل إضافة الغرفة', 'error');
      }
    } catch (err) {
      console.error(err);
      notify('فشل الاتصال بالخادم', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    confirmAction({
      title: 'حذف الغرفة 🏠',
      message: 'هل أنت متأكد من حذف هذه الغرفة؟',
      variant: 'danger',
      confirmText: 'حذف الغرفة',
      cancelText: 'تراجع',
      onConfirm: async () => {
        try {
          const res = await fetchAuth(`/api/rooms/${id}`, { method: 'DELETE' });
          if (res.ok) {
            initBackendConnection();
            notify('تم حذف الغرفة بنجاح', 'success');
          } else {
            notify('فشل الحذف', 'error');
          }
        } catch (err) {
          console.error(err);
          notify('فشل الاتصال بالخادم', 'error');
        }
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-8 pb-32">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">إدارة الغرف</h1>
        <p className="text-gray-400">تحكم في تقسيم المنزل وإضافة غرف جديدة.</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-xl mb-8">
        <form onSubmit={handleAddRoom} className="flex gap-4">
          <input 
            type="text" 
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="اسم الغرفة (مثال: غرفة المعيشة)" 
            className="flex-1 bg-black/20 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
            required
          />
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 transition-colors shadow-lg disabled:opacity-50"
          >
            <Plus size={20} /> إضافة
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rooms.map(room => (
          <motion.div 
            key={room.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                <HomeIcon size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{room.name}</h3>
                <p className="text-white/50 text-sm">{room._count?.devices || 0} أجهزة مقترنة</p>
              </div>
            </div>
            
            <button 
              onClick={() => handleDelete(room.id)}
              className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </motion.div>
        ))}
        {rooms.length === 0 && (
          <div className="col-span-full p-8 text-center text-white/50 bg-white/5 rounded-[2rem] border border-white/10">
            لا توجد غرف حالياً. قم بإضافة غرفة جديدة للبدء.
          </div>
        )}
      </div>
    </div>
  );
}
