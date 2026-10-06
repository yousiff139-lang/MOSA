"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

export function SocketManager() {
  const pathname = usePathname();
  const initBackendConnection = useSmartHomeStore(state => state.initBackendConnection);
  const refreshStateSilently = useSmartHomeStore(state => state.refreshStateSilently);

  useEffect(() => {
    // Never initiate socket or API polling on auth or setup pages
    if (pathname?.startsWith('/auth') || pathname?.startsWith('/setup')) return;

    // Only connect if user token exists
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    initBackendConnection();

    // Instant silent sync when user wakes mobile screen or switches back to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshStateSilently();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [initBackendConnection, refreshStateSilently, pathname]);

  return null;
}
