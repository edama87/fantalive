'use client';

import { useEffect } from 'react';

/** Registra il service worker all'avvio: serve all'app installata per mostrare le notifiche. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }, []);
  return null;
}
