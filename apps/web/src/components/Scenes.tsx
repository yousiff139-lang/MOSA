"use client";

import { useState, useEffect } from 'react';
import { Film, Moon, Sun, PowerOff, Plus, Play, Trash2 } from 'lucide-react';
import { Device } from '@/types';
import { fetchAuth } from '@/store/useSmartHomeStore';

interface ScenesProps {
  onExecuteScene: (sceneType: string, customDevices?: any[], sceneId?: string) => void;
  devices: Device[];
}

export function Scenes({ onExecuteScene, devices }: ScenesProps) {
  const [customScenes, setCustomScenes] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [newSceneDevices, setNewSceneDevices] = useState<{id: number, state: boolean}[]>([]);
  const [loading, setLoading] = useState(true);

  const getTargetUrl = () => '';

  useEffect(() => {
    loadScenes();
  }, []);

  const loadScenes = async () => {
    try {
      const res = await fetchAuth(`${getTargetUrl()}/api/scenes`);
      if (res.ok) {
        const data = await res.json();
        setCustomScenes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScene = async () => {
    if (!newSceneName || newSceneDevices.length === 0) return;
    try {
      const actions = newSceneDevices.map(d => ({ deviceId: d.id, state: d.state ? 'ON' : 'OFF' }));
      const res = await fetchAuth(`${getTargetUrl()}/api/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSceneName, actions })
      });
      if (res.ok) {
        setIsCreating(false);
        setNewSceneName('');
        setNewSceneDevices([]);
        loadScenes();
      }
    } catch (err) {
      alert("فشل الحفظ");
    }
  };

  const handleDeleteScene = async (id: string) => {
    if (!window.confirm("حذف المشهد؟")) return;
    try {
      const res = await fetchAuth(`${getTargetUrl()}/api/scenes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadScenes();
      }
    } catch (err) {
      alert("فشل الحذف");
    }
  };

  const defaultScenes = [
    { id: 'all_on', name: 'كل الأجهزة تعمل', icon: Sun, color: 'text-yellow-400', bg: 'bg-yellow-500/20', gradient: 'from-yellow-500/20 to-orange-500/5' },
    { id: 'all_off', name: 'إطفاء كل شيء', icon: PowerOff, color: 'text-red-400', bg: 'bg-red-500/20', gradient: 'from-red-500/20 to-rose-500/5' },
    { id: 'cinema', name: 'وضع السينما', icon: Film, color: 'text-purple-400', bg: 'bg-purple-500/20', gradient: 'from-purple-500/20 to-fuchsia-500/5' },
    { id: 'sleep', name: 'وضع النوم', icon: Moon, color: 'text-blue-400', bg: 'bg-blue-500/20', gradient: 'from-blue-500/20 to-cyan-500/5' },
  ];

  const toggleDeviceInScene = (id: number, state: boolean) => {
    setNewSceneDevices(prev => {
      const exists = prev.find(d => d.id === id);
      if (exists) {
        if (exists.state === state) return prev.filter(d => d.id !== id);
        return prev.map(d => d.id === id ? { ...d, state } : d);
      }
      return [...prev, { id, state }];
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-up w-full">
      <header className="flex justify-between items-end border-b border-gray-200 dark:border-[#1a2235] pb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">السيناريوهات الذكية</h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 hover:bg-primary text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-colors"
        >
          <Plus size={18} /> مشهد جديد
        </button>
      </header>

      {isCreating && (
        <div className="bg-white dark:bg-[#101728] border border-blue-200 dark:border-primary/30 rounded-3xl p-6 mb-8 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">إنشاء مشهد جديد</h3>
          <input 
            type="text" 
            placeholder="اسم المشهد (مثال: وقت القراءة)" 
            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0a0f1c] text-gray-900 dark:text-white mb-6 focus:ring-2 ring-primary outline-none"
            value={newSceneName}
            onChange={e => setNewSceneName(e.target.value)}
          />
          
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">اختر الأجهزة وحالتها عند تشغيل المشهد:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {devices.filter(d => d.type !== 'sensor').map(dev => {
              const selected = newSceneDevices.find(d => d.id === dev.id);
              return (
                <div key={dev.id} className="bg-gray-50 dark:bg-[#15203a] border border-gray-200 dark:border-[#1a2235] p-3 rounded-xl flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-200 truncate ml-2">{dev.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <button 
                      onClick={() => toggleDeviceInScene(dev.id, true)}
                      className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors ${selected?.state === true ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                    >
                      تشغيل
                    </button>
                    <button 
                      onClick={() => toggleDeviceInScene(dev.id, false)}
                      className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors ${selected?.state === false ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                    >
                      إطفاء
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-[#1a2235] pt-4">
            <button onClick={() => setIsCreating(false)} className="px-6 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              إلغاء
            </button>
            <button onClick={handleCreateScene} className="px-6 py-2 rounded-xl font-bold bg-blue-600 hover:bg-primary text-white transition-colors">
              حفظ المشهد
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {defaultScenes.map(scene => (
          <button 
            key={scene.id}
            onClick={() => onExecuteScene(scene.id)}
            className={`relative overflow-hidden flex items-center justify-between p-6 rounded-3xl transition-all duration-500 group shadow-lg hover:shadow-2xl border border-white/10 bg-gradient-to-br ${scene.gradient} hover:scale-[1.02]`}
          >
            <div className="absolute inset-0 bg-black/40 dark:bg-[#06090f]/60 backdrop-blur-sm z-0"></div>
            <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[50px] ${scene.bg} opacity-50 group-hover:opacity-100 transition-opacity duration-500`}></div>

            <div className="flex items-center gap-5 z-10">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 shadow-inner border border-white/10 ${scene.bg}`}>
                <scene.icon size={32} className={`${scene.color} drop-shadow-md`} />
              </div>
              <div className="text-right">
                <h3 className="text-xl font-black text-white mb-1 drop-shadow-sm">{scene.name}</h3>
                <p className="text-xs text-gray-300 font-medium">الذكاء الاصطناعي</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20 z-10 group-hover:bg-white/20 transition-colors">
              <Play size={18} className="text-white ml-1" />
            </div>
          </button>
        ))}

        {customScenes.map(scene => (
          <div key={scene.id} className="relative overflow-hidden flex items-center justify-between p-6 rounded-3xl transition-all duration-500 group shadow-lg hover:shadow-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 hover:scale-[1.02]">
            <div className="absolute inset-0 bg-black/40 dark:bg-[#06090f]/60 backdrop-blur-sm z-0"></div>
            <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[50px] bg-emerald-500/20 opacity-50 group-hover:opacity-100 transition-opacity duration-500`}></div>

            <button 
              onClick={() => onExecuteScene('custom', scene.actions || scene.devices, scene.id)}
              className="flex items-center gap-5 flex-1 text-right z-10"
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 shadow-inner border border-emerald-500/30 bg-emerald-500/20">
                <Play size={32} className="text-emerald-400 drop-shadow-md ml-1" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white mb-1 drop-shadow-sm">{scene.name}</h3>
                <p className="text-xs text-gray-300 font-medium">يتحكم في {(scene.actions || scene.devices)?.length || 0} أجهزة</p>
              </div>
            </button>
            <button 
              onClick={() => handleDeleteScene(scene.id)}
              className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center backdrop-blur-md border border-red-500/30 z-10 transition-colors cursor-pointer"
            >
              <Trash2 size={16} className="text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
