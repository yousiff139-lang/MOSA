'use client';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!localStorage.getItem('pwa_prompt_dismissed')) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        setDeferredPrompt(null);
        setShowPrompt(false);
      });
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-in slide-in-from-bottom-10">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/icons/icon-192x192.png" alt="MOSA" className="w-10 h-10 rounded-xl" />
          <div>
            <h4 className="text-zinc-100 font-bold">ثبّت تطبيق MOSA</h4>
            <p className="text-xs text-zinc-400">للحصول على تجربة أفضل على جهازك</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleDismiss} className="text-zinc-400 hover:text-white px-3">لاحقاً</Button>
          <Button onClick={handleInstall} className="bg-blue-600 hover:bg-blue-500 px-4 rounded-xl">تثبيت</Button>
        </div>
      </div>
    </div>
  );
}
