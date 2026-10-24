/** Dati della giornata per il job push (server): voti/eventi, formazioni, partite. */
import { getRoundByNumber } from '@/data/calendar';
import { getRoundPlayerState } from '@/lib/round-player-data';
import { fetchLineupsForRound, fetchPlayersByIds, playerIdsFromLineups } from '@/lib/lineups-db';
import type { RoundSnapshot } from './plan';

export async function loadRoundSnapshot(roundNumber: number): Promise<RoundSnapshot> {
  const [state, lineups] = await Promise.all([getRoundPlayerState(roundNumber), fetchLineupsForRound(roundNumber)]);
  const players = await fetchPlayersByIds(playerIdsFromLineups(lineups));
  return {
    round: roundNumber,
    pairings: getRoundByNumber(roundNumber)?.pairings ?? [],
    lineups,
    players,
    playerData: state.playerData,
    fixtures: state.fixtures,
  };
}
