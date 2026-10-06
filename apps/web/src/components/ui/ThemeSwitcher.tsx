import { motion } from 'framer-motion';
import { useTheme, AccentColor } from '@/context/ThemeContext';
import { Palette } from 'lucide-react';
import { useState } from 'react';

const themes: { id: AccentColor; label: string; color: string }[] = [
  { id: 'blue', label: 'Neon Blue', color: '#00f0ff' },
  { id: 'emerald', label: 'Emerald Green', color: '#10b981' },
  { id: 'purple', label: 'Deep Purple', color: '#b53cff' },
  { id: 'rose', label: 'Rose Red', color: '#f43f5e' },
  { id: 'orange', label: 'Sunset Orange', color: '#f97316' },
];

export function ThemeSwitcher() {
  const { accentColor, setAccentColor } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="تبديل المظهر"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
      >
        <Palette size={18} className="text-gray-400" />
      </button>

      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute left-0 mt-2 p-3 w-48 rounded-2xl glass-panel z-50 flex flex-col gap-2"
        >
          <div className="text-xs font-bold text-gray-400 mb-1 px-2">Accent Color</div>
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setAccentColor(t.id);
                setIsOpen(false);
              }}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm transition-colors ${
                accentColor === t.id ? 'bg-white/10 text-white font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color, boxShadow: `0 0 10px ${t.color}` }} />
              {t.label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
