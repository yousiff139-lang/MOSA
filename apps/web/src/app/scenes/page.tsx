"use client";

import { useState, useEffect } from 'react';
import { 
  Puzzle, Sun, Moon, Film, Coffee, Shield, Bed, Home, Music, 
  Plus, Play, Trash2, X, AlertCircle, Check, Eye, Info, Edit3, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAuth } from '@/store/useSmartHomeStore';

interface Scene {
  id: string;
  name: string;
  actions: any[];
  icon: string;
  isActive: boolean;
}

export default function ScenesPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  
  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Sun');
  const [sceneActions, setSceneActions] = useState<Array<{ deviceId: string; state: 'ON' | 'OFF' }>>([
    { deviceId: '', state: 'ON' }
  ]);
  const [error, setError] = useState('');

  // Info Modal State
  const [infoScene, setInfoScene] = useState<Scene | null>(null);

  const iconMap: Record<string, any> = {
    'Sun': Sun, 'Film': Film, 'Moon': Moon, 'Coffee': Coffee,
    'Home': Home, 'Shield': Shield, 'Bed': Bed, 'Music': Music
  };

  const colors = [
    'from-amber-400 to-orange-500',
    'from-purple-500 to-indigo-600',
    'from-blue-400 to-indigo-900',
    'from-teal-400 to-emerald-600',
    'from-gray-500 to-slate-800',
    'from-red-500 to-rose-700'
  ];

  const fetchDevices = async () => {
    try {
      const res = await fetchAuth('/api/devices');
      if (res.ok) {
        const data = await res.json();
        setDevices(data.filter((d: any) => !['sensor_temp', 'moisture', 'energy'].includes(d.type?.toLowerCase())));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchScenes = async () => {
    try {
      const res = await fetchAuth('/api/scenes');
      if (res.ok) {
        const data = await res.json();
        setScenes(data);
      }
    } catch (e) {
      console.error('Failed to fetch scenes', e);
    }
  };

  useEffect(() => {
    fetchScenes();
    fetchDevices();
  }, []);

  const handleExecute = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetchAuth(`/api/scenes/${id}/execute`, { method: 'POST' });
      if (res.ok) {
        setScenes(prev => prev.map(s => s.id === id ? { ...s, isActive: true } : { ...s, isActive: false }));
        setTimeout(() => {
          setScenes(prev => prev.map(s => s.id === id ? { ...s, isActive: false } : s));
        }, 3000);
      } else {
        alert('فشل تفعيل السيناريو');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا السيناريو؟')) return;
    try {
      const res = await fetchAuth(`/api/scenes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setScenes(prev => prev.filter(s => s.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAdd = () => {
    setEditingSceneId(null);
    setName('');
    setSelectedIcon('Sun');
    setSceneActions([{ deviceId: '', state: 'ON' }]);
    setError('');
    setIsOpen(true);
  };

  const handleOpenEdit = (scene: Scene) => {
    setEditingSceneId(scene.id);
    setName(scene.name);
    setSelectedIcon(scene.icon || 'Sun');
    
    // Parse actions if available
    if (scene.actions && Array.isArray(scene.actions) && scene.actions.length > 0) {
      setSceneActions(scene.actions.map((act: any) => ({
        deviceId: act.deviceId || '',
        state: act.state || 'ON'
      })));
    } else {
      setSceneActions([{ deviceId: '', state: 'ON' }]);
    }
    
    setError('');
    setIsOpen(true);
  };

  const handleAddAction = () => {
    setSceneActions([...sceneActions, { deviceId: '', state: 'ON' }]);
  };

  const handleRemoveAction = (index: number) => {
    setSceneActions(sceneActions.filter((_, i) => i !== index));
  };

  const handleActionChange = (index: number, key: 'deviceId' | 'state', value: any) => {
    const updated = [...sceneActions];
    updated[index] = { ...updated[index], [key]: value };
    setSceneActions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name) {
      setError('يرجى كتابة اسم السيناريو');
      return;
    }

    if (sceneActions.some(act => !act.deviceId)) {
      setError('يرجى تحديد أجهزة صالحة لجميع الإجراءات');
      return;
    }

    try {
      const payload = {
        name,
        icon: selectedIcon,
        actions: sceneActions.map(act => ({
          type: 'device_control',
          deviceId: act.deviceId,
          state: act.state
        }))
      };

      const url = editingSceneId ? `/api/scenes/${editingSceneId}` : '/api/scenes';
      const method = editingSceneId ? 'PUT' : 'POST';

      const res = await fetchAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsOpen(false);
        setName('');
        setEditingSceneId(null);
        setSceneActions([{ deviceId: '', state: 'ON' }]);
        fetchScenes();
      } else {
        const data = await res.json();
        setError(data.message || 'فشل حفظ السيناريو');
      }
    } catch (err) {
      setError('حدث خطأ في الشبكة');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 w-full" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Puzzle className="text-blue-400" size={32} />
            السيناريوهات والوضعيات الذكية
          </h1>
          <p className="text-gray-400 mt-1 text-sm">تفعيل مجموعة من الأوامر بضغطة زر واحدة لتغيير بيئة المنزل بالكامل</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg hover:scale-105 text-sm self-start sm:self-auto"
        >
          <Plus size={18} />
          إضافة سيناريو جديد
        </button>
      </div>

      {/* Scenes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {scenes.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center bg-black/20 border border-dashed border-white/10 rounded-[2rem] text-center">
            <Puzzle size={48} className="text-white/20 mb-4 animate-pulse" />
            <p className="text-white/60 font-bold text-sm">لا توجد سيناريوهات مسجلة حالياً.</p>
            <p className="text-white/30 text-xs mt-1">اضغط على إضافة سيناريو لتشغيل عدة أجهزة معاً بضغطة زر.</p>
          </div>
        ) : (
          scenes.map((scene, i) => {
            const Icon = iconMap[scene.icon] || Puzzle;
            const colorClass = colors[i % colors.length];
            return (
              <div 
                key={scene.id}
                onClick={() => handleExecute(scene.id)}
                className={`relative overflow-hidden rounded-[2rem] border transition-all duration-500 p-6 flex flex-col group min-h-[220px] cursor-pointer hover:-translate-y-2 ${
                  scene.isActive 
                    ? 'bg-[#1a2333]/80 border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)]' 
                    : 'bg-[#11151c]/80 border-white/5 hover:bg-[#1a2333]/50 hover:border-white/10'
                }`}
              >
                {/* Background Gradient Mesh */}
                <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gradient-to-br ${colorClass} blur-3xl opacity-10 group-hover:opacity-30 transition-opacity duration-700`}></div>

                <div className="flex justify-between items-start z-10 relative mb-auto">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${colorClass} shadow-lg shadow-black/30`}>
                    <Icon size={26} className="text-white drop-shadow-md" />
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
                    {/* Info Button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setInfoScene(scene); }}
                      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-blue-500/20 text-slate-300 hover:text-blue-400 flex items-center justify-center transition-all border border-white/5"
                      title="معلومات السيناريو والأجهزة"
                    >
                      <Info size={15} />
                    </button>

                    {/* Edit Button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenEdit(scene); }}
                      className="w-8 h-8 rounded-xl bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 flex items-center justify-center transition-all border border-white/5"
                      title="تعديل السيناريو"
                    >
                      <Edit3 size={15} />
                    </button>

                    {/* Delete Button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(scene.id); }}
                      className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/20 transition-all"
                      title="حذف السيناريو"
                    >
                      <Trash2 size={15} />
                    </button>
                    
                    {/* Play Button */}
                    <button className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all backdrop-blur-md border ${
                      scene.isActive 
                        ? 'bg-white text-[#0b0e14] border-white shadow-[0_0_20px_rgba(255,255,255,0.5)]' 
                        : 'bg-white/5 text-white/50 border-white/10 group-hover:bg-white/20 group-hover:text-white'
                    }`}>
                      <Play size={16} className={scene.isActive ? '' : 'ml-0.5'} fill={scene.isActive ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>

                <div className="z-10 relative mt-6">
                  <h3 className="text-xl font-bold text-white mb-1">{scene.name}</h3>
                  <p className={`text-xs font-semibold ${scene.isActive ? 'text-[#00d0f0]' : 'text-gray-500 group-hover:text-gray-400'}`}>
                    {loadingId === scene.id ? 'جاري تشغيل السيناريو...' : (scene.isActive ? 'نشط الآن' : 'انقر للتفعيل')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info / Details Modal */}
      <AnimatePresence>
        {infoScene && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b0e14] border border-blue-500/20 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative p-6 md:p-8 space-y-6"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
                    <Info size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{infoScene.name}</h3>
                    <p className="text-xs text-slate-400">تفاصيل الأجهزة المتأثرة بالسيناريو</p>
                  </div>
                </div>
                <button onClick={() => setInfoScene(null)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={22} />
                </button>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">الأجهزة المرتبطة ({infoScene.actions?.length || 0}):</h4>
                {(!infoScene.actions || infoScene.actions.length === 0) ? (
                  <p className="text-xs text-slate-500 italic">لا توجد أجهزة مسجلة في هذا السيناريو.</p>
                ) : (
                  infoScene.actions.map((act: any, idx: number) => {
                    const dev = devices.find(d => d.id === act.deviceId);
                    return (
                      <div key={idx} className="flex items-center justify-between bg-white/[0.03] p-3 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2.5">
                          <Cpu size={16} className="text-blue-400" />
                          <span className="text-xs font-bold text-white">{dev ? dev.name : (act.deviceId || 'جهاز مجهول')}</span>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                          act.state === 'ON' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {act.state === 'ON' ? 'تشغيل ON' : 'إيقاف OFF'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    const current = infoScene;
                    setInfoScene(null);
                    handleOpenEdit(current);
                  }}
                  className="px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-bold rounded-xl text-xs flex items-center gap-2"
                >
                  <Edit3 size={14} /> تعديل السيناريو
                </button>
                <button
                  onClick={() => setInfoScene(null)}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create / Edit Scene Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b0e14] border border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
              
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    {editingSceneId ? <Edit3 size={24} className="text-amber-400" /> : <Plus size={24} className="text-blue-400" />}
                    {editingSceneId ? 'تعديل السيناريو' : 'إنشاء سيناريو مخصص جديد'}
                  </h3>
                  <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                    <X size={24} />
                  </button>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400">اسم السيناريو</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثال: وضع النوم أو سيناريو الخروج"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors text-xs"
                    />
                  </div>

                  {/* Icon selector */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400">رمز الأيقونة</label>
                    <div className="flex flex-wrap gap-2 bg-white/5 p-3 rounded-2xl border border-white/5">
                      {Object.keys(iconMap).map(key => {
                        const Icon = iconMap[key];
                        const isSelected = selectedIcon === key;
                        return (
                          <button
                            type="button"
                            key={key}
                            onClick={() => setSelectedIcon(key)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                              isSelected ? 'bg-blue-600 text-white shadow-md' : 'text-white/40 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <Icon size={18} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions mapping */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-gray-400">الأجهزة التابعة والإجراءات</label>
                      <button
                        type="button"
                        onClick={handleAddAction}
                        className="flex items-center gap-1.5 px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-bold"
                      >
                        <Plus size={10} /> إضافة جهاز
                      </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {sceneActions.map((act, index) => (
                        <div key={index} className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                          <div className="flex-1">
                            <select
                              value={act.deviceId}
                              onChange={e => handleActionChange(index, 'deviceId', e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-2 py-2 text-[10px] text-white"
                            >
                              <option value="">اختر الجهاز...</option>
                              {devices.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <select
                              value={act.state}
                              onChange={e => handleActionChange(index, 'state', e.target.value)}
                              className="bg-black/40 border border-white/10 rounded-xl px-2 py-2 text-[10px] text-white"
                            >
                              <option value="ON">تشغيل (ON)</option>
                              <option value="OFF">إيقاف (OFF)</option>
                            </select>
                          </div>
                          {sceneActions.length > 1 && (
                            <button 
                              type="button"
                              onClick={() => handleRemoveAction(index)}
                              className="text-red-400 hover:text-red-300 p-2 bg-red-400/10 rounded-xl"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-all text-xs"
                  >
                    {editingSceneId ? 'تحديث وحفظ التعديلات' : 'حفظ وإضافة السيناريو'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
