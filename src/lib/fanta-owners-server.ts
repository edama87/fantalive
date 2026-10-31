import { getPublicClient, isSupabaseConfigured, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { fetchLineupsForRound, fetchPlayersByIds, playerIdsFromLineups } from '@/lib/lineups-db';
import { buildPlayerOwners, type PlayerOwner, type TeamReplacements } from '@/lib/fanta-owners';
import { processSubstitutions, withResolvedFormation } from '@/lib/scoring-engine';
import { getRoundPlayerState } from '@/lib/round-player-data';
import { teamStatusesFromFixtures } from '@/lib/serie-a-fixtures';
import { getPlayerById } from '@/data/teams';

/**
 * Formazioni della giornata + cambi automatici (come in sfida: solo titolari
 * s.v. certi) + rose aperte. Solo letture. Null se non disponibili.
 */
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
    const players = await fetchPlayersByIds(playerIdsFromLineups(lineups)).catch(() => ({}));
    const replacements: TeamReplacements = {};
    if (isSupabaseServerConfigured()) {
      try {
        const state = await getRoundPlayerState(roundNumber);
        const statuses = state.fixtures.length > 0 ? teamStatusesFromFixtures(state.fixtures) : undefined;
        for (const lineup of Object.values(lineups)) {
          replacements[lineup.teamId] = processSubstitutions(
            withResolvedFormation(lineup, players),
            state.playerData,
            5,
            players,
            statuses,
          ).replacements;
        }
      } catch (subError) {
        console.warn('[owners] cambi automatici non disponibili:', subError);
      }
    }
    const name = (id: string) => (players as Record<string, { name: string }>)[id]?.name ?? getPlayerById(id)?.name ?? id;
    return buildPlayerOwners(lineups, rosters, replacements, name);
  } catch (error) {
    console.warn('[owners] proprietari non disponibili:', error);
    return null;
  }
}
