"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdvancedPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings');
  }, [router]);

  return (
    <div className="p-10 text-center text-slate-400 font-bold">
      جاري إعادة التوجيه إلى الإعدادات...
    </div>
  );
}
