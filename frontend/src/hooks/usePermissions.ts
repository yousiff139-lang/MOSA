import { useAuthStore } from '@/store/auth.store';

export type Role = 'SUPER_OWNER' | 'ADMIN' | 'MEMBER' | 'RESTRICTED' | 'GUEST';

const roleLevel: Record<Role, number> = {
  SUPER_OWNER: 5,
  ADMIN: 4,
  MEMBER: 3,
  RESTRICTED: 2,
  GUEST: 1
};

export function usePermissions() {
  const { user } = useAuthStore();
  
  // In a real app, user object should contain their homeMember record for the current active home
  const currentRole = (user?.role as Role) || 'MEMBER';
  const restrictions: any = user?.restrictions || {};

  const hasRole = (requiredRole: Role) => {
    return roleLevel[currentRole] >= roleLevel[requiredRole];
  };

  const isWithinAllowedHours = () => {
    if (currentRole !== 'RESTRICTED' || !restrictions.allowedHours) return true;
    const [start, end] = restrictions.allowedHours;
    const currentHour = new Date().getHours();
    return currentHour >= start && currentHour < end;
  };

  const canControl = (deviceId: string) => {
    if (hasRole('MEMBER')) return true;
    if (currentRole === 'GUEST' || currentRole === 'RESTRICTED') {
      if (restrictions.viewOnly) return false;
      if (restrictions.deviceWhitelist && !restrictions.deviceWhitelist.includes(deviceId)) return false;
      return isWithinAllowedHours();
    }
    return false;
  };

  const canViewDevice = (deviceId: string) => {
    if (hasRole('MEMBER')) return true;
    if (restrictions.deviceWhitelist && !restrictions.deviceWhitelist.includes(deviceId)) return false;
    return true;
  };

  const canManageMembers = () => hasRole('ADMIN');
  const canAccessSettings = () => hasRole('ADMIN');
  const canModifyBranding = () => hasRole('SUPER_OWNER');

  return {
    currentRole,
    hasRole,
    canControl,
    canViewDevice,
    canManageMembers,
    canAccessSettings,
    canModifyBranding,
    isWithinAllowedHours
  };
}
