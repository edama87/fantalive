import { getPublicClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { fetchLineupsForRound } from '@/lib/lineups-db';
import { buildPlayerOwners, type PlayerOwner } from '@/lib/fanta-owners';

/** Formazioni della giornata + rose aperte, letture pubbliche. Null se non disponibili. */
export async function loadPlayerOwners(roundNumber: number): Promise<Map<string, PlayerOwner> | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = getPublicClient();
    const [lineups, { data: versions, error }] = await Promise.all([
      fetchLineupsForRound(roundNumber),
      sb.from('roster_versions').select('id, team_id, roster_players(player_id)').is('effective_until', null),
    ]);
    if (error) throw error;
    const rosters = (versions ?? []).map((v) => ({
      teamId: v.team_id as string,
      playerIds: ((v.roster_players ?? []) as Array<{ player_id: string }>).map((p) => p.player_id),
    }));
    return buildPlayerOwners(lineups, rosters);
  } catch (error) {
    console.warn('[owners] proprietari non disponibili:', error);
    return null;
  }
}
