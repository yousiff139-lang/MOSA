// @ts-nocheck
"use client";
/* eslint-disable */
import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  UserCog,
  Mail,
  Clock,
  Key,
  Trash2,
  X,
  QrCode,
  Share2,
  Copy,
  Check,
  Smartphone,
  Globe,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Printer,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { confirmAction, notify } from '@/store/useConfirmStore';

interface User {
  id: string;
  name?: string;
  username: string;
  role: string;
  createdAt: string;
  roomAccess: Array<{ id?: string; name: string } | string>;
}

interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  username: string;
  userRole: string;
  device: string;
  ip: string;
  createdAt: string;
  isLive?: boolean;
}

interface Room {
  id: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'sessions'>('users');

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<User | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // Add User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPinCode, setNewPinCode] = useState('');
  const [newRole, setNewRole] = useState('MEMBER');

  // Edit User Form State
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState('MEMBER');
  const [editPin, setEditPin] = useState('');
  const [editSelectedRooms, setEditSelectedRooms] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  // Quick Password Change State
  const [quickNewPassword, setQuickNewPassword] = useState('');

  // User-Specific QR Login Pass State
  const [qrLoadingUserId, setQrLoadingUserId] = useState<string | null>(null);
  const [generatedQR, setGeneratedQR] = useState<{
    token: string;
    inviteUrl: string;
    qrDataUrl: string;
    expiresAt: string;
    homeName: string;
    role: string;
    user?: {
      id: string;
      name: string;
      username: string;
      role: string;
    };
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([loadUsers(), loadRooms(), loadSessions()]);
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      const res = await fetchAuth(`/api/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  const loadRooms = async () => {
    try {
      const res = await fetchAuth(`/api/rooms`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (err) {
      console.error("Failed to load rooms", err);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await fetchAuth(`/api/users/active-sessions`);
      if (res.ok) {
        const data = await res.json();
        setActiveSessions(data);
      }
    } catch (err) {
      console.error("Failed to load active sessions", err);
    }
  };

  // Open Edit User Modal
  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.name || user.username);
    setEditUsername(user.username);
    setEditRole(user.role || 'MEMBER');
    setEditPin('');
    setShowPassword(false);

    const currentRoomIds = (user.roomAccess || []).map(ra => typeof ra === 'object' ? ra.id : ra).filter(Boolean) as string[];
    setEditSelectedRooms(currentRoomIds);
  };

  // Save User Edit
  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const payload: any = {
        name: editName.trim(),
        username: editUsername.trim(),
        role: editRole,
        roomIds: editSelectedRooms
      };
      if (editPin && editPin.length >= 4) {
        payload.pinCode = editPin;
      }

      const res = await fetchAuth(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        notify('تم تحديث بيانات وصلاحيات المستخدم بنجاح! 🔒', 'success');
        setEditingUser(null);
        loadUsers();
      } else {
        notify(data.message || 'حدث خطأ أثناء حفظ التعديل', 'error');
      }
    } catch (err) {
      notify('فشل الاتصال بالخادم', 'error');
    }
  };

  // Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchAuth(`/api/users/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          name: newName.trim() || newUsername.trim(),
          pinCode: newPinCode,
          role: newRole
        })
      });
      const data = await res.json();
      if (res.ok) {
        notify('تم إنشاء الحساب وتشفير الرمز بـ (Bcrypt) بنجاح! 🎉', 'success');
        setIsAddModalOpen(false);
        setNewUsername('');
        setNewName('');
        setNewPinCode('');
        loadUsers();
      } else {
        notify(data.message || "حدث خطأ أثناء إضافة المستخدم", 'error');
      }
    } catch (err) {
      notify("فشل الاتصال بالخادم", 'error');
    }
  };

  // Delete User
  const handleDelete = (user: User) => {
    confirmAction({
      title: 'حذف حساب المستخدم ⚠️',
      message: `هل أنت متأكد من حذف الحساب "${user.name || user.username}"؟`,
      subMessage: 'سيتم إلغاء وصول هذا المستخدم فوراً وحذف جلساته من المنصة.',
      variant: 'danger',
      confirmText: 'نعم، حذف الحساب',
      cancelText: 'تراجع',
      onConfirm: async () => {
        try {
          const res = await fetchAuth(`/api/users/${user.id}`, { method: 'DELETE' });
          if (res.ok || res.status === 204) {
            loadUsers();
            notify('تم حذف المستخدم بنجاح', 'success');
          } else {
            const err = await res.json();
            notify(err.message || 'حدث خطأ أثناء الحذف', 'error');
          }
        } catch (err) {
          notify('فشل الاتصال بالخادم', 'error');
        }
      }
    });
  };

  // Quick Password Update
  const handleQuickPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordModalOpen || !quickNewPassword) return;

    try {
      const res = await fetchAuth(`/api/users/${isPasswordModalOpen.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPinCode: quickNewPassword })
      });
      const data = await res.json();
      if (res.ok) {
        notify('تم تغيير وتشفير الرمز السري بنجاح! 🔒', 'success');
        setIsPasswordModalOpen(null);
        setQuickNewPassword('');
        loadUsers();
      } else {
        notify(data.message || 'حدث خطأ أثناء تحديث الرمز', 'error');
      }
    } catch (err) {
      notify('فشل الاتصال بالخادم', 'error');
    }
  };

  // 📲 Generate QR Login Pass specifically for an EXISTING USER
  const handleGenerateUserQR = async (user: User) => {
    setQrLoadingUserId(user.id);
    try {
      const res = await fetchAuth(`/api/users/${user.id}/qr-login-pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedQR(data);
        setIsQRModalOpen(true);
      } else {
        notify(data.message || 'فشل إنشاء باركود الدخول للمستخدم', 'error');
      }
    } catch (err) {
      notify('فشل الاتصال بالخادم', 'error');
    } finally {
      setQrLoadingUserId(null);
    }
  };

  // Copy Direct Link
  const handleCopyLink = () => {
    if (!generatedQR) return;
    navigator.clipboard.writeText(generatedQR.inviteUrl);
    setCopiedLink(true);
    notify('تم نسخ رابط تسجيل الدخول المباشر بنجاح! 📋', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Share to WhatsApp specifically for this user
  const handleShareWhatsApp = () => {
    if (!generatedQR) return;
    const uName = generatedQR.user?.name || generatedQR.user?.username || 'المستخدم';
    const msg = `مرحباً ${uName}! 🏡\nإليك بطاقة وباركود تسجيل الدخول الذكية لحسابك في ${generatedQR.homeName}.\n\n📲 امسح الباركود أو اضغط على الرابط التالي للدخول فوراً إلى حسابك:\n${generatedQR.inviteUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Print Pass Card
  const handlePrintPass = () => {
    window.print();
  };

  const superOwnersCount = users.filter(u => u.role === 'SUPER_OWNER' || u.role === 'ADMIN').length;
  const membersCount = users.filter(u => u.role === 'MEMBER').length;
  const guestsCount = users.filter(u => u.role === 'GUEST' || u.role === 'RESTRICTED_USER' || u.role === 'RESTRICTED').length;

  return (
    <div className="p-4 md:p-8 min-h-full relative w-full pb-44 font-sans" dir="rtl">
      
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 bg-slate-950/70 p-6 rounded-[2rem] border border-white/10 backdrop-blur-2xl shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 via-cyan-500/20 to-blue-600/30 border border-amber-400/50 text-amber-300 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.35)]">
            <Users size={28} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              إدارة المستخدمين وباركودات الدخول الذكية
            </h1>
            <p className="text-slate-400 text-xs font-medium mt-1">
              توليد باركودات تسجيل دخول مخصصة لكل مستخدم (QR Pass)، والتحكم بالصلاحيات وتشفير Bcrypt
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Add New User Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-xs cursor-pointer"
          >
            <UserPlus size={18} />
            <span>إضافة مستخدم جديد</span>
          </button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-950/70 border border-cyan-500/20 p-5 rounded-3xl shadow-xl flex items-center gap-4 backdrop-blur-xl">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Users size={22} />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] font-bold block">إجمالي الأعضاء</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-white font-mono">{users.length}</span>
              <span className="text-[11px] text-cyan-400 font-bold">حساب مسجل</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-amber-500/20 p-5 rounded-3xl shadow-xl flex items-center gap-4 backdrop-blur-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Shield size={22} />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] font-bold block">المشرفين والملاك</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-white font-mono">{superOwnersCount}</span>
              <span className="text-[11px] text-amber-400 font-bold">صلاحية كاملة</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-emerald-500/20 p-5 rounded-3xl shadow-xl flex items-center gap-4 backdrop-blur-xl">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Globe size={22} className="animate-pulse" />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] font-bold block">المتصلين أونلاين فعلياً</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-emerald-400 font-mono">{activeSessions.length}</span>
              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                متصل حالياً
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-purple-500/20 p-5 rounded-3xl shadow-xl flex items-center gap-4 backdrop-blur-xl">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <QrCode size={22} />
          </div>
          <div>
            <span className="text-slate-400 text-[11px] font-bold block">مستخدمين مقيدين / ضيوف</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-white font-mono">{guestsCount}</span>
              <span className="text-[11px] text-purple-400 font-bold">وصول محدد</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-2 mb-6 bg-slate-950/70 p-1.5 rounded-2xl border border-white/10 w-fit backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'users'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 scale-[1.02]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users size={15} />
          <span>حسابات الأعضاء ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'sessions'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20 scale-[1.02]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Globe size={15} />
          <span>الجلسات المباشرة أونلاين ({activeSessions.length})</span>
        </button>
      </div>

      {/* TAB 1: USERS LIST TABLE & USER-SPECIFIC BARCODES */}
      {activeTab === 'users' && (
        <div className="bg-slate-950/70 backdrop-blur-3xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw size={24} className="animate-spin text-cyan-400" />
              <span className="text-xs font-bold">جاري تحميل بيانات المستخدمين المشفرة...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 text-xs font-bold font-sans">
                    <th className="p-5">المستخدم والاسم</th>
                    <th className="p-5">الدور ومستوى الصلاحية</th>
                    <th className="p-5">الغرف المسموح بالتحكم بها</th>
                    <th className="p-5">حالة التشفير</th>
                    <th className="p-5">تاريخ الانضمام</th>
                    <th className="p-5 text-center">باركود الدخول والإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map(user => {
                    const isOwner = user.role === 'SUPER_OWNER';
                    const isAdmin = user.role === 'ADMIN';
                    const isMember = user.role === 'MEMBER';

                    const roleBadge = isOwner ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-amber-500/15 text-amber-300 border border-amber-400/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                        <Shield size={13} className="text-amber-400" />
                        مالك النظام (Owner)
                      </span>
                    ) : isAdmin ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                        <UserCog size={13} className="text-cyan-400" />
                        مسؤول المنظومة (Admin)
                      </span>
                    ) : isMember ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-400/30">
                        <Users size={13} className="text-blue-400" />
                        عضو عائلة (Member)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-400/30">
                        <QrCode size={13} className="text-purple-400" />
                        مستخدم مقيد / ضيف
                      </span>
                    );

                    return (
                      <tr key={user.id} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="p-5">
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-600/30 to-purple-600/30 flex items-center justify-center text-white font-black text-lg shadow-lg border border-cyan-400/30 shrink-0">
                              {(user.name || user.username).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-white font-black text-sm">{user.name || user.username}</p>
                              <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5 font-mono">
                                <Mail size={11} className="text-slate-500" />
                                {user.username}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="p-5">
                          {roleBadge}
                        </td>

                        <td className="p-5">
                          {isOwner || isAdmin ? (
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={13} />
                              جميع الغرف والأجهزة (وصول كامل)
                            </span>
                          ) : (user.roomAccess && user.roomAccess.length > 0) ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {user.roomAccess.map((ra, idx) => {
                                const rName = typeof ra === 'object' ? ra.name : ra;
                                return (
                                  <span key={idx} className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-slate-300 font-bold">
                                    {rName}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">غير محدد (غرف عامة فقط)</span>
                          )}
                        </td>

                        <td className="p-5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                            <Lock size={12} />
                            Bcrypt Hash
                          </span>
                        </td>

                        <td className="p-5 text-slate-400 text-xs">
                          <div className="flex items-center gap-1.5 font-mono">
                            <Clock size={13} className="text-slate-500" />
                            <span dir="ltr">{new Date(user.createdAt).toLocaleDateString('ar-EG')}</span>
                          </div>
                        </td>

                        <td className="p-5">
                          <div className="flex items-center justify-center gap-2">
                            
                            {/* 📲 User-Specific QR Login Pass Button */}
                            <button
                              onClick={() => handleGenerateUserQR(user)}
                              disabled={qrLoadingUserId === user.id}
                              className="px-3.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 hover:text-white border border-purple-400/40 text-xs font-black flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(168,85,247,0.15)] cursor-pointer"
                              title={`توليد باركود دخول مباشر ومخصص لحساب (${user.name || user.username})`}
                            >
                              <QrCode size={14} className={`text-purple-400 ${qrLoadingUserId === user.id ? 'animate-spin' : ''}`} />
                              <span>{qrLoadingUserId === user.id ? 'جاري التوليد...' : 'باركود الدخول 📲'}</span>
                            </button>

                            {/* ✏️ Edit User & Permissions Button */}
                            <button
                              onClick={() => handleOpenEdit(user)}
                              className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 hover:text-white border border-cyan-400/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                              title="تعديل بيانات المستخدم والصلاحيات والغرف المسموحة"
                            >
                              <UserCog size={14} className="text-cyan-400" />
                              <span>تعديل ✏️</span>
                            </button>

                            {/* 🔑 Change PIN Button */}
                            <button
                              onClick={() => {
                                setIsPasswordModalOpen(user);
                                setQuickNewPassword('');
                              }}
                              className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 transition-colors cursor-pointer"
                              title="تغيير الرمز السري (PIN)"
                            >
                              <Key size={15} />
                            </button>

                            {/* 🗑️ Delete User Button */}
                            {!isOwner && (
                              <button
                                onClick={() => handleDelete(user)}
                                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                                title="حذف حساب المستخدم"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="bg-slate-950/70 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Globe className="text-cyan-400" size={20} />
                المتصلين حالياً على المنظومة في الوقت الفعلي
              </h3>
              <p className="text-slate-400 text-xs mt-1">عرض مباشر للأشخاص والهواتف المتصلة بالسيرفر في هذه اللحظة</p>
            </div>
            <button onClick={loadSessions} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 transition cursor-pointer">
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSessions.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                لا توجد جلسات أخرى مسجلة حالياً
              </div>
            ) : (
              activeSessions.map((session, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <Smartphone size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold text-xs">{session.userName}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-1 truncate max-w-[200px]">
                      {session.device}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-2 pt-2 border-t border-white/5">
                      <span>IP: {session.ip}</span>
                      <span className="text-emerald-400 font-bold">🟢 متصل</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 📲 USER-SPECIFIC SMART QR ACCESS PASS MODAL                    */}
      {/* ============================================================== */}
      {isQRModalOpen && generatedQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg" dir="rtl">
          <div className="bg-slate-900 border border-purple-500/40 rounded-[2.5rem] w-full max-w-lg shadow-2xl p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400" />

            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-400/30 text-purple-400 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.25)]">
                  <QrCode size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    باركود الدخول المباشر لـ ({generatedQR.user?.name || generatedQR.user?.username}) 📲
                  </h3>
                  <p className="text-[11px] text-slate-400">عند مسح هذا الباركود، يدخل مباشرة إلى حسابه الخاص وصلاحياته المحددة</p>
                </div>
              </div>
              <button onClick={() => setIsQRModalOpen(false)} className="p-1 rounded-xl text-slate-400 hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Visual Digital Access Pass Card */}
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 rounded-3xl border border-purple-500/30 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Pass Header */}
              <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-white/10 text-xs">
                <span className="font-black text-purple-300 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  {generatedQR.homeName}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[10px] font-bold">
                  حساب: {generatedQR.role}
                </span>
              </div>

              {/* QR Image Box */}
              <div className="p-3 bg-slate-950 rounded-2xl border-2 border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.3)] mb-4">
                <img
                  src={generatedQR.qrDataUrl}
                  alt={`QR Login Code for ${generatedQR.user?.name}`}
                  className="w-56 h-56 object-contain rounded-xl"
                />
              </div>

              {/* Pass Details */}
              <p className="text-base font-black text-white">{generatedQR.user?.name || generatedQR.user?.username}</p>
              <p className="text-xs text-purple-300 font-mono font-bold mt-0.5">@{generatedQR.user?.username}</p>
              <p className="text-[11px] text-slate-400 mt-2 font-mono">
                صلاحية الدخول: مستمرة / دائمة لحساب المستخدم
              </p>
            </div>

            {/* Direct Actions (WhatsApp, Copy, Print) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={handleShareWhatsApp}
                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition hover:scale-[1.02] cursor-pointer"
              >
                <Share2 size={15} />
                <span>إرسال واتساب للمستخدم</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition hover:scale-[1.02] cursor-pointer"
              >
                {copiedLink ? <Check size={15} /> : <Copy size={15} />}
                <span>{copiedLink ? 'تم النسخ!' : 'نسخ رابط الحساب'}</span>
              </button>

              <button
                onClick={handlePrintPass}
                className="py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Printer size={15} />
                <span>طباعة البطاقة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ✏️ EDIT USER & PERMISSIONS MODAL                               */}
      {/* ============================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" dir="rtl">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-[2.5rem] w-full max-w-lg shadow-2xl p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600" />

            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2.5">
                <UserCog className="text-cyan-400" size={24} />
                تعديل بيانات وصلاحيات المستخدم
              </h3>
              <button onClick={() => setEditingUser(null)} className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-4 text-xs font-sans">
              
              {/* Full Name */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">الاسم الكامل / المعروض:</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-400 transition"
                  placeholder="مثال: أحمد محمد"
                />
              </div>

              {/* Username / Email */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">اسم المستخدم / البريد:</label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm font-mono outline-none focus:border-cyan-400 transition"
                  placeholder="ahmed"
                />
              </div>

              {/* Role Selector */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">مستوى الصلاحية والدور:</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs font-bold outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="SUPER_OWNER">👑 مالك رئيسي (SUPER_OWNER) - وصول كامل لكل شيء</option>
                  <option value="ADMIN">🛡️ مسؤول (ADMIN) - إدارة الأجهزة والمستخدمين</option>
                  <option value="MEMBER">👥 عضو عائلة (MEMBER) - تحكم بالأجهزة والغرف</option>
                  <option value="RESTRICTED_USER">🔒 مستخدم مقيد (RESTRICTED) - غرف محددة فقط</option>
                  <option value="GUEST">🎫 ضيف مؤقت (GUEST) - صلاحيات مؤقتة</option>
                </select>
              </div>

              {/* Optional PIN Change */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">تغيير الرمز السري (اختياري، اتركه فارغاً للإبقاء على الحالي):</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    minLength={4}
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm font-mono outline-none focus:border-cyan-400 transition pr-10"
                    placeholder="أدخل 4 أرقام أو أكثر لتغيير الرمز"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Room Access Checkboxes */}
              {editRole !== 'SUPER_OWNER' && editRole !== 'ADMIN' && (
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2">
                  <label className="block text-slate-300 font-bold mb-2">الغرف المسموح لهذا المستخدم بالتحكم بأجهزتها:</label>
                  {rooms.length === 0 ? (
                    <p className="text-slate-500 text-[11px]">لا توجد غرف مضافة بالمنزل حالياً</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                      {rooms.map(room => {
                        const isChecked = editSelectedRooms.includes(room.id);
                        return (
                          <label
                            key={room.id}
                            className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition select-none ${
                              isChecked ? 'bg-cyan-500/15 border-cyan-400 text-white font-bold' : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditSelectedRooms([...editSelectedRooms, room.id]);
                                } else {
                                  setEditSelectedRooms(editSelectedRooms.filter(id => id !== room.id));
                                }
                              }}
                              className="accent-cyan-400"
                            />
                            <span className="text-xs truncate">{room.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-cyan-500/30 hover:scale-[1.02] active:scale-95 transition cursor-pointer"
                >
                  حفظ التعديلات وتحديث الصلاحيات 🔒
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-5 py-3.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold text-xs transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ➕ ADD NEW USER MODAL                                         */}
      {/* ============================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" dir="rtl">
          <div className="bg-slate-900 border border-amber-500/30 rounded-[2.5rem] w-full max-w-md shadow-2xl p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-600" />

            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-2.5">
                <UserPlus className="text-amber-400" size={24} />
                إضافة مستخدم جديد مشفر
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">اسم العضو / الاسم الكامل:</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-amber-400"
                  placeholder="مثال: يوسف خالد"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">اسم المستخدم (لتسجيل الدخول):</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm font-mono outline-none focus:border-amber-400"
                  placeholder="youssef"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">الرمز السري (PIN):</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPinCode}
                  onChange={(e) => setNewPinCode(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm font-mono outline-none focus:border-amber-400"
                  placeholder="4 أرقام أو أكثر (مثال: 1234)"
                />
                <p className="text-[11px] text-emerald-400 mt-1">🔒 يتم تشفير هذا الرمز آلياً بـ (Bcrypt Hash) بمستوى أمان عالي.</p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">الدور والصلاحية:</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs font-bold outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="MEMBER">👥 عضو عائلة (MEMBER) - تحكم عام بالمنزل</option>
                  <option value="ADMIN">🛡️ مسؤول (ADMIN) - إدارة كاملة</option>
                  <option value="RESTRICTED_USER">🔒 مستخدم مقيد (RESTRICTED) - غرف محددة</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-2xl font-black text-xs shadow-lg shadow-amber-500/30 hover:scale-[1.02] active:scale-95 transition cursor-pointer"
                >
                  حفظ وإنشاء الحساب 🎉
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-3.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold text-xs transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 🔑 QUICK PIN EDIT MODAL                                        */}
      {/* ============================================================== */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" dir="rtl">
          <div className="bg-slate-900 border border-amber-500/30 rounded-[2.5rem] w-full max-w-sm shadow-2xl p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Key className="text-amber-400" size={20} />
                تعديل رمز ({isPasswordModalOpen.name || isPasswordModalOpen.username})
              </h3>
              <button onClick={() => setIsPasswordModalOpen(null)} className="p-1 rounded-xl text-slate-400 hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleQuickPasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">أدخل الرمز السري الجديد:</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={quickNewPassword}
                  onChange={(e) => setQuickNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-white text-center font-mono text-xl tracking-widest outline-none focus:border-amber-400"
                  placeholder="••••"
                />
                <p className="text-[11px] text-emerald-400 mt-2 text-center">🔒 سيتم تشفير الرمز فوراً بـ (Bcrypt Salted Hash)</p>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black rounded-2xl text-xs shadow-lg transition cursor-pointer"
              >
                تحديث وتشفير الرمز 🔒
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
