'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Settings2, Trash2, Edit, Activity, Play } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import AutomationModal from '@/components/modals/AutomationModal';

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN';

  const fetchAutomations = async () => {
    try {
      const res = await api.get('/automations');
      setAutomations(res.data);
    } catch (err) {
      console.error('Failed to fetch automations');
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await api.post(`/automations/${id}/toggle`);
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, isActive: !current } : a));
    } catch (err) {
      alert('فشل في تغيير الحالة');
    }
  };

  const deleteAutomation = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await api.delete(`/automations/${id}`);
      fetchAutomations();
    } catch (err) {
      alert('فشل الحذف');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-100">الأتمتة والسيناريوهات</h1>
        {isAdmin && (
          <Button onClick={() => { setEditingItem(null); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus size={16} className="ml-2"/> إضافة قاعدة جديدة
          </Button>
        )}
      </div>

      {automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50">
          <Settings2 size={48} className="text-zinc-600 mb-4" />
          <h2 className="text-xl font-medium text-zinc-400">لا توجد قواعد أتمتة. أضف قاعدة جديدة لتشغيل الأجهزة تلقائياً.</h2>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {automations.map(auto => {
            const isScene = !auto.conditions || auto.conditions.length === 0;
            return (
              <Card key={auto.id} className="bg-zinc-900 border-zinc-800 overflow-hidden flex flex-col">
                <CardHeader className="flex flex-row justify-between items-start pb-2 bg-zinc-950/50">
                  <div>
                    <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                      {isScene ? <Play size={18} className="text-purple-400" /> : <Activity size={18} className="text-blue-400" />}
                      {auto.name}
                    </CardTitle>
                    <p className="text-xs text-zinc-500 mt-1">{isScene ? 'سيناريو مباشر' : 'أتمتة شرطية'}</p>
                  </div>
                  {isAdmin && (
                    <Switch 
                      checked={auto.isActive} 
                      onCheckedChange={() => toggleActive(auto.id, auto.isActive)} 
                    />
                  )}
                </CardHeader>
                
                <CardContent className="pt-4 flex-1 space-y-4">
                  {!isScene && (
                    <div className="bg-zinc-950 rounded-md p-3 border border-zinc-800/50">
                      <p className="text-xs text-zinc-500 mb-2 font-bold">الشروط (إذا):</p>
                      <ul className="text-sm text-zinc-300 space-y-1">
                        {auto.conditions.map((c: any, i: number) => (
                          <li key={i} className="flex items-center gap-2 before:content-['•'] before:text-blue-500">
                            {c.type === 'time' ? `الوقت ${c.time}` : 
                             c.type === 'sensor_value' ? `حساس ${c.operator} ${c.value}` : 
                             `تغير حالة جهاز إلى ${c.state}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-zinc-950 rounded-md p-3 border border-zinc-800/50">
                    <p className="text-xs text-zinc-500 mb-2 font-bold">الأفعال (قم بـ):</p>
                    <ul className="text-sm text-zinc-300 space-y-1">
                      {auto.actions.map((a: any, i: number) => (
                        <li key={i} className="flex items-center gap-2 before:content-['•'] before:text-emerald-500">
                          {a.type === 'device_control' ? `تحكم بجهاز → ${a.state}` : `إرسال إشعار`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>

                {isAdmin && (
                  <CardFooter className="pt-4 border-t border-zinc-800 bg-zinc-950/30 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingItem(auto); setShowModal(true); }} className="text-zinc-400 hover:text-blue-400">
                      <Edit size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteAutomation(auto.id)} className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 size={16} />
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showModal && (
        <AutomationModal 
          initialData={editingItem}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchAutomations(); }}
        />
      )}
    </div>
  );
}
