/**
 * "Simula risultato": voto d'ufficio 6 (fantavoto 6, nessun bonus/malus) a chi
 * deve ancora giocare. Solo calcolo lato app, mai scritto nel DB.
 * Non tocca chi è in campo, chi ha finito o chi ha già un voto reale.
 */
import type { Lineup, PlayerMatchData } from '@/types';
import type { PlayerDirectory, TeamMatchStatuses } from '@/lib/scoring-engine';
import { getPlayerById } from '@/data/teams';

export const SIMULATED_VOTE = 6;
export const SIMULATION_STORAGE_KEY = 'fantalive_sim';
export const SIMULATION_COOKIE = 'fantalive_sim';
export const SIMULATION_LEGEND = "* voto d'ufficio 6 (simulazione) per chi deve ancora giocare";

/** La partita della squadra reale del giocatore non è ancora iniziata. */
function notStarted(realTeam: string | undefined, teamStatuses?: TeamMatchStatuses): boolean {
  if (!teamStatuses || teamStatuses.size === 0) return true;
  if (!realTeam) return false;
  return teamStatuses.get(realTeam.toUpperCase()) === 'scheduled';
}

export function simulatePlayerData(
  playerDataMap: Map<string, PlayerMatchData>,
  lineups: readonly Lineup[],
  playersById?: PlayerDirectory,
  teamStatuses?: TeamMatchStatuses
): Map<string, PlayerMatchData> {
  const out = new Map(playerDataMap);
  for (const lineup of lineups) {
    for (const slot of [...lineup.starters, ...lineup.bench]) {
      const existing = out.get(slot.playerId);
      if (existing && (existing.estimatedVote != null || existing.isPlaying || existing.minutesPlayed > 0 || existing.events.length > 0)) continue;
      const player = playersById?.[slot.playerId] ?? getPlayerById(slot.playerId);
      if (!player || !notStarted(player.realTeam, teamStatuses)) continue;
      out.set(slot.playerId, {
        playerId: slot.playerId,
        estimatedVote: SIMULATED_VOTE,
        minutesPlayed: 0,
        isPlaying: false,
        events: [],
        simulated: true,
      });
    }
  }
  return out;
}
