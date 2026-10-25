import type { Player, PlayerRole } from '@/types';
import { serieATeamCode, type RoundFixture } from '@/lib/serie-a-fixtures';

export interface RecapPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  starter: boolean;
}

export interface RecapEntry {
  fixture: RoundFixture;
  home: RecapPlayer[];
  away: RecapPlayer[];
}

export interface RecapSideInput {
  player: Pick<Player, 'id' | 'name' | 'role' | 'realTeam'>;
  isStarter: boolean;
}

const ROLE_ORDER: Record<PlayerRole, number> = { P: 0, D: 1, C: 2, A: 3 };

function sortPlayers(list: RecapPlayer[]): RecapPlayer[] {
  return list.sort((a, b) => Number(b.starter) - Number(a.starter) || ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name));
}

/**
 * "Partite da seguire": le partite di Serie A della giornata in cui gioca almeno
 * un giocatore (titolare o panchina) di una delle due squadre, in ordine di calcio d'inizio.
 */
export function buildMatchRecap(
  fixtures: readonly RoundFixture[],
  home: readonly RecapSideInput[],
  away: readonly RecapSideInput[]
): RecapEntry[] {
  const byFixture = new Map<string, RecapEntry>();
  const codeToFixture = new Map<string, RoundFixture>();
  for (const f of fixtures) {
    codeToFixture.set(f.homeCode, f);
    codeToFixture.set(f.awayCode, f);
  }
  const add = (side: 'home' | 'away', inputs: readonly RecapSideInput[]) => {
    const seen = new Set<string>();
    for (const { player, isStarter } of inputs) {
      if (seen.has(player.id)) continue;
      seen.add(player.id);
      const code = serieATeamCode(player.realTeam);
      const fixture = code ? codeToFixture.get(code) : undefined;
      if (!fixture) continue;
      let entry = byFixture.get(fixture.matchId);
      if (!entry) byFixture.set(fixture.matchId, (entry = { fixture, home: [], away: [] }));
      entry[side].push({ id: player.id, name: player.name, role: player.role, starter: isStarter });
    }
  };
  add('home', home);
  add('away', away);
  const time = (f: RoundFixture) => (f.kickoffTime ? Date.parse(f.kickoffTime) : Number.MAX_SAFE_INTEGER);
  return [...byFixture.values()]
    .map((e) => ({ ...e, home: sortPlayers(e.home), away: sortPlayers(e.away) }))
    .sort((a, b) => time(a.fixture) - time(b.fixture) || a.fixture.homeCode.localeCompare(b.fixture.homeCode));
}

/**
 * Ordine di visualizzazione di "Partite da seguire": prima le partite in corso,
 * poi le prossime per calcio d'inizio (la prima riga è sempre la più vicina);
 * le finite a parte, in ordine di orario.
 */
export function splitRecapForDisplay(entries: readonly RecapEntry[]): { upcoming: RecapEntry[]; finished: RecapEntry[] } {
  const time = (e: RecapEntry) => (e.fixture.kickoffTime ? Date.parse(e.fixture.kickoffTime) : Number.MAX_SAFE_INTEGER);
  const isLive = (e: RecapEntry) => e.fixture.status === 'live' || e.fixture.status === 'halftime';
  const byTime = (a: RecapEntry, b: RecapEntry) => time(a) - time(b) || a.fixture.homeCode.localeCompare(b.fixture.homeCode);
  const upcoming = entries
    .filter((e) => e.fixture.status !== 'finished')
    .sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || byTime(a, b));
  const finished = entries.filter((e) => e.fixture.status === 'finished').sort(byTime);
  return { upcoming, finished };
}
