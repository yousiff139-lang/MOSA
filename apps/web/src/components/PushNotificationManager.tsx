'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationManager() {
  const { t } = useTranslation();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/custom-sw.js').then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) {
            setIsSubscribed(true);
            setSubscription(sub);
          }
        }).catch(() => {});
      }).catch(err => {
        console.warn('ServiceWorker registration skipped (untrusted SSL or local dev):', err?.message);
      });
    }
  }, []);

  const subscribeButtonOnClick = async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      
      const res = await fetch('/api/push/vapidPublicKey');
      const { publicKey } = await res.json();
      
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      
      await fetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(sub),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mosa_token')}`
        }
      });
      
      setSubscription(sub);
      setIsSubscribed(true);
    } catch (e) {
      console.error('Failed to subscribe to push notifications', e);
    }
  };

  if (!isSubscribed) {
    return (
      <button onClick={subscribeButtonOnClick} className="flex items-center justify-center gap-2 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors">
        <Bell className="w-4 h-4" />
        تفعيل إشعارات الهاتف
      </button>
    );
  }

  return (
    <button className="flex items-center justify-center gap-2 px-4 py-2 border border-green-500/30 text-green-500 rounded-lg bg-green-500/10">
      <Bell className="w-4 h-4" />
      الإشعارات مفعلة
    </button>
  );
}
