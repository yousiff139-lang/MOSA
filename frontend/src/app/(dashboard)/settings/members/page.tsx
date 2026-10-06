'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserPlus, MoreVertical, Shield, ShieldAlert, User, Eye, UserMinus } from 'lucide-react';
import { PermissionGuard } from '@/components/PermissionGuard';
import { motion } from 'framer-motion';

const roleConfig = {
  SUPER_OWNER: { label: 'مالك النظام', color: 'bg-amber-500/20 text-amber-500 border-amber-500/50', icon: <ShieldAlert size={14} /> },
  ADMIN: { label: 'مدير', color: 'bg-blue-500/20 text-blue-500 border-blue-500/50', icon: <Shield size={14} /> },
  MEMBER: { label: 'عضو', color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50', icon: <User size={14} /> },
  RESTRICTED: { label: 'مقيّد', color: 'bg-orange-500/20 text-orange-500 border-orange-500/50', icon: <UserMinus size={14} /> },
  GUEST: { label: 'ضيف', color: 'bg-gray-500/20 text-gray-400 border-gray-500/50', icon: <Eye size={14} /> }
};

export default function MembersPage() {
  // Mock data for UI demonstration
  const [members] = useState([
    { id: '1', name: 'أحمد الرشيد', email: 'ahmed@example.com', role: 'SUPER_OWNER', joinedAt: '2023-01-15' },
    { id: '2', name: 'سارة خالد', email: 'sara@example.com', role: 'ADMIN', joinedAt: '2023-02-20' },
    { id: '3', name: 'عمر أحمد', email: 'omar@example.com', role: 'MEMBER', joinedAt: '2023-05-10', rooms: ['الصالة', 'غرفة النوم'] },
    { id: '4', name: 'الطفل زيد', email: 'zaid@example.com', role: 'RESTRICTED', joinedAt: '2023-08-01', restrictions: 'من 7ص إلى 9م' },
    { id: '5', name: 'زائر مؤقت', email: 'guest@example.com', role: 'GUEST', joinedAt: '2024-01-10', expiresAt: '2024-01-17' },
  ]);

  return (
    <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-700" dir="rtl">
      <div className="flex justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white drop-shadow-md">إدارة الأعضاء</h1>
          <p className="text-sm text-zinc-400 mt-1">إدارة صلاحيات المستخدمين والضيوف للمنزل</p>
        </div>
        
        <PermissionGuard require="ADMIN" showTooltip>
          <Button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl shadow-lg shadow-blue-500/20">
            <UserPlus size={18} className="ml-2"/> دعوة عضو جديد
          </Button>
        </PermissionGuard>
      </div>

      <Card className="glass-card border-[#1e293b] rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-[#1e293b] bg-black/20">
                <th className="py-4 px-6 text-zinc-400 font-medium text-sm">العضو</th>
                <th className="py-4 px-6 text-zinc-400 font-medium text-sm">الصلاحية (الدور)</th>
                <th className="py-4 px-6 text-zinc-400 font-medium text-sm">تفاصيل الوصول</th>
                <th className="py-4 px-6 text-zinc-400 font-medium text-sm">تاريخ الانضمام</th>
                <th className="py-4 px-6 text-zinc-400 font-medium text-sm">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/50">
              {members.map((member, idx) => {
                const rConfig = roleConfig[member.role as keyof typeof roleConfig];
                return (
                  <motion.tr 
                    key={member.id} 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: idx * 0.1 }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-inner">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-zinc-200 font-medium">{member.name}</div>
                          <div className="text-xs text-zinc-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge variant="outline" className={`flex w-fit items-center gap-1.5 px-3 py-1 rounded-full border ${rConfig.color}`}>
                        {rConfig.icon} {rConfig.label}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      {member.role === 'SUPER_OWNER' || member.role === 'ADMIN' ? (
                        <span className="text-xs text-zinc-400 bg-white/5 px-2 py-1 rounded">وصول كامل لكافة الأجهزة</span>
                      ) : member.role === 'MEMBER' ? (
                        <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">{member.rooms?.join(', ')}</span>
                      ) : member.role === 'RESTRICTED' ? (
                        <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded">وقت محدد: {member.restrictions}</span>
                      ) : (
                        <span className="text-xs text-gray-400 bg-gray-500/10 px-2 py-1 rounded">ينتهي في: {member.expiresAt}</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-zinc-400">
                      {new Date(member.joinedAt).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="py-4 px-6">
                      <PermissionGuard require="ADMIN">
                        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg">
                          <MoreVertical size={18} />
                        </Button>
                      </PermissionGuard>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
