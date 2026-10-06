'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, Key, Edit2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import InviteUserModal from '@/components/modals/InviteUserModal';
import RoomAccessModal from '@/components/modals/RoomAccessModal';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMIN';

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users');
    }
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const deleteUser = async (id: string) => {
    if (id === currentUser?.id) {
      alert('لا يمكنك حذف حسابك الخاص');
      return;
    }
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'خطأ في الحذف');
    }
  };

  const toggleRole = async (id: string, currentRole: string) => {
    if (id === currentUser?.id) {
      alert('لا يمكنك تغيير دورك الخاص');
      return;
    }
    const newRole = currentRole === 'ADMIN' ? 'RESTRICTED_USER' : 'ADMIN';
    try {
      await api.patch(`/users/${id}/role`, { role: newRole });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'خطأ في تغيير الدور');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]" dir="rtl">
        <h2 className="text-xl text-zinc-500">ليس لديك صلاحية للوصول إلى هذه الصفحة</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-100">إدارة المستخدمين</h1>
        <Button onClick={() => setShowInviteModal(true)} className="bg-zinc-100 text-zinc-900 hover:bg-zinc-300">
          <UserPlus size={16} className="ml-2"/> دعوة مستخدم جديد
        </Button>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-zinc-300">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="py-3 px-4">المستخدم</th>
                  <th className="py-3 px-4">الدور</th>
                  <th className="py-3 px-4">الغرف المتاحة</th>
                  <th className="py-3 px-4">تاريخ الانضمام</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                      <td className="py-4 px-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-lg text-zinc-400">
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-zinc-100">{u.username}</span>
                        {isSelf && <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">أنت</Badge>}
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={u.role === 'ADMIN' ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-700 text-zinc-100'}>
                          {u.role === 'ADMIN' ? 'مدير (ADMIN)' : 'محدود (RESTRICTED)'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        {u.role === 'ADMIN' ? (
                          <span className="text-zinc-500 text-sm">وصول كامل لجميع الغرف</span>
                        ) : (
                          <span className="text-zinc-400 font-mono bg-zinc-800 px-2 py-1 rounded">{u.roomAccess?.length || 0} غرف</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-sm text-zinc-500">
                        {new Date(u.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => toggleRole(u.id, u.role)} disabled={isSelf} title="تغيير الصلاحية">
                            <Edit2 size={16} className={isSelf ? "text-zinc-700" : "text-blue-400"} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(u); setShowAccessModal(true); }} disabled={u.role === 'ADMIN'} title="إدارة الغرف">
                            <Key size={16} className={u.role === 'ADMIN' ? "text-zinc-700" : "text-emerald-400"} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteUser(u.id)} disabled={isSelf} title="حذف المستخدم">
                            <Trash2 size={16} className={isSelf ? "text-zinc-700" : "text-red-400"} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showInviteModal && (
        <InviteUserModal 
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => { setShowInviteModal(false); fetchUsers(); }}
        />
      )}

      {showAccessModal && selectedUser && (
        <RoomAccessModal 
          user={selectedUser}
          onClose={() => { setShowAccessModal(false); setSelectedUser(null); }}
          onSuccess={() => { setShowAccessModal(false); fetchUsers(); }}
        />
      )}
    </div>
  );
}
