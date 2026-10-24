'use client';

/** Registra il service worker (una volta) e lo restituisce, o null se non supportato. */
export async function getNotifyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    await navigator.serviceWorker.register('/sw.js');
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function showAppNotification(title: string, options: NotificationOptions & { url?: string } = {}): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  const { url, ...rest } = options;
  const reg = await getNotifyRegistration();
  const opts: NotificationOptions = { lang: 'it', ...rest, data: { url: url ?? '/' } };
  if (reg) {
    await reg.showNotification(title, opts);
    return true;
  }
  new Notification(title, opts);
  return true;
}
