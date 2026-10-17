'use client';

import { useSyncExternalStore } from 'react';
import { MY_TEAM_COOKIE, MY_TEAM_EVENT, parseMyTeam, readCookie } from '@/lib/my-team';

function subscribe(callback: () => void) {
  window.addEventListener(MY_TEAM_EVENT, callback);
  window.addEventListener('focus', callback);
  return () => {
    window.removeEventListener(MY_TEAM_EVENT, callback);
    window.removeEventListener('focus', callback);
  };
}

function getSnapshot(): string | null {
  return parseMyTeam(readCookie(document.cookie, MY_TEAM_COOKIE));
}

/** Squadra scelta su questo dispositivo (null = "Salta" / vista neutra). */
export function useMyTeamId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
