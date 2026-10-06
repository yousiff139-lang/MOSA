export type Theme = 'dark' | 'light';
export type ColorTheme = 'zinc' | 'slate' | 'stone' | 'gray';

export function setThemeMode(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('mosa-theme', theme);
}

export function getThemeMode(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('mosa-theme') as Theme;
  return saved || 'dark';
}

export function setColorTheme(color: ColorTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('theme-zinc', 'theme-slate', 'theme-stone', 'theme-gray');
  root.classList.add(`theme-${color}`);
  localStorage.setItem('mosa-color', color);
}

export function getColorTheme(): ColorTheme {
  if (typeof window === 'undefined') return 'zinc';
  const saved = localStorage.getItem('mosa-color') as ColorTheme;
  return saved || 'zinc';
}

export function initTheme() {
  setThemeMode(getThemeMode());
  setColorTheme(getColorTheme());
}
