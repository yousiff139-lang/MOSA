import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'auto';
export type AccentColor = 'blue' | 'emerald' | 'rose' | 'purple' | 'orange';
export type BackgroundStyle = 'aurora' | 'glass' | 'solid';
export type DarkBackgroundHue = 'midnight' | 'plum' | 'emerald' | 'charcoal' | 'coffee';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  
  backgroundStyle: BackgroundStyle;
  setBackgroundStyle: (style: BackgroundStyle) => void;
  
  darkBackgroundHue: DarkBackgroundHue;
  setDarkBackgroundHue: (hue: DarkBackgroundHue) => void;

  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// RGB values for Tailwind (500 shade)
const accentColorMap: Record<AccentColor, string> = {
  blue: '59 130 246',     // #3b82f6
  emerald: '16 185 129',  // #10b981
  rose: '244 63 94',      // #f43f5e
  purple: '168 85 247',   // #a855f7
  orange: '249 115 22'    // #f97316
};

// RGB values for Aurora blobs (lighter/different shades for gradients)
export const auroraColorsMap: Record<AccentColor, string[]> = {
  blue: ['rgba(59,130,246,0.15)', 'rgba(139,92,246,0.15)', 'rgba(16,185,129,0.1)'], // Blue, Purple, Emerald
  emerald: ['rgba(16,185,129,0.15)', 'rgba(52,211,153,0.15)', 'rgba(59,130,246,0.1)'], // Emerald, Green, Blue
  rose: ['rgba(244,63,94,0.15)', 'rgba(251,113,133,0.15)', 'rgba(168,85,247,0.1)'], // Rose, Light Rose, Purple
  purple: ['rgba(168,85,247,0.15)', 'rgba(192,132,252,0.15)', 'rgba(236,72,153,0.1)'], // Purple, Light Purple, Pink
  orange: ['rgba(249,115,22,0.15)', 'rgba(251,146,60,0.15)', 'rgba(234,179,8,0.1)'], // Orange, Light Orange, Yellow
};

export const darkBgMap: Record<DarkBackgroundHue, { base: string; solid: string }> = {
  midnight: { base: '#090E17', solid: '#0B1221' },
  plum: { base: '#120516', solid: '#1b0922' },
  emerald: { base: '#041510', solid: '#092119' },
  charcoal: { base: '#0f1115', solid: '#16181d' },
  coffee: { base: '#1a110c', solid: '#231812' }
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'auto';
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    const saved = localStorage.getItem('accentColor');
    return (saved as AccentColor) || 'blue';
  });

  const [backgroundStyle, setBackgroundStyleState] = useState<BackgroundStyle>(() => {
    const saved = localStorage.getItem('backgroundStyle');
    return (saved as BackgroundStyle) || 'aurora';
  });

  const [darkBackgroundHue, setDarkBackgroundHueState] = useState<DarkBackgroundHue>(() => {
    const saved = localStorage.getItem('darkBackgroundHue');
    return (saved as DarkBackgroundHue) || 'midnight';
  });

  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [hapticsEnabled, setHapticsEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem('hapticsEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [activeTheme, setActiveTheme] = useState<'light' | 'dark'>('dark');

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('accentColor', accentColor);
    localStorage.setItem('backgroundStyle', backgroundStyle);
    localStorage.setItem('darkBackgroundHue', darkBackgroundHue);
    localStorage.setItem('soundEnabled', String(soundEnabled));
    localStorage.setItem('hapticsEnabled', String(hapticsEnabled));
  }, [theme, accentColor, backgroundStyle, darkBackgroundHue, soundEnabled, hapticsEnabled]);

  // Handle active theme logic (Light/Dark/Auto)
  useEffect(() => {
    const updateActiveTheme = () => {
      if (theme === 'auto') {
        const hour = new Date().getHours();
        if (hour >= 20 || hour < 7) setActiveTheme('dark');
        else setActiveTheme('light');
      } else {
        setActiveTheme(theme);
      }
    };

    updateActiveTheme();
    const interval = setInterval(updateActiveTheme, 60000);
    return () => clearInterval(interval);
  }, [theme]);

  // Apply theme classes and CSS variables
  useEffect(() => {
    const root = document.documentElement;

    // Dark mode class & Background variables
    if (activeTheme === 'dark') {
      root.classList.add('dark');
      root.style.setProperty('--color-bg-base', darkBgMap[darkBackgroundHue].base);
      root.style.setProperty('--color-bg-solid', darkBgMap[darkBackgroundHue].solid);
    } else {
      root.classList.remove('dark');
      root.style.setProperty('--color-bg-base', '#f8fafc'); // slate-50
      root.style.setProperty('--color-bg-solid', '#ffffff');
    }

    // Set CSS variable for Tailwind to consume
    root.style.setProperty('--color-primary', accentColorMap[accentColor]);

  }, [activeTheme, accentColor, darkBackgroundHue]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'auto' : 'dark');
  };

  const setTheme = (t: Theme) => setThemeState(t);
  const setAccentColor = (c: AccentColor) => setAccentColorState(c);
  const setBackgroundStyle = (s: BackgroundStyle) => setBackgroundStyleState(s);
  const setDarkBackgroundHue = (h: DarkBackgroundHue) => setDarkBackgroundHueState(h);
  const setSoundEnabled = (e: boolean) => setSoundEnabledState(e);
  const setHapticsEnabled = (e: boolean) => setHapticsEnabledState(e);

  return (
    <ThemeContext.Provider value={{ 
      theme, setTheme, toggleTheme,
      accentColor, setAccentColor,
      backgroundStyle, setBackgroundStyle,
      darkBackgroundHue, setDarkBackgroundHue,
      soundEnabled, setSoundEnabled,
      hapticsEnabled, setHapticsEnabled
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
