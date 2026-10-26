/**
 * Calcolo lato server delle sfide di una giornata (voti + formazioni dal DB),
 * lo stesso usato dalla classifica e dalle pagine live.
 */
import type { FantasyMatchResult, PlayerMatchData } from '@/types';
import { getRoundByNumber } from '@/data/calendar';
import { calculateAllMatches, convertProviderDataToPlayerMatchData, inferMatchStatuses } from '@/lib/live-data';
import { shouldUseMockLiveData } from '@/lib/live-source';
import { getRoundPlayerState } from '@/lib/round-player-data';
import { teamStatusesFromFixtures, type RoundFixture } from '@/lib/serie-a-fixtures';
import { createLineupProviderFromMap, fetchLineupsForRound, fetchPlayersByIds, playerIdsFromLineups } from '@/lib/lineups-db';
import { createMockProvider } from '@/providers/mock-provider';

export async function computeRoundMatches(
  roundNumber: number,
  opts: { transformPlayerData?: (data: Map<string, PlayerMatchData>) => Map<string, PlayerMatchData> } = {}
): Promise<{ matches: FantasyMatchResult[]; isLive: boolean }> {
  const round = getRoundByNumber(roundNumber);
  if (!round) return { matches: [], isLive: false };
  const lineupsPromise = fetchLineupsForRound(roundNumber).catch(() => ({}));

  let playerDataMap: Map<string, PlayerMatchData>;
  let isLive: boolean;
  let fixtures: RoundFixture[] = [];
  if (shouldUseMockLiveData()) {
    const provider = createMockProvider(42);
    await provider.initialize();
    const data = await provider.fetchLiveData(round.serieAMatchday);
    playerDataMap = convertProviderDataToPlayerMatchData(data);
    isLive = data.isLive;
    provider.dispose();
  } else {
    const state = await getRoundPlayerState(roundNumber);
    playerDataMap = state.playerData;
    isLive = state.isLive;
    fixtures = state.fixtures;
  }

  if (opts.transformPlayerData) playerDataMap = opts.transformPlayerData(playerDataMap);
  const lineups = await lineupsPromise;
  const players = await fetchPlayersByIds(playerIdsFromLineups(lineups)).catch(() => ({}));
  const matchStatuses = shouldUseMockLiveData()
    ? new Map(round.pairings.map((p) => [`${p.homeTeamId}-${p.awayTeamId}`, isLive ? 'live' as const : 'scheduled' as const]))
    : fixtures.length > 0
      ? undefined
      : inferMatchStatuses(round.pairings, isLive, playerDataMap);

  const matches = calculateAllMatches(
    roundNumber,
    playerDataMap,
    matchStatuses,
    createLineupProviderFromMap(lineups),
    players,
    fixtures.length > 0 ? teamStatusesFromFixtures(fixtures) : undefined,
  );
  return { matches, isLive };
}
