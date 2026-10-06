"use client";

import { ActivityLog } from '@/components/ActivityLog';
import { useSmartHome } from '@/hooks/useSmartHome';

export default function LogsPage() {
  const { activityLogs } = useSmartHome();
  return (
    <div className="p-6 md:p-10 pb-28 md:pb-10 h-full relative">
      <ActivityLog logs={activityLogs} />
    </div>
  );
}
