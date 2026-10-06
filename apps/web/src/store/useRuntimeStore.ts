import { create } from 'zustand';

export type Language = 'ar' | 'en';

interface RuntimeStore {
  lang: Language;
  translations: Record<string, string>;
  uiConfig: any;
  featureFlags: Record<string, boolean>;
  
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  
  setLang: (lang: Language) => void;
  syncConfig: (payload: { translations?: any; uiConfig?: any; featureFlags?: any }) => void;
  fetchRuntimeConfig: (fetchAuth: Function) => Promise<void>;
}

export const useRuntimeStore = create<RuntimeStore>((set, get) => ({
  lang: typeof window !== 'undefined' ? (localStorage.getItem('mosa_lang') as Language || 'ar') : 'ar',
  translations: {},
  uiConfig: {},
  featureFlags: {
    // Default system features
    mqtt_debug_mode: false,
    advanced_security: false,
    ai_automation: true, // as requested
  },
  isSidebarOpen: true, // Default to open

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

  setLang: (lang) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mosa_lang', lang);
      localStorage.setItem('language', lang);
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    set({ lang });
  },

  syncConfig: (payload) => {
    set((state) => ({
      translations: { ...state.translations, ...(payload.translations || {}) },
      uiConfig: { ...state.uiConfig, ...(payload.uiConfig || {}) },
      featureFlags: { ...state.featureFlags, ...(payload.featureFlags || {}) }
    }));
  },

  fetchRuntimeConfig: async (fetchAuth) => {
    try {
      const res = await fetchAuth('/api/config/runtime');
      if (res.ok) {
        const data = await res.json();
        get().syncConfig(data);
      }
    } catch (e) {
      console.error('Failed to fetch runtime config', e);
    }
  }
}));
