'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { notify } from '@/store/useConfirmStore';

const GATED_TECHNICAL_ROUTES = [
  '/developer',
  '/builder',
  '/flasher',
  '/ota',
  '/infrastructure',
  '/edge-nodes',
  '/mqtt-gateway',
  '/system-health',
  '/automations/flow',
  '/logs',
  '/reports',
  '/billing',
  '/marketplace',
  '/advanced-security',
  '/superadmin',
  '/partner'
];

export function SimpleModeGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const uiMode = useSmartHomeStore(state => state.uiMode);
  const user = useSmartHomeStore(state => state.user);

  useEffect(() => {
    if (!pathname) return;

    const userRole = (user?.role || '').toUpperCase();
    const isSuperAdminOrOwner = userRole === 'SUPER_OWNER' || userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'DEVELOPER';

    // Check if user is in Simple Mode or is a non-admin attempting to access a technical route
    const isTechnicalRoute = GATED_TECHNICAL_ROUTES.some(route => 
      pathname === route || pathname.startsWith(`${route}/`)
    );

    if ((uiMode === 'simple' || !isSuperAdminOrOwner) && isTechnicalRoute) {
      notify('هذه الصفحة مخصصة لمهندسي ومطوري النظام فقط. مرحباً بك في لوحة تحكم المنزل.', 'info');
      router.replace('/');
    }
  }, [pathname, uiMode, user, router]);

  return <>{children}</>;
}
