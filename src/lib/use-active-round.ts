'use client';

import { useEffect, useState } from 'react';
import { getCurrentRound } from '@/data/calendar';
import type { ActiveRoundInfo } from '@/lib/active-round';

async function fetchActiveRound(): Promise<ActiveRoundInfo | null> {
  try {
    const res = await fetch('/api/rounds/active', { cache: 'no-store' });
    return res.ok ? ((await res.json()) as ActiveRoundInfo) : null;
  } catch {
    return null;
  }
}

/**
 * Giornata attiva lato client: parte dalla data (calendario) e si allinea al
 * server (primo calcio d'inizio, giornate chiuse). `ready` = risposta arrivata.
 */
export function useActiveRound(): ActiveRoundInfo & { ready: boolean } {
  const [info, setInfo] = useState<ActiveRoundInfo & { ready: boolean }>(() => ({ round: getCurrentRound().number, closed: false, closedRounds: [], ready: false }));
  useEffect(() => {
    let alive = true;
    void fetchActiveRound().then((r) => { if (alive) setInfo(r ? { ...r, ready: true } : (s) => ({ ...s, ready: true })); });
    return () => { alive = false; };
  }, []);
  return info;
}
