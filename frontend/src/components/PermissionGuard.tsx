'use client';

import { usePermissions, Role } from '@/hooks/usePermissions';
import { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PermissionGuardProps {
  children: ReactNode;
  require?: Role;
  fallback?: ReactNode;
  showTooltip?: boolean;
}

export function PermissionGuard({ children, require, fallback = null, showTooltip = false }: PermissionGuardProps) {
  const { hasRole } = usePermissions();

  const isAllowed = require ? hasRole(require) : true;

  if (isAllowed) return <>{children}</>;

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="opacity-50 cursor-not-allowed pointer-events-none grayscale">
              {children}
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-red-900/90 text-red-100 border-red-500/50">
            <p>هذا الإجراء يتطلب صلاحية أعلى ({require})</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <>{fallback}</>;
}
