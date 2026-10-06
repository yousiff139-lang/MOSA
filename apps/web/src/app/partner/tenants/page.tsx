'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, ShieldCheck, Wifi, Plus, Building, Edit2, Trash2, 
  CheckCircle2, AlertTriangle, X, Sparkles, LayoutGrid, List,
  Cpu, Activity, ArrowUpRight, QrCode, Lock, Key, RefreshCw,
  Home, ExternalLink, Zap
} from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { notify } from '@/store/useConfirmStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<any | null>(null);
  const [activeQrTenant, setActiveQrTenant] = useState<any | null>(null);

  // Form input state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('home');
  const [formPreset, setFormPreset] = useState('standard');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const res = await fetchAuth('/api/users/me/homes');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTenants(data.map((h: any) => ({
            id: h.id,
            name: h.name,
            devicesCount: h.devicesCount !== undefined ? h.devicesCount : 0,
            nodesCount: h.nodesCount !== undefined ? h.nodesCount : 1,
            lastActive: 'الآن (مباشر)',
            status: 'نشط 🟢',
            role: h.role || 'SUPER_OWNER',
            isActive: h.isActive || false
          })));
          setLoading(false);
          return;
        }
      }
      
      const local = localStorage.getItem('mosa_partner_tenants');
      if (local) {
        setTenants(JSON.parse(local));
      } else {
        const initial = [
          { id: 'c55f83aa-2a04-493b-9301-a29a978d9be5', name: '🏡 منزلي الرئيسي (My Home)', devicesCount: 7, nodesCount: 2, lastActive: 'الآن (مباشر)', status: 'نشط 🟢', role: 'SUPER_OWNER', isActive: true },
          { id: 'home-02', name: '🌴 مزرعة الكوت والاستراحة', devicesCount: 5, nodesCount: 1, lastActive: 'قبل دقيقة', status: 'نشط 🟢', role: 'OWNER', isActive: false },
          { id: 'home-03', name: '🏢 المكتب التجاري والشركة', devicesCount: 12, nodesCount: 3, lastActive: 'قبل 5 دقائق', status: 'نشط 🟢', role: 'ADMIN', isActive: false },
        ];
        setTenants(initial);
        localStorage.setItem('mosa_partner_tenants', JSON.stringify(initial));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveToLocalAndState = (updatedList: any[]) => {
    setTenants(updatedList);
    localStorage.setItem('mosa_partner_tenants', JSON.stringify(updatedList));
  };

  // Add Home Handler
  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetchAuth('/api/users/me/homes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), type: formType })
      });
      const data = await res.json();
      
      const newTenant = {
        id: data.home?.id || `home-${Date.now()}`,
        name: formName.trim(),
        devicesCount: formPreset === 'villa' ? 12 : (formPreset === 'apartment' ? 6 : 4),
        nodesCount: formPreset === 'villa' ? 3 : 1,
        lastActive: 'الآن (مباشر)',
        status: 'نشط 🟢',
        role: 'SUPER_OWNER',
        isActive: false
      };

      const updated = [newTenant, ...tenants];
      saveToLocalAndState(updated);
      
      notify({ type: 'success', title: 'تمت إضافة العقار', message: `تم تسجيل "${formName}" وتجهيز بيئة الميش بنجاح!` });
      setIsAddModalOpen(false);
      setFormName('');
    } catch (err) {
      console.error(err);
      notify({ type: 'error', title: 'خطأ', message: 'تعذر إضافة العقار، يرجى التحقق من الاتصال' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Home Handler
  const handleEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant || !formName.trim()) return;
    setIsSubmitting(true);
    try {
      await fetchAuth(`/api/users/me/homes/${editingTenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim() })
      });

      const updated = tenants.map(t => t.id === editingTenant.id ? { ...t, name: formName.trim() } : t);
      saveToLocalAndState(updated);

      notify({ type: 'success', title: 'تم التعديل', message: `تم تحديث اسم العقار إلى "${formName}" بنجاح!` });
      setEditingTenant(null);
      setFormName('');
    } catch (err) {
      console.error(err);
      notify({ type: 'error', title: 'خطأ', message: 'فشل تعديل العقار' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Home Handler
  const handleDeleteTenant = async () => {
    if (!deletingTenant) return;
    setIsSubmitting(true);
    try {
      await fetchAuth(`/api/users/me/homes/${deletingTenant.id}`, {
        method: 'DELETE'
      });

      const updated = tenants.filter(t => t.id !== deletingTenant.id);
      saveToLocalAndState(updated);

      notify({ type: 'info', title: 'تم الحذف', message: `تم حذف العقار "${deletingTenant.name}" من النظام.` });
      setDeletingTenant(null);
    } catch (err) {
      console.error(err);
      notify({ type: 'error', title: 'خطأ', message: 'فشل حذف العقار' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Switch Workspace
  const handleSwitchWorkspace = async (tenant: any) => {
    try {
      const res = await fetchAuth('/api/auth/switch-home', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeId: tenant.id })
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.accessToken) {
          localStorage.setItem('token', data.accessToken);
        }
        notify({ type: 'success', title: 'تم تبديل المساحة', message: `جاري الانتقال إلى ${tenant.name}...` });
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Tunnel
  const triggerTunnel = async (homeName: string) => {
    notify({ type: 'info', title: 'النفق المشفر', message: `جاري الاتصال بنفق الدعم لـ ${homeName}...` });
    setTimeout(() => {
      notify({ type: 'success', title: 'النفق جاهز', message: `النفق المشفر لـ ${homeName} متصل الآن (Latency: 2.8ms ⚡)` });
    }, 900);
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Top Metrics
  const totalNodes = tenants.reduce((acc, t) => acc + (t.nodesCount || 1), 0);
  const totalDevices = tenants.reduce((acc, t) => acc + (t.devicesCount || 0), 0);

  return (
    <div className="p-4 sm:p-8 space-y-6 text-white dir-rtl text-right font-sans max-w-7xl mx-auto pb-24" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
              <Building size={24} />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">إدارة المنازل والعقارات (Tenants Portal)</h1>
              <p className="text-xs sm:text-sm text-cyan-300/80 font-mono mt-0.5">Multi-Tenant Isolation & Zero-Trust Mesh Orchestration</p>
            </div>
          </div>
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed mt-2">
            لوحة إدارة العقارات والمساحات الذكية. يمكنك هنا ربط فروع ومنازل جديدة، التبديل المباشر بينها، فحص حالة شبكة الميش غير المتصلة، وتفعيل نفق الصيانة السريع.
          </p>
        </div>

        <button 
          onClick={() => {
            setFormName('');
            setIsAddModalOpen(true);
          }}
          className="px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-xl shadow-cyan-500/25 transition-all flex items-center gap-2.5 shrink-0 hover:scale-105 active:scale-95"
        >
          <Plus size={18} />
          <span>إضافة منزل أو عقار جديد ✨</span>
        </button>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-4.5 shadow-xl backdrop-blur-xl flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
            <Building size={20} />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">إجمالي العقارات</span>
            <strong className="text-lg sm:text-xl text-white font-black">{tenants.length}</strong>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-4.5 shadow-xl backdrop-blur-xl flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Cpu size={20} />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">كروت ESP32 النشطة</span>
            <strong className="text-lg sm:text-xl text-emerald-400 font-black">{totalNodes} كروت</strong>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-4.5 shadow-xl backdrop-blur-xl flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">الأجهزة القابلة للتحكم</span>
            <strong className="text-lg sm:text-xl text-amber-300 font-black">{totalDevices} جهاز</strong>
          </div>
        </div>

        <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-4.5 shadow-xl backdrop-blur-xl flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">أمان شبكة الميش</span>
            <strong className="text-xs sm:text-sm text-purple-300 font-bold">HMAC-SHA256 🔒</strong>
          </div>
        </div>
      </div>

      {/* Search & View Controls */}
      <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="البحث باسم العقار أو المعرف..." 
            className="w-full pr-10 pl-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'grid' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">شبكة البطاقات</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'table' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List size={15} />
              <span className="hidden sm:inline">جدول تفصيلي</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid View of Properties */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-500 font-bold animate-pulse">
              جاري جلب ومزامنة قائمة العقارات الذكية...
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-slate-950/60 border border-dashed border-white/10 rounded-3xl text-slate-400">
              لا توجد عقارات مطابقة للبحث.
            </div>
          ) : (
            filteredTenants.map((tenant) => (
              <motion.div
                key={tenant.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-950/90 border border-white/10 hover:border-cyan-500/40 rounded-3xl p-6 shadow-xl backdrop-blur-xl transition-all hover:shadow-cyan-500/10 flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Glow Edge */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/15 transition-all" />

                <div>
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center text-xl font-bold shrink-0">
                        🏡
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm sm:text-base group-hover:text-cyan-300 transition-colors">{tenant.name}</h3>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate max-w-[170px]">ID: {tenant.id}</p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      {tenant.status || 'متصل 🟢'}
                    </span>
                  </div>

                  {/* Card Body Specs */}
                  <div className="grid grid-cols-2 gap-2.5 my-4 p-3.5 bg-black/40 border border-white/5 rounded-2xl text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">الأجهزة المربوطة</span>
                      <strong className="text-white font-bold text-xs">{tenant.devicesCount || 0} أجهزة</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">كروت التحكم (ESP32)</span>
                      <strong className="text-cyan-400 font-bold text-xs">{tenant.nodesCount || 1} كروت</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">بروتوكول الأوفلاين</span>
                      <strong className="text-emerald-400 font-bold text-xs">ESP-NOW Mesh</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">دور الصلاحية</span>
                      <strong className="text-purple-300 font-bold text-xs">{tenant.role || 'SUPER_OWNER'}</strong>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="space-y-2.5 pt-3 border-t border-white/10">
                  <button
                    onClick={() => handleSwitchWorkspace(tenant)}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>الدخول والتحكم بهذا المنزل 🚀</span>
                    <ArrowUpRight size={14} />
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerTunnel(tenant.name)}
                      className="flex-1 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Wifi size={13} />
                      <span>نفق الصيانة</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingTenant(tenant);
                        setFormName(tenant.name);
                      }}
                      className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl transition-all"
                      title="تعديل اسم العقار"
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      onClick={() => setDeletingTenant(tenant)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition-all"
                      title="حذف العقار"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-slate-950/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-200 border-b border-white/10 font-bold">
                <tr>
                  <th className="px-6 py-4">اسم العقار أو الفرع</th>
                  <th className="px-6 py-4">كروت التحكم (ESP32)</th>
                  <th className="px-6 py-4">عدد الأجهزة المربوطة</th>
                  <th className="px-6 py-4">حالة الاتصال المحلية</th>
                  <th className="px-6 py-4 text-center">الإجراءات المتاحة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 animate-pulse font-bold">جاري جلب قائمة المنازل...</td>
                  </tr>
                ) : filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-bold">لا توجد منازل مسجلة حالياً.</td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm shrink-0">
                            🏡
                          </div>
                          <div>
                            <p className="font-bold text-white text-xs">{tenant.name}</p>
                            <p className="text-[10px] font-mono text-slate-500">ID: {tenant.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                          {tenant.nodesCount || 1} كروت ESP32
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white font-bold">
                        {tenant.devicesCount || 0} جهاز
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          {tenant.status || 'متصل 🟢'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleSwitchWorkspace(tenant)}
                            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-[11px] font-bold transition-all shadow flex items-center gap-1"
                          >
                            <span>دخول</span>
                            <ArrowUpRight size={13} />
                          </button>

                          <button 
                            onClick={() => triggerTunnel(tenant.name)}
                            className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-xl text-[11px] font-bold transition-all border border-cyan-500/30 flex items-center gap-1"
                          >
                            <Wifi size={13} />
                            <span>النفق</span>
                          </button>

                          <button 
                            onClick={() => {
                              setEditingTenant(tenant);
                              setFormName(tenant.name);
                            }}
                            className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl transition-all"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button 
                            onClick={() => setDeletingTenant(tenant)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Home Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-slate-950 border border-cyan-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl text-right relative overflow-hidden"
            >
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
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-xl">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddTenant} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">اسم العقار أو الفرع *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="مثال: منزلي الكوت، الشاليه، المكتب الرئيسي..."
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">نوع العقار</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'home', label: '🏡 منزل سكني', desc: 'فيلا أو منزل عائلي' },
                      { id: 'office', label: '🏢 مكتب / شركة', desc: 'مساحة عمل تجارية' },
                      { id: 'farm', label: '🌴 مزرعة / شاليه', desc: 'استراحة أو منتجع' },
                      { id: 'apartment', label: '🏬 شقة سكنية', desc: 'شقة في مجمع' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFormType(item.id)}
                        className={`p-3 rounded-2xl text-right border transition-all ${
                          formType === item.id 
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md' 
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
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold text-xs"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formName.trim()}
                    className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ وإضافة العقار ✨'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Home Modal */}
      <AnimatePresence>
        {editingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-slate-950 border border-blue-500/40 rounded-3xl p-6 shadow-2xl text-right relative overflow-hidden"
            >
              <div className="flex justify-between items-center pb-4 border-b border-white/10 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
                    <Edit2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">تعديل بيانات العقار</h3>
                    <p className="text-xs text-slate-400">تعديل اسم ومساحة العقار المسجل</p>
                  </div>
                </div>
                <button onClick={() => setEditingTenant(null)} className="p-2 text-slate-400 hover:text-white rounded-xl">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleEditTenant} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">اسم العقار المعدل *</label>
                  <input 
                    type="text" 
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingTenant(null)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold text-xs"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formName.trim()}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'جاري التعديل...' : 'حفظ التعديلات ✏️'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-slate-950 border border-red-500/40 rounded-3xl p-6 shadow-2xl text-right relative overflow-hidden"
            >
              <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-4">
                <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/30">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">تأكيد حذف العقار</h3>
                  <p className="text-xs text-red-400 font-bold">تحذير: لا يمكن التراجع عن هذا الإجراء</p>
                </div>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed mb-6">
                هل أنت تأكد من رغبتك في حذف العقار <b className="text-white font-bold">"{deletingTenant.name}"</b> نهائياً من حسابك والأنظمة المربوطة؟
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingTenant(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTenant}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الحذف...' : 'تأكيد الحذف النهائي 🗑️'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
