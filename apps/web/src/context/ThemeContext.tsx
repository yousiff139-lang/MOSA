"use client";

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

const accentColorMap: Record<AccentColor, { hex: string; glow: string; secondary: string; darkBg: string }> = {
  blue: { hex: '#00f0ff', glow: 'rgba(0, 240, 255, 0.45)', secondary: '#3b82f6', darkBg: 'rgba(0, 240, 255, 0.15)' },
  emerald: { hex: '#10b981', glow: 'rgba(16, 185, 129, 0.45)', secondary: '#34d399', darkBg: 'rgba(16, 185, 129, 0.15)' },
  rose: { hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.45)', secondary: '#fb7185', darkBg: 'rgba(244, 63, 94, 0.15)' },
  purple: { hex: '#b53cff', glow: 'rgba(181, 60, 255, 0.45)', secondary: '#c084fc', darkBg: 'rgba(181, 60, 255, 0.15)' },
  orange: { hex: '#f97316', glow: 'rgba(249, 115, 22, 0.45)', secondary: '#fb923c', darkBg: 'rgba(249, 115, 22, 0.15)' }
};

export const auroraColorsMap: Record<AccentColor, string[]> = {
  blue: [
    'radial-gradient(circle at center, rgba(0,240,255,0.65) 0%, rgba(59,130,246,0.40) 45%, transparent 75%)', 
    'radial-gradient(circle at center, rgba(37,99,235,0.60) 0%, rgba(139,92,246,0.35) 50%, transparent 75%)', 
    'radial-gradient(circle at center, rgba(6,182,212,0.55) 0%, rgba(30,58,138,0.30) 50%, transparent 75%)'
  ], 
  emerald: [
    'radial-gradient(circle at center, rgba(16,185,129,0.70) 0%, rgba(5,150,105,0.45) 45%, transparent 75%)', 
    'radial-gradient(circle at center, rgba(52,211,153,0.60) 0%, rgba(16,185,129,0.35) 50%, transparent 75%)', 
    'radial-gradient(circle at center, rgba(4,120,87,0.55) 0%, rgba(6,78,59,0.30) 50%, transparent 75%)'
  ], 
  rose: [
    'radial-gradient(circle at center, rgba(244,63,94,0.70) 0%, rgba(225,29,72,0.45) 45%, transparent 75%)', 
    'radial-gradient(circle at center, rgba(251,113,133,0.60) 0%, rgba(168,85,247,0.35) 50%, transparent 75%)', 
    'radial-gradient(circle at center, rgba(159,18,57,0.55) 0%, rgba(244,63,94,0.30) 50%, transparent 75%)'
  ], 
  purple: [
    'radial-gradient(circle at center, rgba(181,60,255,0.70) 0%, rgba(147,51,234,0.45) 45%, transparent 75%)', 
    'radial-gradient(circle at center, rgba(192,132,252,0.60) 0%, rgba(236,72,153,0.35) 50%, transparent 75%)', 
    'radial-gradient(circle at center, rgba(107,33,168,0.55) 0%, rgba(181,60,255,0.30) 50%, transparent 75%)'
  ], 
  orange: [
    'radial-gradient(circle at center, rgba(249,115,22,0.70) 0%, rgba(234,88,12,0.45) 45%, transparent 75%)', 
    'radial-gradient(circle at center, rgba(251,146,60,0.60) 0%, rgba(234,179,8,0.35) 50%, transparent 75%)', 
    'radial-gradient(circle at center, rgba(194,65,12,0.55) 0%, rgba(249,115,22,0.30) 50%, transparent 75%)'
  ], 
};

export const dynamicAmbientGradients: Record<AccentColor, { normal: string; eco: string; baseBg: string }> = {
  blue: {
    normal: `
      radial-gradient(ellipse 75% 65% at 0% 0%, rgba(0, 240, 255, 0.30) 0%, rgba(0, 240, 255, 0.08) 45%, transparent 65%),
      radial-gradient(ellipse 70% 60% at 100% 10%, rgba(37, 99, 235, 0.32) 0%, rgba(59, 130, 246, 0.10) 45%, transparent 65%),
      radial-gradient(ellipse 80% 70% at 50% 100%, rgba(139, 92, 246, 0.26) 0%, rgba(99, 102, 241, 0.08) 50%, transparent 70%),
      radial-gradient(ellipse 55% 50% at 85% 80%, rgba(16, 185, 129, 0.20) 0%, transparent 60%),
      radial-gradient(ellipse 50% 45% at 20% 70%, rgba(6, 182, 212, 0.18) 0%, transparent 55%),
      radial-gradient(ellipse 130% 130% at 50% 15%, rgba(20, 40, 75, 0.60) 0%, rgba(6, 11, 23, 0.95) 55%, #050a16 100%)
    `,
    eco: `
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(20, 35, 65, 0.35) 0%, transparent 70%),
      radial-gradient(ellipse 80% 60% at 50% 100%, rgba(10, 18, 35, 0.6) 0%, #050a16 100%)
    `,
    baseBg: '#050a16'
  },
  emerald: {
    normal: `
      radial-gradient(ellipse 75% 65% at 0% 0%, rgba(16, 185, 129, 0.34) 0%, rgba(16, 185, 129, 0.10) 45%, transparent 65%),
      radial-gradient(ellipse 70% 60% at 100% 10%, rgba(52, 211, 153, 0.28) 0%, rgba(5, 150, 105, 0.10) 45%, transparent 65%),
      radial-gradient(ellipse 80% 70% at 50% 100%, rgba(6, 182, 212, 0.24) 0%, rgba(4, 120, 87, 0.08) 50%, transparent 70%),
      radial-gradient(ellipse 55% 50% at 85% 80%, rgba(16, 185, 129, 0.22) 0%, transparent 60%),
      radial-gradient(ellipse 50% 45% at 20% 70%, rgba(52, 211, 153, 0.18) 0%, transparent 55%),
      radial-gradient(ellipse 130% 130% at 50% 15%, rgba(10, 50, 38, 0.60) 0%, rgba(4, 18, 14, 0.95) 55%, #030d0a 100%)
    `,
    eco: `
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(10, 45, 35, 0.35) 0%, transparent 70%),
      radial-gradient(ellipse 80% 60% at 50% 100%, rgba(6, 20, 16, 0.6) 0%, #030d0a 100%)
    `,
    baseBg: '#030d0a'
  },
  purple: {
    normal: `
      radial-gradient(ellipse 75% 65% at 0% 0%, rgba(181, 60, 255, 0.35) 0%, rgba(181, 60, 255, 0.10) 45%, transparent 65%),
      radial-gradient(ellipse 70% 60% at 100% 10%, rgba(147, 51, 234, 0.32) 0%, rgba(192, 132, 252, 0.10) 45%, transparent 65%),
      radial-gradient(ellipse 80% 70% at 50% 100%, rgba(236, 72, 153, 0.28) 0%, rgba(107, 33, 168, 0.08) 50%, transparent 70%),
      radial-gradient(ellipse 55% 50% at 85% 80%, rgba(99, 102, 241, 0.24) 0%, transparent 60%),
      radial-gradient(ellipse 50% 45% at 20% 70%, rgba(181, 60, 255, 0.20) 0%, transparent 55%),
      radial-gradient(ellipse 130% 130% at 50% 15%, rgba(50, 15, 75, 0.60) 0%, rgba(20, 6, 32, 0.95) 55%, #0c0416 100%)
    `,
    eco: `
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(45, 15, 65, 0.35) 0%, transparent 70%),
      radial-gradient(ellipse 80% 60% at 50% 100%, rgba(20, 8, 30, 0.6) 0%, #0c0416 100%)
    `,
    baseBg: '#0c0416'
  },
  rose: {
    normal: `
      radial-gradient(ellipse 75% 65% at 0% 0%, rgba(244, 63, 94, 0.35) 0%, rgba(244, 63, 94, 0.10) 45%, transparent 65%),
      radial-gradient(ellipse 70% 60% at 100% 10%, rgba(251, 113, 133, 0.30) 0%, rgba(225, 29, 72, 0.10) 45%, transparent 65%),
      radial-gradient(ellipse 80% 70% at 50% 100%, rgba(168, 85, 247, 0.26) 0%, rgba(159, 18, 57, 0.08) 50%, transparent 70%),
      radial-gradient(ellipse 55% 50% at 85% 80%, rgba(244, 63, 94, 0.22) 0%, transparent 60%),
      radial-gradient(ellipse 50% 45% at 20% 70%, rgba(251, 113, 133, 0.18) 0%, transparent 55%),
      radial-gradient(ellipse 130% 130% at 50% 15%, rgba(60, 15, 30, 0.60) 0%, rgba(25, 6, 15, 0.95) 55%, #10030a 100%)
    `,
    eco: `
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(55, 15, 25, 0.35) 0%, transparent 70%),
      radial-gradient(ellipse 80% 60% at 50% 100%, rgba(25, 8, 14, 0.6) 0%, #10030a 100%)
    `,
    baseBg: '#10030a'
  },
  orange: {
    normal: `
      radial-gradient(ellipse 75% 65% at 0% 0%, rgba(249, 115, 22, 0.35) 0%, rgba(249, 115, 22, 0.10) 45%, transparent 65%),
      radial-gradient(ellipse 70% 60% at 100% 10%, rgba(245, 158, 11, 0.30) 0%, rgba(234, 88, 12, 0.10) 45%, transparent 65%),
      radial-gradient(ellipse 80% 70% at 50% 100%, rgba(239, 68, 68, 0.26) 0%, rgba(194, 65, 12, 0.08) 50%, transparent 70%),
      radial-gradient(ellipse 55% 50% at 85% 80%, rgba(217, 119, 6, 0.22) 0%, transparent 60%),
      radial-gradient(ellipse 50% 45% at 20% 70%, rgba(245, 158, 11, 0.18) 0%, transparent 55%),
      radial-gradient(ellipse 130% 130% at 50% 15%, rgba(60, 30, 10, 0.60) 0%, rgba(25, 12, 4, 0.95) 55%, #100702 100%)
    `,
    eco: `
      radial-gradient(ellipse 70% 50% at 50% 0%, rgba(55, 30, 10, 0.35) 0%, transparent 70%),
      radial-gradient(ellipse 80% 60% at 50% 100%, rgba(25, 14, 5, 0.6) 0%, #100702 100%)
    `,
    baseBg: '#100702'
  }
};

export const darkBgMap: Record<DarkBackgroundHue, { base: string; solid: string }> = {
  midnight: { base: '#090E17', solid: '#0B1221' },
  plum: { base: '#120516', solid: '#1b0922' },
  emerald: { base: '#041510', solid: '#092119' },
  charcoal: { base: '#0f1115', solid: '#16181d' },
  coffee: { base: '#1a110c', solid: '#231812' }
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [accentColor, setAccentColorState] = useState<AccentColor>('blue');
  const [backgroundStyle, setBackgroundStyleState] = useState<BackgroundStyle>('aurora');
  const [darkBackgroundHue, setDarkBackgroundHueState] = useState<DarkBackgroundHue>('midnight');
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(true);
  const [hapticsEnabled, setHapticsEnabledState] = useState<boolean>(true);
  const [activeTheme, setActiveTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    setThemeState((localStorage.getItem('theme') as Theme) || 'dark');
    setAccentColorState((localStorage.getItem('accentColor') as AccentColor) || 'blue');
    setBackgroundStyleState((localStorage.getItem('backgroundStyle') as BackgroundStyle) || 'aurora');
    setDarkBackgroundHueState((localStorage.getItem('darkBackgroundHue') as DarkBackgroundHue) || 'midnight');
    setSoundEnabledState(localStorage.getItem('soundEnabled') !== 'false');
    setHapticsEnabledState(localStorage.getItem('hapticsEnabled') !== 'false');
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('accentColor', accentColor);
    localStorage.setItem('backgroundStyle', backgroundStyle);
    localStorage.setItem('darkBackgroundHue', darkBackgroundHue);
    localStorage.setItem('soundEnabled', String(soundEnabled));
    localStorage.setItem('hapticsEnabled', String(hapticsEnabled));
  }, [theme, accentColor, backgroundStyle, darkBackgroundHue, soundEnabled, hapticsEnabled]);

  useEffect(() => {
    const updateActiveTheme = () => {
      setActiveTheme('dark');
    };

    updateActiveTheme();
    const interval = setInterval(updateActiveTheme, 60000);
    return () => clearInterval(interval);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (activeTheme === 'dark') {
      root.classList.add('dark');
      root.style.setProperty('--background', darkBgMap[darkBackgroundHue].base);
      root.style.setProperty('--foreground', '#e2e8f0');
      root.style.setProperty('--card', 'rgba(255, 255, 255, 0.02)');
      root.style.setProperty('--card-foreground', '#e2e8f0');
    } else {
      root.classList.remove('dark');
      root.style.setProperty('--background', '#f1f5f9');
      root.style.setProperty('--foreground', '#0f172a');
      root.style.setProperty('--card', '#ffffff');
      root.style.setProperty('--card-foreground', '#0f172a');
    }
    root.style.setProperty('--primary', accentColorMap[accentColor].hex);
    root.style.setProperty('--primary-glow', accentColorMap[accentColor].glow);
    root.style.setProperty('--primary-secondary', accentColorMap[accentColor].secondary);
    root.style.setProperty('--primary-dark-bg', accentColorMap[accentColor].darkBg);
    root.style.setProperty('--color-primary', accentColorMap[accentColor].hex);
    root.setAttribute('data-accent', accentColor);
  }, [activeTheme, accentColor, darkBackgroundHue]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'auto' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, setTheme: setThemeState, toggleTheme,
      accentColor, setAccentColor: setAccentColorState,
      backgroundStyle, setBackgroundStyle: setBackgroundStyleState,
      darkBackgroundHue, setDarkBackgroundHue: setDarkBackgroundHueState,
      soundEnabled, setSoundEnabled: setSoundEnabledState,
      hapticsEnabled, setHapticsEnabled: setHapticsEnabledState
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
