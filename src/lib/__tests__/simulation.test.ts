import { describe, it, expect } from 'vitest';
import { simulatePlayerData, SIMULATED_VOTE } from '@/lib/simulation';
import { calculateAllMatches } from '@/lib/live-data';
import type { Lineup, PlayerMatchData } from '@/types';

const lineup: Lineup = {
  teamId: 't', roundNumber: 3, formation: '4-4-2',
  starters: [{ playerId: 'a', position: 1 }, { playerId: 'b', position: 2 }, { playerId: 'c', position: 3 }, { playerId: 'd', position: 4 }],
  bench: [{ playerId: 'e', position: 1 }],
} as unknown as Lineup;
const players = {
  a: { id: 'a', name: 'A', role: 'D', teamId: 't', realTeam: 'MIL' },
  b: { id: 'b', name: 'B', role: 'D', teamId: 't', realTeam: 'TOR' },
  c: { id: 'c', name: 'C', role: 'C', teamId: 't', realTeam: 'INT' },
  d: { id: 'd', name: 'D', role: 'A', teamId: 't', realTeam: 'MIL' },
  e: { id: 'e', name: 'E', role: 'D', teamId: 't', realTeam: 'MIL' },
} as const;
const statuses = new Map([['MIL', 'scheduled'], ['TOR', 'finished'], ['INT', 'live']] as const);

describe('simulatePlayerData', () => {
  it("6 d'ufficio solo a chi deve ancora giocare, senza toccare voti reali/in campo/finiti", () => {
    const real = new Map<string, PlayerMatchData>([
      ['d', { playerId: 'd', estimatedVote: 7, minutesPlayed: 0, isPlaying: false, events: [] }],
    ]);
    const out = simulatePlayerData(real, [lineup], players as never, statuses);
    expect(out.get('a')).toMatchObject({ estimatedVote: SIMULATED_VOTE, simulated: true, events: [] });
    expect(out.get('e')?.simulated).toBe(true);
    expect(out.has('b')).toBe(false); // finita senza voto: s.v. resta
    expect(out.has('c')).toBe(false); // in corso: niente simulazione
    expect(out.get('d')).toMatchObject({ estimatedVote: 7 });
    expect(out.get('d')?.simulated).toBeUndefined();
    expect(real.has('a')).toBe(false); // input non modificato
  });
  it('senza stato partite (giornata non iniziata) simula tutti i senza voto', () => {
    const out = simulatePlayerData(new Map(), [lineup], players as never, undefined);
    expect([...out.values()].every((p) => p.simulated && p.estimatedVote === 6)).toBe(true);
  });
});

describe('calculateAllMatches con simulazione', () => {
  it('giornata non iniziata: tutti i titolari 6*, totali e risultato calcolati; reale resta vuoto', () => {
    const real = calculateAllMatches(3, new Map());
    const sim = calculateAllMatches(3, new Map(), undefined, undefined, undefined, undefined, { simulate: true });
    expect(sim.length).toBe(real.length);
    const m = sim[0];
    const starters = m.homePlayerScores.filter((p) => p.isStarter && !p.isUnusedBench);
    expect(starters.length).toBe(11);
    expect(starters.every((p) => p.simulated && p.fantavoto === 6)).toBe(true);
    expect(m.homeTotal).toBeGreaterThan(real[0].homeTotal);
    expect(m.homeTotal).toBeGreaterThanOrEqual(66);
  });
});

import { isCountable } from '@/lib/standings';
describe('classifica simulata', () => {
  it('le sfide non iniziate contano in simulazione, non in reale', () => {
    expect(calculateAllMatches(3, new Map()).some(isCountable)).toBe(false);
    expect(calculateAllMatches(3, new Map(), undefined, undefined, undefined, undefined, { simulate: true }).every(isCountable)).toBe(true);
  });
});
