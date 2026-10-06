import { useRuntimeStore } from '@/store/useRuntimeStore';
import ar from '../../public/locales/ar/common.json';
import en from '../../public/locales/en/common.json';

const translations = { ar, en };

export function useTranslation() {
  const lang = useRuntimeStore(state => state.lang);
  
  const t = (key: string): string => {
    const dict = translations[lang] || translations.ar;
    return dict[key as keyof typeof dict] || key;
  };

  return { t, lang, isEn: lang === 'en' };
}
