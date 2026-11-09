/**
 * Calcolo lato server delle sfide di una giornata (voti + formazioni dal DB),
 * lo stesso usato dalla classifica e dalle pagine live.
 */
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { FantasyMatchResult, PlayerMatchData } from '@/types';
import { getRoundByNumber } from '@/data/calendar';
import { calculateAllMatches, convertProviderDataToPlayerMatchData, inferMatchStatuses } from '@/lib/live-data';
import { shouldUseMockLiveData } from '@/lib/live-source';
import { getRoundPlayerState } from '@/lib/round-player-data';
import { teamStatusesFromFixtures, type RoundFixture } from '@/lib/serie-a-fixtures';
import { createLineupProviderFromMap, fetchLineupsForRound, fetchPlayersByIds, playerIdsFromLineups } from '@/lib/lineups-db';
import { createMockProvider } from '@/providers/mock-provider';

type RoundMatchesBundle = { matches: FantasyMatchResult[]; isLive: boolean; closed: boolean };

/** Cache di processo: navigazioni successive / standings multi-round senza rifare il DB. */
const memoryCache = new Map<string, { expires: number; value: RoundMatchesBundle }>();

function memKey(roundNumber: number, simulate: boolean) {
  return `${roundNumber}:${simulate ? 'sim' : 'real'}`;
}

function getMem(roundNumber: number, simulate: boolean): RoundMatchesBundle | null {
  const hit = memoryCache.get(memKey(roundNumber, simulate));
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    memoryCache.delete(memKey(roundNumber, simulate));
    return null;
  }
  return hit.value;
}

function setMem(roundNumber: number, simulate: boolean, value: RoundMatchesBundle) {
  // Chiusa: 1h. Aperta/live: 15s.
  const ttlMs = value.closed ? 60 * 60 * 1000 : 15_000;
  memoryCache.set(memKey(roundNumber, simulate), { expires: Date.now() + ttlMs, value });
}

async function computeRoundMatchesImpl(
  roundNumber: number,
  opts: { transformPlayerData?: (data: Map<string, PlayerMatchData>) => Map<string, PlayerMatchData>; simulate?: boolean } = {}
): Promise<RoundMatchesBundle> {
  const round = getRoundByNumber(roundNumber);
  if (!round) return { matches: [], isLive: false, closed: false };
  let closed = false;
  const lineupsPromise = fetchLineupsForRound(roundNumber).catch(() => ({}));

  let playerDataMap: Map<string, PlayerMatchData>;
  let isLive: boolean;
  let fixtures: RoundFixture[] = [];
  let playersPromise: Promise<Record<string, import('@/types').Player>> | null = null;

  // Avvia i giocatori appena le formazioni sono pronte, in parallelo allo state.
  const lineupsThenPlayers = lineupsPromise.then((lineups) => {
    playersPromise = fetchPlayersByIds(playerIdsFromLineups(lineups)).catch(() => ({}));
    return lineups;
  });

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
    closed = state.closed;
    fixtures = state.fixtures;
  }

  if (opts.transformPlayerData) playerDataMap = opts.transformPlayerData(playerDataMap);
  const lineups = await lineupsThenPlayers;
  const players = await (playersPromise ?? fetchPlayersByIds(playerIdsFromLineups(lineups)).catch(() => ({})));
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
    { simulate: opts.simulate && !closed },
  );
  // Giornata chiusa (import FMS): tutte le sfide sono definitive.
  return { matches: closed ? matches.map((m) => ({ ...m, status: 'finished' as const })) : matches, isLive, closed };
}

async function computeAndStore(
  roundNumber: number,
  simulate: boolean,
): Promise<RoundMatchesBundle> {
  const hit = getMem(roundNumber, simulate);
  if (hit) return hit;
  const value = await computeRoundMatchesImpl(roundNumber, { simulate });
  setMem(roundNumber, simulate, value);
  return value;
}

/**
 * Calcolo con cache: memoria di processo + React cache (stessa request) +
 * unstable_cache (cross-request Next, 15s; memoria 1h se chiusa / 15s se aperta).
 * transformPlayerData bypassa la cache persistente.
 */
export async function computeRoundMatches(
  roundNumber: number,
  opts: { transformPlayerData?: (data: Map<string, PlayerMatchData>) => Map<string, PlayerMatchData>; simulate?: boolean } = {},
): Promise<RoundMatchesBundle> {
  if (opts.transformPlayerData) {
    return computeRoundMatchesImpl(roundNumber, opts);
  }
  return cachedRoundMatches(roundNumber, Boolean(opts.simulate));
}

const cachedRoundMatches = cache(async (roundNumber: number, simulate: boolean) => {
  const mem = getMem(roundNumber, simulate);
  if (mem) return mem;
  try {
    // Prima compute per sapere se closed e scegliere revalidate; poi memorizziamo.
    // unstable_cache wrappa la funzione: usiamo TTL lunga e mem cache sopra.
    const value = await unstable_cache(
      () => computeAndStore(roundNumber, simulate),
      ['round-matches-v2', String(roundNumber), simulate ? 'sim' : 'real'],
      { revalidate: 15, tags: [`round-matches-${roundNumber}`] },
    )();
    setMem(roundNumber, simulate, value);
    return value;
  } catch {
    // Fuori dal request Next (script/tsx) non c'è incrementalCache.
    return computeAndStore(roundNumber, simulate);
  }
});
