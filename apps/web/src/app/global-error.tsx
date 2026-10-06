"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js Global Error:", error);
    
    // Auto-recover from chunk loading errors caused by server updates / rebuilds
    const isChunkError = 
      error?.name === 'ChunkLoadError' || 
      error?.message?.includes('Loading chunk') || 
      error?.message?.includes('ChunkLoadError');

    if (isChunkError && typeof window !== 'undefined') {
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();
      // If not reloaded in the last 10 seconds, auto-reload to fetch new assets
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('last_chunk_reload', String(now));
        window.location.reload();
      }
    }
  }, [error]);

  const isChunkError = 
    error?.name === 'ChunkLoadError' || 
    error?.message?.includes('Loading chunk') || 
    error?.message?.includes('ChunkLoadError');

  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#070d1a] text-white">
        <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 w-full">
          <div className="bg-[#0b1329] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 max-w-xl w-full flex flex-col gap-5 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 text-2xl font-bold">
              🔄
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-white">
                {isChunkError ? "تم تحديث المنظومة بنجاح" : "حدث تحديث في النظام"}
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                {isChunkError 
                  ? "تم نشر ملفات وتحسينات جديدة للمنظومة، يرجى النقر على زر التحديث لتحميل أحدث نسخة."
                  : "يرجى إعادة تحميل الصفحة لتحديث الجلسة."}
              </p>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-xl font-bold text-xs transition-all shadow-lg cursor-pointer"
                onClick={() => {
                  window.location.reload();
                }}
              >
                تحديث الصفحة الآن 🔄
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
