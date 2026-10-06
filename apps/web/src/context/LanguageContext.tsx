"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import ar from '../locales/ar.json';
import en from '../locales/en.json';

type Language = 'ar' | 'en';
type Translations = typeof ar;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const language = useRuntimeStore(s => s.lang);
  const setLang = useRuntimeStore(s => s.setLang);

  const setLanguage = (lang: Language) => {
    setLang(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
      localStorage.setItem('mosa_lang', lang);
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
  };

  const t = (key: string): string => {
    const dict = language === 'en' ? en : ar;
    return (dict as any)[key] || (ar as any)[key] || key;
  };

  const dir: 'rtl' | 'ltr' = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = dir;
      document.documentElement.lang = language;
    }
  }, [dir, language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
