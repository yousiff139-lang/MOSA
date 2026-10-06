import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';

export interface GlassCardProps extends HTMLMotionProps<"div"> {
  variant?: 'default' | 'glow' | 'premium';
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-[24px] border',
          {
            'glass-panel': variant === 'default',
            'glass-panel glass-glow': variant === 'glow',
            'glass-panel-premium': variant === 'premium',
          },
          className
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        {...props}
      />
    );
  }
);
GlassCard.displayName = 'GlassCard';
