'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Power } from 'lucide-react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, className, size = 'md', disabled = false }: ToggleSwitchProps) {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  // Strict dimensional sizing
  const trackClass = isSm 
    ? 'w-12 h-6.5 p-0.5' 
    : isLg 
    ? 'w-16 h-9 p-1' 
    : 'w-14 h-7.5 p-0.75';

  const thumbSize = isSm 
    ? 'w-5 h-5' 
    : isLg 
    ? 'w-7 h-7' 
    : 'w-6 h-6';

  const iconSize = isSm ? 10 : isLg ? 14 : 12;

  return (
    <button
      type="button"
      disabled={disabled}
      dir="ltr"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      aria-checked={checked}
      role="switch"
      className={cn(
        'relative inline-flex items-center rounded-full transition-all duration-300 focus:outline-none select-none overflow-hidden shrink-0 shadow-inner',
        trackClass,
        checked
          ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-600 border border-cyan-300/40 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
          : 'bg-slate-950/90 border border-white/15 hover:border-white/25 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95',
        className
      )}
    >
      {/* Inner Track Glow when ON */}
      {checked && (
        <span className="absolute inset-0 bg-cyan-400/20 rounded-full blur-[2px] pointer-events-none" />
      )}

      {/* Perfectly Enclosed Sliding Thumb (Never overflows container) */}
      <div className={cn('w-full flex items-center', checked ? 'justify-end' : 'justify-start')}>
        <motion.div
          layout
          transition={{
            type: "spring",
            stiffness: 700,
            damping: 35
          }}
          className={cn(
            'rounded-full flex items-center justify-center shadow-md relative z-10 transition-colors',
            thumbSize,
            checked
              ? 'bg-white text-cyan-600 shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
              : 'bg-slate-700 text-slate-400 shadow-[0_2px_4px_rgba(0,0,0,0.4)]'
          )}
        >
          <Power
            size={iconSize}
            className={cn(
              'transition-colors',
              checked ? 'text-cyan-600 stroke-[3]' : 'text-slate-400 stroke-[2.5]'
            )}
          />
        </motion.div>
      </div>
    </button>
  );
}
