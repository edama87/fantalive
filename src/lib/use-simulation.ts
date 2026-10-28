'use client';

/** Toggle globale "Simula risultato" (localStorage + cookie per le pagine server). Default: spento. */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
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

/**
 * Giornata visualizzata chiusa/definitiva: la simulazione non si applica e il toggle
 * è disabilitato. La preferenza salvata resta intatta e torna attiva sulle giornate aperte.
 */
let viewedRoundClosed = false;
export function setViewedRoundClosed(closed: boolean): void {
  if (viewedRoundClosed === closed) return;
  viewedRoundClosed = closed;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}
export function isViewedRoundClosed(): boolean {
  return viewedRoundClosed;
}

/** Preferenza salvata + stato della giornata visualizzata. */
export function useSimulationState(): { saved: boolean; locked: boolean } {
  const saved = useSyncExternalStore(subscribe, read, () => false);
  const locked = useSyncExternalStore(subscribe, isViewedRoundClosed, () => false);
  return { saved, locked };
}

/** Simulazione effettiva: preferenza attiva e giornata non definitiva. */
export function effectiveSimulation(saved: boolean, locked: boolean): boolean {
  return saved && !locked;
}

export function useSimulation(): [boolean, (on: boolean) => void] {
  const { saved, locked } = useSimulationState();
  const set = useCallback((on: boolean) => {
    if (!isViewedRoundClosed()) setSimulation(on);
  }, []);
  return [effectiveSimulation(saved, locked), set];
}

/** Le pagine dichiarano se la giornata che mostrano è definitiva (reset all'uscita). */
export function useDeclareViewedRoundClosed(closed: boolean): void {
  useEffect(() => {
    setViewedRoundClosed(closed);
  }, [closed]);
  useEffect(() => () => setViewedRoundClosed(false), []);
}
