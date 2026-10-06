"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Home, Plus, Settings, X, Building, Sparkles, CheckCircle2 } from 'lucide-react';
import { Tenant, Role } from '@/types/navigation';
import { fetchAuth, useSmartHomeStore } from '@/store/useSmartHomeStore';
import Link from 'next/link';

export function HomeSwitcher() {
  const user = useSmartHomeStore(state => state.user);
  const [isOpen, setIsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);

  // New Home Form State
  const [newHomeName, setNewHomeName] = useState('');
  const [newHomeType, setNewHomeType] = useState('home');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchAuth('/api/users/me/homes')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTenants(data);
          const active = data.find(t => t.isActive);
          if (active) setActiveTenant(active);
        }
      })
      .catch(err => {
        console.error(err);
        setActiveTenant({ id: 'fallback', name: 'My Home', role: Role.SUPER_OWNER });
      });
  }, []);

  const switchTenant = async (t: Tenant) => {
    try {
      const res = await fetchAuth('/api/auth/switch-home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeId: t.id })
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.accessToken) {
          localStorage.setItem('token', data.accessToken);
        }
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    }
    setIsOpen(false);
  };

  const handleCreateHomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHomeName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetchAuth('/api/users/me/homes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHomeName.trim(), type: newHomeType })
      });
      const data = await res.json();
      if (res.ok && (data.success || data.id || data.home)) {
        setSuccessMsg('تمت إضافة المساحة الذكية بنجاح!');
        setTimeout(() => {
          setIsAddModalOpen(false);
          setSuccessMsg('');
          setNewHomeName('');
          if (data.home) switchTenant(data.home);
          else window.location.reload();
        }, 1200);
      } else {
        alert(data.error || 'تعذر إضافة المساحة، يرجى المحاولة لاحقاً');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ في الاتصال بالسيرفر');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDisplayName = user?.name || user?.username || 'admin';

  return (
    <div className="relative w-auto min-w-[200px]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all backdrop-blur-md shadow-md gap-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <Home size={16} />
          </div>
          <div className="flex flex-col items-start text-right">
            <span className="text-white font-bold text-xs leading-tight">{currentDisplayName}</span>
            <span className="text-cyan-400/80 text-[9px] font-bold">{activeTenant ? activeTenant.name : 'منزلي الرئيسي'} 🟢</span>
          </div>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-2 w-72 p-3 bg-slate-950 border border-cyan-500/30 rounded-2xl shadow-2xl z-50 backdrop-blur-2xl text-right"
          >
            <div className="p-2 border-b border-white/10 mb-2">
              <p className="text-xs font-bold text-white flex items-center gap-2">
                <Building size={14} className="text-cyan-400" />
                إدارة المساحات والمنازل الذكية
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">التنقل المباشر بين أجهزة المنازل والمكاتب</p>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
              {tenants.length > 0 ? (
                tenants.map(t => (
                  <button
                    key={t.id}
                    onClick={() => switchTenant(t)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                      activeTenant && t.id === activeTenant.id ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <Home size={16} className={activeTenant && t.id === activeTenant.id ? 'text-cyan-400' : 'text-slate-400'} />
                    <span className="font-bold text-xs flex-1 text-right">{t.name}</span>
                    {activeTenant && t.id === activeTenant.id && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                    )}
                  </button>
                ))
              ) : (
                <button
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                >
                  <Home size={16} className="text-cyan-400" />
                  <span className="font-bold text-xs flex-1 text-right">🏡 منزلي الرئيسي (My Home)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                </button>
              )}
            </div>

            <div className="h-px w-full bg-white/10 my-2"></div>

            <button 
              onClick={() => {
                setIsOpen(false);
                setIsAddModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold transition-all border border-cyan-500/20"
            >
              <Plus size={15} />
              <span>إضافة منزل أو مساحة عمل جديدة</span>
            </button>

            <Link 
              href="/partner/branding"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2.5 p-2.5 mt-1 rounded-xl hover:bg-white/5 text-slate-300 text-xs font-bold transition-colors"
            >
              <Settings size={15} />
              <span>إعدادات العضوية والصلاحيات والهوية</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cyber Glassmorphism Modal for Adding New Home / Workspace */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-slate-950 border border-cyan-500/40 rounded-3xl p-6 shadow-2xl text-right relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-white/10 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">إضافة منزل أو مساحة عمل جديدة</h3>
                    <p className="text-xs text-slate-400">ربط وتخصيص بيئة سمارت جديدة بحسابك</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {successMsg ? (
                <div className="py-8 text-center space-y-3">
                  <CheckCircle2 size={48} className="mx-auto text-emerald-400 animate-bounce" />
                  <p className="text-emerald-300 font-bold text-sm">{successMsg}</p>
                </div>
              ) : (
                <form onSubmit={handleCreateHomeSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">اسم المنزل أو العقار / Workspace Name *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="مثال: منزلي الكوت، الشاليه، المكتب الرئيسي..."
                      value={newHomeName}
                      onChange={e => setNewHomeName(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:bg-white/[0.08] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">نوع العقار / Location Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'home', label: '🏡 منزل سكني', desc: 'فيلا أو منزل عائلي' },
                        { id: 'office', label: '🏢 مكتب / شركة', desc: 'مساحة عمل أو مكتب' },
                        { id: 'farm', label: '🌴 مزرعة / شاليه', desc: 'استراحة أو شاليه' },
                        { id: 'apartment', label: '🏬 شقة سكنية', desc: 'شقة أو مجمع' },
                      ].map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setNewHomeType(item.id)}
                          className={`p-3 rounded-2xl text-right border transition-all ${
                            newHomeType === item.id 
                              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                              : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'
                          }`}
                        >
                          <p className="font-bold text-xs">{item.label}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold text-xs transition-colors"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !newHomeName.trim()}
                      className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'جاري الحفظ...' : 'حفظ وإضافة المساحة ✨'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
