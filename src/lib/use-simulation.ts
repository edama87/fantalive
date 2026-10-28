'use client';

/** Toggle globale "Simula risultato" (localStorage + cookie per le pagine server). Default: spento. */
import { useCallback, useSyncExternalStore } from 'react';
import { SIMULATION_COOKIE, SIMULATION_STORAGE_KEY } from '@/lib/simulation';

const EVENT = 'fantalive-sim-change';

function read(): boolean {
  try {
    return window.localStorage.getItem(SIMULATION_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export function setSimulation(on: boolean): void {
  try {
    window.localStorage.setItem(SIMULATION_STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* storage non disponibile */
  }
  document.cookie = `${SIMULATION_COOKIE}=${on ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new Event(EVENT));
}

export function useSimulation(): [boolean, (on: boolean) => void] {
  const simulated = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((on: boolean) => setSimulation(on), []);
  return [simulated, set];
}
