// @ts-nocheck
'use client';
/* eslint-disable */

import { useState, useEffect } from 'react';
import {
  Shield,
  UserPlus,
  Trash2,
  Settings2,
  Check,
  Cpu,
  Home as HomeIcon,
  Users,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sparkles,
  LayoutGrid,
  Lightbulb,
  Fan,
  Key,
  Droplets,
  Bot,
  Zap,
  Server,
  Layers,
  Save,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Radio,
  CheckSquare,
  Square
} from 'lucide-react';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { notify } from '@/store/useConfirmStore';

interface HomeMember {
  id: string;
  role: string;
  user: {
    id: string;
    username: string;
    name: string | null;
  };
  roomPermissions: { roomId: string; room: { name: string } }[];
  devicePermissions?: { deviceId: string; device: { id: string; name: string } }[];
}

interface Room {
  id: string;
  name: string;
}

interface ControllerNode {
  id: string;
  name: string;
  macAddress?: string;
  ip?: string;
}

export default function MembersPermissionsPage() {
  const { user } = useSmartHomeStore();
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [controllers, setControllers] = useState<ControllerNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMember, setSelectedMember] = useState<HomeMember | null>(null);

  // Permissions Form State
  const [memberRole, setMemberRole] = useState<string>('RESTRICTED');
  const [allowedRooms, setAllowedRooms] = useState<Record<string, boolean>>({});
  const [allowedControllers, setAllowedControllers] = useState<Record<string, boolean>>({});

  // Sections/Pages Whitelist State
  const [allowedSections, setAllowedSections] = useState<Record<string, boolean>>({
    workspace: true,
    lighting: true,
    climate: true,
    security: false,
    irrigation: false,
    automations: false,
    energy: true,
    infrastructure: false,
    system: false
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const targetHomeId = user?.homeId || 'active';
      const [membersRes, roomsRes, controllersRes] = await Promise.all([
        fetchAuth(`/api/homes/${targetHomeId}/members`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetchAuth('/api/rooms').then(r => r.ok ? r.json() : []).catch(() => []),
        fetchAuth('/api/controllers').then(r => r.ok ? r.json() : []).catch(() => [])
      ]);

      const validRooms = Array.isArray(roomsRes) ? roomsRes.filter((r: any) => r.name !== 'الصاله') : [];
      if (validRooms.length > 0) setRooms(validRooms);
      if (Array.isArray(controllersRes)) setControllers(controllersRes);

      if (Array.isArray(membersRes) && membersRes.length > 0) {
        setMembers(membersRes);
        const currentSelectedId = selectedMember?.id || selectedMember?.user?.id;
        const targetMember = currentSelectedId
          ? membersRes.find((m: any) => m.id === currentSelectedId || m.user?.id === currentSelectedId)
          : (membersRes.find((m: any) => m.user?.username === 'asd') || membersRes[0]);

        if (targetMember) {
          handleSelectMember(targetMember, validRooms);
        }
      }
    } catch (e) {
      console.error('Failed to load permissions data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMember = (member: HomeMember, availableRooms?: Room[]) => {
    setSelectedMember(member);
    const effectiveRole = (member.role || 'RESTRICTED').toUpperCase();
    setMemberRole(effectiveRole);

    const roomList = availableRooms && availableRooms.length > 0 ? availableRooms : rooms;
    // Room permissions
    const roomAccessMap: Record<string, boolean> = {};
    roomList.forEach(r => {
      roomAccessMap[r.id] = member.roomPermissions?.some(rp => rp.roomId === r.id || (rp as any).id === r.id) || false;
    });
    setAllowedRooms(roomAccessMap);

    // Controller (ESP32) permissions
    let restrictionsObj = (member as any).restrictions || {};
    if (typeof restrictionsObj === 'string') {
      try { restrictionsObj = JSON.parse(restrictionsObj); } catch (e) {}
    }
    const allowedNodes: string[] = restrictionsObj.allowedNodeIds || [];

    const controllerAccessMap: Record<string, boolean> = {};
    controllers.forEach(c => {
      const isAllowedByNode = allowedNodes.includes(c.id);
      const isAllowedByDevice = member.devicePermissions?.some(dp => dp.deviceId === c.id || (dp as any).device?.nodeId === c.id) || false;
      controllerAccessMap[c.id] = isAllowedByNode || isAllowedByDevice;
    });
    setAllowedControllers(controllerAccessMap);

    // Load saved allowed sections
    const savedSections = restrictionsObj.sectionPermissions || (member as any).sectionPermissions || {
      workspace: true,
      lighting: true,
      climate: true,
      security: false,
      irrigation: false,
      automations: false,
      energy: true,
      infrastructure: false,
      system: false
    };
    setAllowedSections(savedSections);
  };

  const toggleSection = (sectionKey: string) => {
    setAllowedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const toggleController = (controllerId: string) => {
    setAllowedControllers(prev => ({
      ...prev,
      [controllerId]: !prev[controllerId]
    }));
  };

  const toggleRoom = (roomId: string) => {
    setAllowedRooms(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  const savePermissions = async () => {
    if (!selectedMember) return;
    setSaving(true);
    try {
      const roomIds = Object.keys(allowedRooms).filter(id => allowedRooms[id]);
      const nodeIds = Object.keys(allowedControllers).filter(id => allowedControllers[id]);
      const targetHomeId = user?.homeId || 'active';

      const payload = {
        roomIds,
        nodeIds,
        deviceIds: nodeIds,
        sectionPermissions: allowedSections,
        role: memberRole
      };

      const res = await fetchAuth(`/api/homes/${targetHomeId}/members/${selectedMember.id}/rooms`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        notify('تم حفظ وتطبيق كافة صلاحيات الغرف والمتحكمات والخانات بنجاح! 🔒✨', 'success');
        await loadData();
      } else {
        const err = await res.json();
        notify(err.message || 'خطأ في التحديث', 'error');
      }
    } catch (e: any) {
      notify('حدث خطأ أثناء حفظ الصلاحيات: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const isRestricted = (roleStr: string) => {
    const r = (roleStr || '').toUpperCase();
    return r.includes('RESTRICTED') || r.includes('USER') || r === 'GUEST';
  };

  const rolesList = [
    {
      id: 'RESTRICTED',
      name: 'مستخدم مقيد (Restricted)',
      desc: 'تخصيصه بغرف ومتحكمات ESP32 وخانات محددة فقط',
      icon: Lock,
      color: 'from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/50'
    },
    {
      id: 'MEMBER',
      name: 'عضو عائلة (Member)',
      desc: 'تحكم عام بكافة غرف وأجهزة المنزل',
      icon: Users,
      color: 'from-blue-500/20 to-cyan-500/20 text-blue-300 border-blue-500/50'
    },
    {
      id: 'ADMIN',
      name: 'مسؤول المنظومة (Admin)',
      desc: 'إدارة كاملة للأجهزة والمستخدمين والإعدادات',
      icon: Shield,
      color: 'from-cyan-500/20 to-emerald-500/20 text-cyan-300 border-cyan-500/50'
    },
    {
      id: 'BLOCKED',
      name: 'محجوب تماماً (Blocked)',
      desc: 'حظر كامل من التحكم أو فتح أي صفحة',
      icon: EyeOff,
      color: 'from-rose-500/20 to-red-600/20 text-rose-300 border-rose-500/50'
    }
  ];

  const systemSectionsList = [
    { key: 'workspace', name: 'مساحة العمل ولوحة القيادة', sub: 'Dashboard & Workspace', icon: LayoutGrid },
    { key: 'lighting', name: 'الإضاءة والستائر والمفاتيح', sub: 'Lighting & Curtains', icon: Lightbulb },
    { key: 'climate', name: 'التكييف والأجهزة والتلفاز', sub: 'Climate & Appliances', icon: Fan },
    { key: 'security', name: 'الأقفال والكاميرات والحماية', sub: 'Locks & Security', icon: Key },
    { key: 'irrigation', name: 'الري التلقائي والمضخات', sub: 'Irrigation & Pumps', icon: Droplets },
    { key: 'automations', name: 'الذكاء والمشاهد والأوتوماتيك', sub: 'AI & Automations', icon: Bot },
    { key: 'energy', name: 'التحليلات وسجل الطاقة', sub: 'Analytics & Energy', icon: Zap },
    { key: 'infrastructure', name: 'البنية التحتية وعقد MQTT', sub: 'Infrastructure & Nodes', icon: Server },
    { key: 'system', name: 'إعدادات النظام وإدارة الأعضاء', sub: 'System & Admin', icon: Settings2 }
  ];

  return (
    <div className="p-4 md:p-8 min-h-full relative w-full pb-44 font-sans" dir="rtl">
      
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 bg-slate-950/80 p-6 rounded-[2rem] border border-white/15 backdrop-blur-2xl shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-cyan-500/40 border border-indigo-400 text-indigo-300 flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.4)]">
            <Shield size={30} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              إدارة وحجب صلاحيات الأعضاء
            </h1>
            <p className="text-slate-300 text-sm font-medium mt-1">
              تخصيص وصول المستخدمين المقيدين للغرف ومتحكمات الـ ESP32 وإخفاء الخانات غير المصرح بها
            </p>
          </div>
        </div>

        {selectedMember && (
          <button
            onClick={savePermissions}
            disabled={saving}
            className="bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black px-8 py-3.5 rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 text-sm cursor-pointer shrink-0 border border-cyan-300/40"
          >
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            <span>{saving ? 'جاري الحفظ...' : 'حفظ وتطبيق الصلاحيات 🔒'}</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
          <RefreshCw size={32} className="animate-spin text-cyan-400" />
          <span className="text-sm font-bold text-slate-300">جاري تحميل مصفوفة الصلاحيات والمستخدمين...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Members Sidebar Selector (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-sm font-black text-white flex items-center gap-2">
                <Users size={18} className="text-cyan-400" />
                الأعضاء المسجلين ({members.length})
              </span>
              <span className="text-xs text-cyan-300 font-bold font-mono">اختر عضواً</span>
            </div>

            <div className="space-y-3">
              {members.map(member => {
                const isSelected = selectedMember?.id === member.id || selectedMember?.user?.id === member.user?.id;
                const r = (member.role || 'RESTRICTED').toUpperCase();
                const isUserOwner = r === 'SUPER_OWNER';
                const isUserAdmin = r === 'ADMIN';
                const isUserMember = r === 'MEMBER';

                return (
                  <div
                    key={member.id}
                    onClick={() => handleSelectMember(member)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden backdrop-blur-xl ${
                      isSelected
                        ? 'bg-slate-900/95 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)] scale-[1.02]'
                        : 'bg-slate-950/80 border-white/10 hover:border-white/30 hover:bg-slate-900/80'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base border shadow-md ${
                          isUserOwner ? 'bg-amber-500/25 text-amber-300 border-amber-400' :
                          isUserAdmin ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400' :
                          isUserMember ? 'bg-blue-500/25 text-blue-300 border-blue-400' :
                          'bg-purple-500/25 text-purple-300 border-purple-400'
                        }`}>
                          {(member.user.name || member.user.username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-black text-base leading-tight">{member.user.name || member.user.username}</p>
                          <p className="text-xs text-slate-300 font-mono mt-1 font-bold">@{member.user.username}</p>
                        </div>
                      </div>

                      <span className={`px-3 py-1.5 rounded-xl text-xs font-black border shadow-sm ${
                        isUserOwner ? 'bg-amber-500/20 text-amber-300 border-amber-400/50' :
                        isUserAdmin ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50' :
                        isUserMember ? 'bg-blue-500/20 text-blue-300 border-blue-400/50' :
                        'bg-purple-500/20 text-purple-300 border-purple-400/50'
                      }`}>
                        {r}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Permissions Matrix Editor (8 cols) */}
          <div className="lg:col-span-8">
            {selectedMember ? (
              <div className="bg-slate-950/80 border border-white/15 rounded-[2.5rem] p-6 md:p-8 backdrop-blur-3xl shadow-2xl space-y-8">
                
                {/* Active Member Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/15">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-indigo-600/40 border border-cyan-400 text-cyan-300 flex items-center justify-center font-black text-2xl shadow-lg">
                      {(selectedMember.user.name || selectedMember.user.username).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white flex items-center gap-2">
                        تعديل صلاحيات: {selectedMember.user.name || selectedMember.user.username}
                      </h2>
                      <p className="text-sm text-slate-300 font-mono mt-0.5 font-bold">اسم المستخدم: @{selectedMember.user.username}</p>
                    </div>
                  </div>

                  <span className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-bold text-white w-fit">
                    الرتبة الحالية: <strong className="text-cyan-400 font-black">{memberRole}</strong>
                  </span>
                </div>

                {/* 1. Visual Role Selector */}
                <div>
                  <label className="block text-sm font-black text-white mb-3 flex items-center gap-2">
                    <Sliders size={18} className="text-cyan-400" />
                    تحديد الرتبة ومستوى الوصول:
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {rolesList.map(roleItem => {
                      const isRoleSelected = memberRole === roleItem.id || (roleItem.id === 'RESTRICTED' && isRestricted(memberRole));
                      const IconComponent = roleItem.icon;

                      return (
                        <div
                          key={roleItem.id}
                          onClick={() => setMemberRole(roleItem.id)}
                          className={`p-4.5 rounded-2xl border transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                            isRoleSelected
                              ? `bg-gradient-to-br ${roleItem.color} shadow-lg scale-[1.01] border-cyan-400`
                              : 'bg-white/[0.03] border-white/15 hover:border-white/30 hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="mt-0.5">
                            <IconComponent size={22} className={isRoleSelected ? 'text-white' : 'text-slate-400'} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-base font-black text-white">{roleItem.name}</span>
                              {isRoleSelected && <CheckCircle2 size={18} className="text-cyan-400" />}
                            </div>
                            <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">{roleItem.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Conditional Content based on Role */}
                {isRestricted(memberRole) ? (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    
                    {/* 2. Allowed Rooms Section */}
                    <div className="p-6 rounded-3xl bg-slate-900/95 border border-emerald-500/30 shadow-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                            <HomeIcon size={20} />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-white">الغرف المسموح بالتحكم بأجهزتها</h3>
                            <p className="text-xs text-slate-300 font-medium">حدد الغرف التي يستطيع هذا المستخدم رؤيتها وتشغيل أجهزتها</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-black text-emerald-300 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 shadow-sm">
                          {Object.values(allowedRooms).filter(Boolean).length} غرف مفعلة
                        </span>
                      </div>

                      {rooms.length === 0 ? (
                        <p className="text-sm text-slate-400 p-4 bg-white/5 rounded-2xl text-center font-bold">لا توجد غرف مضافة في المنظومة حالياً.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                          {rooms.map(room => {
                            const isAllowed = !!allowedRooms[room.id];
                            return (
                              <div
                                key={room.id}
                                onClick={() => toggleRoom(room.id)}
                                className={`p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                                  isAllowed
                                    ? 'bg-emerald-500/20 border-emerald-400 text-white font-black shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                                    : 'bg-white/[0.03] border-white/15 text-slate-300 hover:border-white/30 hover:bg-white/[0.06]'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <HomeIcon size={18} className={isAllowed ? 'text-emerald-400' : 'text-slate-400'} />
                                  <div>
                                    <span className="text-sm font-black text-white block">{room.name}</span>
                                    <span className={`text-[11px] font-bold ${isAllowed ? 'text-emerald-300' : 'text-slate-400'}`}>
                                      {isAllowed ? 'مفعل ومتاح للتحكم 🟢' : 'محجوب ⚪'}
                                    </span>
                                  </div>
                                </div>
                                <ToggleSwitch
                                  checked={isAllowed}
                                  onChange={() => toggleRoom(room.id)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 3. Allowed ESP32 Controllers Section */}
                    <div className="p-6 rounded-3xl bg-slate-900/95 border border-indigo-500/30 shadow-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.2)]">
                            <Cpu size={20} />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-white">متحكمات ESP32 المسموحة</h3>
                            <p className="text-xs text-slate-300 font-medium">تخصيص لوحات الـ ESP32 التي يسمح له بإرسال الأوامر إليها</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-black text-indigo-300 px-3 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 shadow-sm">
                          {Object.values(allowedControllers).filter(Boolean).length} متحكمات
                        </span>
                      </div>

                      {controllers.length === 0 ? (
                        <p className="text-sm text-slate-400 p-4 bg-white/5 rounded-2xl text-center font-bold">لا توجد لوحات ESP32 متصلة حالياً.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                          {controllers.map(ctrl => {
                            const isAllowed = !!allowedControllers[ctrl.id];
                            return (
                              <div
                                key={ctrl.id}
                                onClick={() => toggleController(ctrl.id)}
                                className={`p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                                  isAllowed
                                    ? 'bg-indigo-500/20 border-indigo-400 text-white font-black shadow-[0_0_20px_rgba(99,102,241,0.25)]'
                                    : 'bg-white/[0.03] border-white/15 text-slate-300 hover:border-white/30 hover:bg-white/[0.06]'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 truncate pr-1">
                                  <Cpu size={18} className={isAllowed ? 'text-indigo-400' : 'text-slate-400'} />
                                  <div className="truncate">
                                    <span className="text-sm font-black text-white block truncate">{ctrl.name}</span>
                                    <span className="text-[11px] text-slate-300 font-mono mt-0.5 block truncate font-bold">ESP ID: {ctrl.id.substring(0, 14)}</span>
                                  </div>
                                </div>
                                <ToggleSwitch
                                  checked={isAllowed}
                                  onChange={() => toggleController(ctrl.id)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 4. Allowed Sidebar Sections (Hiding Whitelist) */}
                    <div className="p-6 rounded-3xl bg-slate-900/95 border border-amber-500/30 shadow-xl space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                          <Layers size={20} />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-white">تخصيص الخانات المسموح بفتحها (إخفاء المحجوب تلقائياً)</h3>
                          <p className="text-xs text-amber-200 font-medium">
                            الخانة غير المفعلة ستختفي تماماً من القائمة الجانبية لهذا المستخدم ولن يراها
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                        {systemSectionsList.map(sec => {
                          const isAllowed = allowedSections[sec.key] !== false;
                          const SecIcon = sec.icon;

                          return (
                            <div
                              key={sec.key}
                              onClick={() => toggleSection(sec.key)}
                              className={`p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                                isAllowed
                                  ? 'bg-amber-500/15 border-amber-400 text-white font-black shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                                  : 'bg-white/[0.03] border-white/15 text-slate-400 hover:border-white/30 hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-center gap-3 truncate pr-1">
                                <SecIcon size={20} className={isAllowed ? 'text-amber-400' : 'text-slate-500'} />
                                <div className="truncate">
                                  <span className="text-sm font-black text-white block truncate leading-tight">{sec.name}</span>
                                  <span className="text-[11px] text-slate-300 font-bold block truncate mt-0.5">{sec.sub}</span>
                                </div>
                              </div>
                              <ToggleSwitch
                                checked={isAllowed}
                                onChange={() => toggleSection(sec.key)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                ) : memberRole === 'BLOCKED' ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-rose-400 bg-rose-500/15 border border-rose-500/30 rounded-3xl">
                    <EyeOff className="w-16 h-16 text-rose-500 mb-3" />
                    <h3 className="text-xl font-black text-white">تم حجب هذا المستخدم بالكامل</h3>
                    <p className="mt-1.5 text-sm text-slate-200 max-w-sm font-medium">لن يستطيع هذا المستخدم تسجيل الدخول أو التحكم بأي جهاز أو غرفة في المنظومة.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-3xl">
                    <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-3" />
                    <h3 className="text-xl font-black text-white">صلاحيات وصول كاملة ({memberRole})</h3>
                    <p className="mt-1.5 text-sm text-slate-200 max-w-md font-medium">يمتلك هذا الحساب صلاحية كاملة للتحكم بجميع أجهزة ومتحكمات وغرف المنظومة بدون أي قيود.</p>
                  </div>
                )}

                {/* Bottom Save Button */}
                <div className="pt-4 border-t border-white/15 flex justify-end">
                  <button
                    onClick={savePermissions}
                    disabled={saving}
                    className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black px-10 py-4 rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2.5 text-sm cursor-pointer border border-cyan-300/40"
                  >
                    {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                    <span>{saving ? 'جاري حفظ وتطبيق الصلاحيات...' : 'حفظ وتطبيق الصلاحيات 🔒'}</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="h-full min-h-[400px] flex items-center justify-center border-2 border-dashed border-white/15 rounded-[2.5rem] p-12 text-center bg-slate-950/60">
                <p className="text-slate-300 text-base font-black">يرجى اختيار مستخدم من القائمة لتعديل وتخصيص صلاحياته</p>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
