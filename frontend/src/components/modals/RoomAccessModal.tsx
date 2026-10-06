'use client';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export default function RoomAccessModal({ user, onClose, onSuccess }: any) {
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [userRooms, setUserRooms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const [roomsRes, userRoomsRes] = await Promise.all([
          api.get('/rooms'),
          api.get(`/users/${user.id}/rooms`)
        ]);
        setAllRooms(roomsRes.data);
        setUserRooms(userRoomsRes.data.map((r: any) => r.id));
      } catch (err) {
        console.error('Failed to fetch rooms');
      }
    };
    if (user.role !== 'ADMIN') {
      fetchRooms();
    }
  }, [user]);

  const toggleAccess = async (roomId: string, hasAccess: boolean) => {
    setLoading(true);
    try {
      if (hasAccess) {
        await api.delete(`/users/${user.id}/rooms/${roomId}`);
        setUserRooms(prev => prev.filter(id => id !== roomId));
      } else {
        await api.post(`/users/${user.id}/rooms`, { roomId });
        setUserRooms(prev => [...prev, roomId]);
      }
    } catch (err) {
      alert('حدث خطأ أثناء تعديل الصلاحية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" dir="rtl">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold text-zinc-100 mb-2">إدارة الغرف</h2>
        <p className="text-sm text-zinc-400 mb-6">للمستخدم: <span className="text-zinc-100 font-bold">{user.username}</span></p>
        
        {user.role === 'ADMIN' ? (
          <div className="bg-zinc-800/50 p-6 rounded-lg text-center border border-zinc-800">
            <p className="text-emerald-400 font-medium">المدير لديه صلاحية وصول كاملة لجميع الغرف والأجهزة تلقائياً.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
            {allRooms.map(room => {
              const hasAccess = userRooms.includes(room.id);
              return (
                <div key={room.id} className="flex items-center space-x-3 space-x-reverse bg-zinc-950 border border-zinc-800 p-3 rounded-lg">
                  <Checkbox 
                    id={room.id} 
                    checked={hasAccess} 
                    disabled={loading}
                    onCheckedChange={() => toggleAccess(room.id, hasAccess)}
                  />
                  <label 
                    htmlFor={room.id} 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-zinc-300 cursor-pointer flex-1"
                  >
                    {room.name}
                  </label>
                </div>
              );
            })}
            {allRooms.length === 0 && (
              <p className="text-zinc-500 text-center py-4">لم تقم بإضافة أي غرفة في النظام بعد.</p>
            )}
          </div>
        )}
        
        <div className="flex justify-end pt-6 mt-4 border-t border-zinc-800">
          <Button type="button" variant="ghost" onClick={onSuccess}>إغلاق</Button>
        </div>
      </div>
    </div>
  );
}
