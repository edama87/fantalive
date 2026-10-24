'use client';

import { useEffect } from 'react';
import { loadNotifySettings, NOTIFY_SETTINGS_EVENT } from '@/lib/notify-settings';
import { syncPush } from '@/lib/push-client';

/** All'avvio e a ogni cambio di impostazioni allinea l'iscrizione push sul server. */
export function PushSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void syncPush(loadNotifySettings()), 400); // raggruppa le modifiche rapide
    };
    run();
    window.addEventListener(NOTIFY_SETTINGS_EVENT, run);
    return () => { window.removeEventListener(NOTIFY_SETTINGS_EVENT, run); if (timer) clearTimeout(timer); };
  }, []);
  return null;
}
