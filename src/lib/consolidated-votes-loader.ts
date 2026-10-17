import { canonicalTeamCode } from '@/lib/fantacalcio-it';
import { getPublicClient, isSupabaseConfigured } from '@/lib/db/supabase';
import type { ConsolidatedVoteEntry } from '@/lib/pianetafanta-url';

/**
 * Voti consolidati (import pianetafanta) di una partita di Serie A, o null se
 * la partita non è stata ancora consolidata.
 */
export async function loadConsolidatedMatchVotes(
  serieAMatchday: number,
  homeTeam: string,
  awayTeam: string
): Promise<ConsolidatedVoteEntry[] | null> {
  if (!isSupabaseConfigured()) return null;
  const key = `${canonicalTeamCode(homeTeam) ?? homeTeam}-${canonicalTeamCode(awayTeam) ?? awayTeam}`;
  try {
    const { data, error } = await getPublicClient()
      .from('official_vote_imports')
      .select('players')
      .eq('serie_a_matchday', serieAMatchday)
      .eq('source', 'pianetafanta')
      .eq('match_key', key)
      .order('imported_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data || !Array.isArray(data.players)) return null;
    return (data.players as ConsolidatedVoteEntry[]).map((p) => ({
      name: p.name,
      team: p.team,
      votes: p.votes,
      average: p.average,
      minutesPlayed: typeof p.minutesPlayed === 'number' ? p.minutesPlayed : null,
    }));
  } catch (error) {
    console.warn('[Serie A] voti consolidati non disponibili:', error);
    return null;
  }
}
