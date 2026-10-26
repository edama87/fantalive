/** Server: giornata attiva (primo calcio d'inizio) e giornate chiuse (import FMS). */
import { getCurrentRound } from '@/data/calendar';
import { getServerClient } from '@/lib/db/supabase';
import { pickActiveRound, type ActiveRoundInfo } from '@/lib/active-round';
import type { Round } from '@/types';

async function firstKickoff(roundNumber: number): Promise<Date | null> {
  const { data, error } = await getServerClient()
    .from('serie_a_matches').select('kickoff_time')
    .eq('round_number', roundNumber).not('kickoff_time', 'is', null)
    .order('kickoff_time', { ascending: true }).limit(1);
  if (error || !data?.length) return null;
  const t = Date.parse(data[0].kickoff_time as string);
  return Number.isFinite(t) ? new Date(t) : null;
}

export async function getActiveRound(now: Date = new Date()): Promise<Round> {
  const candidate = getCurrentRound(now);
  if (candidate.number <= 1) return candidate;
  try {
    return pickActiveRound(now, await firstKickoff(candidate.number), candidate);
  } catch {
    return candidate;
  }
}

/** Giornate con un import voti FMS confermato. */
export async function getClosedRounds(): Promise<number[]> {
  const { data, error } = await getServerClient().from('official_vote_imports').select('round_number').eq('source', 'fms');
  if (error) return [];
  return [...new Set((data ?? []).map((r) => r.round_number as number))].sort((a, b) => a - b);
}

export async function isRoundClosed(round: number): Promise<boolean> {
  const { count, error } = await getServerClient()
    .from('official_vote_imports').select('round_number', { count: 'exact', head: true })
    .eq('round_number', round).eq('source', 'fms');
  return !error && (count ?? 0) > 0;
}

export async function getActiveRoundInfo(now: Date = new Date()): Promise<ActiveRoundInfo> {
  const [round, closedRounds] = await Promise.all([getActiveRound(now), getClosedRounds()]);
  return { round: round.number, closed: closedRounds.includes(round.number), closedRounds };
}

