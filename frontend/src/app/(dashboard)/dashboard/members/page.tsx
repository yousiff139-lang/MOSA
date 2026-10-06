'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Shield, Clock, Link as LinkIcon, Mail, Copy, Check } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';

const API_BASE = 'http://localhost:8080/api';

export default function MembersPage() {
  const { user } = useAuthStore();
  const isAdminOrOwner = user?.role === 'owner' || user?.role === 'admin';
  const queryClient = useQueryClient();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteResult, setInviteResult] = useState<{link: string, token: string} | null>(null);
  
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviteDuration, setInviteDuration] = useState(24);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      // For now, assuming the API fetches members of the active home
      const res = await axios.get(`${API_BASE}/homes/${user?.activeHomeId}/members`, { withCredentials: true });
      return res.data;
    },
    enabled: !!user?.activeHomeId
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post(`${API_BASE}/invitations`, {
        role: inviteRole,
        expiresInHours: inviteDuration
      }, { withCredentials: true });
      return res.data;
    },
    onSuccess: (data) => {
      setInviteResult(data);
    }
  });

  const copyToClipboard = () => {
    if (inviteResult) {
      navigator.clipboard.writeText(inviteResult.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-700" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white drop-shadow-md">إدارة الأعضاء والدعوات</h1>
          <p className="text-sm text-zinc-400 mt-1">التحكم في صلاحيات الوصول للمنزل الذكي الخاص بك</p>
        </div>
        
        {isAdminOrOwner && (
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-500/20"
            onClick={() => { setShowInviteModal(true); setInviteResult(null); }}
          >
            <UserPlus size={18} className="ml-2"/> دعوة عضو جديد
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="text-center py-12 text-zinc-500 glass-card rounded-3xl">جاري التحميل...</div>
        ) : (
          members.map((member: any, idx: number) => (
            <motion.div key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
              <Card className="glass-card border-[#1e293b] overflow-hidden rounded-2xl flex flex-col md:flex-row items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{member.user?.name || member.user?.email || 'مستخدم غير معروف'}</h3>
                    <p className="text-xs text-zinc-400 font-mono mt-1">{member.user?.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mt-4 md:mt-0">
                  <Badge variant="outline" className={`
                    ${member.role === 'OWNER' ? 'border-amber-500/50 text-amber-500 bg-amber-500/10' : ''}
                    ${member.role === 'ADMIN' ? 'border-purple-500/50 text-purple-500 bg-purple-500/10' : ''}
                    ${member.role === 'MEMBER' ? 'border-blue-500/50 text-blue-500 bg-blue-500/10' : ''}
                    ${member.role === 'GUEST' ? 'border-zinc-500/50 text-zinc-400 bg-zinc-500/10' : ''}
                  `}>
                    <Shield size={12} className="ml-1" />
                    {member.role}
                  </Badge>
                  
                  {member.role === 'GUEST' && member.accessExpiry && (
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock size={12} /> ينتهي: {new Date(member.accessExpiry).toLocaleDateString('ar-SA')}
                    </span>
                  )}
                  
                  {isAdminOrOwner && member.role !== 'OWNER' && (
                    <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">إزالة</Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#1e293b]">
              <h2 className="text-xl font-bold text-white">إرسال دعوة جديدة</h2>
            </div>
            
            <div className="p-6 space-y-6">
              {!inviteResult ? (
                <>
                  <div className="space-y-3">
                    <label className="text-sm text-zinc-400">صلاحية العضو الجديد</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['ADMIN', 'MANAGER', 'MEMBER', 'GUEST'].map(role => (
                        <Button 
                          key={role}
                          variant="outline"
                          onClick={() => setInviteRole(role)}
                          className={`justify-start ${inviteRole === role ? 'bg-blue-600 border-blue-500 text-white' : 'bg-transparent border-[#1e293b] text-zinc-400'}`}
                        >
                          {role}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-sm text-zinc-400">مدة صلاحية الرابط (بالساعات)</label>
                    <input 
                      type="number" 
                      value={inviteDuration}
                      onChange={(e) => setInviteDuration(parseInt(e.target.value) || 24)}
                      className="w-full bg-black/50 border border-[#1e293b] rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-6"
                    onClick={() => inviteMutation.mutate()}
                    disabled={inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء رابط الدعوة'}
                  </Button>
                </>
              ) : (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-white">تم إنشاء الدعوة بنجاح!</h3>
                  <p className="text-sm text-zinc-400">يمكنك نسخ الرابط وإرساله للعضو الجديد، أو إرساله مباشرة عبر البريد الإلكتروني.</p>
                  
                  <div className="flex items-center gap-2 bg-black/50 border border-[#1e293b] p-2 rounded-xl">
                    <input 
                      type="text" 
                      readOnly 
                      value={inviteResult.link}
                      className="bg-transparent border-none text-zinc-300 w-full text-left font-mono text-xs focus:outline-none"
                      dir="ltr"
                    />
                    <Button size="icon" variant="ghost" onClick={copyToClipboard} className="text-blue-400 hover:bg-blue-500/20 rounded-lg">
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button 
                      className="flex-1 bg-[#1e293b] hover:bg-[#334155] text-white"
                      onClick={() => {
                         // Send via email mockup
                         alert('تم إرسال الدعوة عبر البريد بنجاح!');
                         setShowInviteModal(false);
                      }}
                    >
                      <Mail size={16} className="ml-2" /> إرسال إيميل
                    </Button>
                    <Button 
                      className="flex-1 bg-transparent border border-[#1e293b] text-zinc-400 hover:text-white"
                      onClick={() => setShowInviteModal(false)}
                    >
                      إغلاق
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
