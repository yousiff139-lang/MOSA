import { useEffect } from 'react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

export function useSocket() {
  const { initBackendConnection } = useSmartHomeStore();

  useEffect(() => {
    initBackendConnection();
    
    // The cleanup/disconnect logic can be handled inside the store or here
    return () => {
      // We don't necessarily want to disconnect on component unmount
      // if it's meant to be a global persistent connection,
      // but we can leave this here for completeness.
    };
  }, [initBackendConnection]);
}
