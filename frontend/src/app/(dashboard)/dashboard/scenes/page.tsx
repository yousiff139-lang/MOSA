'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Clock, Play } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import SceneModal from '@/components/modals/SceneModal';

export default function ScenesPage() {
  const [scenes, setScenes] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [executing, setExecuting] = useState<Record<string, boolean>>({});

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN';

  const fetchScenes = async () => {
    try {
      const res = await api.get('/scenes');
      setScenes(res.data);
    } catch (err) {
      console.error('Failed to fetch scenes');
    }
  };

  useEffect(() => {
    fetchScenes();
  }, []);

  const deleteScene = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await api.delete(`/scenes/${id}`);
      fetchScenes();
    } catch (err) {
      alert('فشل الحذف');
    }
  };

  const executeScene = async (id: string) => {
    setExecuting(prev => ({ ...prev, [id]: true }));
    try {
      await api.post(`/scenes/${id}/execute`);
      // Note: socket will trigger the toast alert!
    } catch (err) {
      alert('فشل في التنفيذ');
    } finally {
      setTimeout(() => setExecuting(prev => ({ ...prev, [id]: false })), 1000); // UI feel
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-100">السيناريوهات</h1>
        {isAdmin && (
          <Button onClick={() => { setEditingItem(null); setShowModal(true); }} className="bg-zinc-100 text-zinc-900 hover:bg-zinc-300">
            <Plus size={16} className="ml-2"/> إضافة سيناريو
          </Button>
        )}
      </div>

      {scenes.length === 0 ? (
        <div className="space-y-6">
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
            <h2 className="text-xl font-medium text-zinc-400 mb-2">لا توجد سيناريوهات مضافة بعد.</h2>
            <p className="text-sm text-zinc-500">أضف سيناريو بضغطة زر للتحكم بعدة أجهزة معاً.</p>
          </div>
          
          {/* Suggestions */}
          {isAdmin && (
            <div>
              <h3 className="text-lg font-medium text-zinc-300 mb-4">اقتراحات يمكنك إضافتها:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['🌙 وضع النوم', '🏠 وضع المغادرة', '🎬 وضع السينما', '☀️ وضع الصباح'].map((s, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center cursor-pointer hover:bg-zinc-800 transition"
                       onClick={() => { setEditingItem({ name: s.split(' ').slice(1).join(' '), icon: s.split(' ')[0] }); setShowModal(true); }}>
                    <div className="text-3xl mb-2">{s.split(' ')[0]}</div>
                    <div className="font-medium text-zinc-300">{s.split(' ').slice(1).join(' ')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {scenes.map(scene => (
            <Card key={scene.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all overflow-hidden flex flex-col group">
              <CardContent className="p-0 flex flex-col h-full">
                <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
                  <div className="text-5xl mb-4 bg-zinc-800/50 w-24 h-24 rounded-full flex items-center justify-center shadow-inner">
                    {scene.icon || '🎬'}
                  </div>
                  <h3 className="text-xl font-bold text-zinc-100 mb-2">{scene.name}</h3>
                  <div className="flex gap-2 items-center justify-center">
                    <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-full">{scene.actions?.length || 0} أوامر</span>
                    {scene.conditions && scene.conditions.length > 0 && scene.conditions[0]?.type === 'time' && (
                      <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded-full flex items-center gap-1 border border-blue-800/50">
                        <Clock size={12} /> {scene.conditions[0].time}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-2">
                  <Button 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg" 
                    onClick={() => executeScene(scene.id)}
                    disabled={executing[scene.id]}
                  >
                    {executing[scene.id] ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <><Play size={16} className="ml-2 fill-current" /> تشغيل</>
                    )}
                  </Button>
                  
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingItem(scene); setShowModal(true); }} className="text-zinc-400 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit size={16} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteScene(scene.id)} className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <SceneModal 
          initialData={editingItem}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchScenes(); }}
        />
      )}
    </div>
  );
}
