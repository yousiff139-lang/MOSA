import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken) => {
        // Next.js middleware needs cookies, so we save it here too
        document.cookie = `token=${accessToken}; path=/; max-age=86400`;
        set({ user, accessToken, isAuthenticated: true });
      },
      logout: () => {
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    { name: 'mosa-auth-storage' }
  )
);
