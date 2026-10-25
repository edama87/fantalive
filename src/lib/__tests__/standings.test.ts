import { describe, expect, it } from 'vitest';
import type { FantasyMatchResult } from '@/types';
import { accumulateStandings, lastPlayedRound, parseGiornata } from '@/lib/standings';

const ps = [{}] as unknown as FantasyMatchResult['homePlayerScores'];
function m(h: string, a: string, hg: number, ag: number, ht: number, at: number, status: FantasyMatchResult['status'] = 'finished', lineups = true): FantasyMatchResult {
  return {
    homeTeamId: h, awayTeamId: a, homeGoals: hg, awayGoals: ag, homeTotal: ht, awayTotal: at, status,
    homePlayerScores: lineups ? ps : [], awayPlayerScores: lineups ? ps : [],
  } as unknown as FantasyMatchResult;
}

describe('accumulateStandings', () => {
  it('somma le giornate con 3/1/0 punti, gol e fantapunti', () => {
    const s = accumulateStandings([
      { round: 1, matches: [m('dc', 'ap', 5, 0, 84.5, 60), m('rp', 'sf', 4, 0, 82, 62)] },
      { round: 2, matches: [m('dc', 'rp', 1, 1, 68, 67.5), m('ap', 'sf', 2, 0, 72, 63)] },
    ]);
    const dc = s.find((e) => e.teamId === 'dc')!;
    expect(dc).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 6, goalsAgainst: 1, points: 4, fantaTotal: 152.5 });
    expect(s.find((e) => e.teamId === 'sf')).toMatchObject({ played: 2, lost: 2, goalsAgainst: 6, points: 0 });
    expect(s[0].teamId).toBe('dc'); // 4 pt, più FP di rp
    expect(s[1].teamId).toBe('rp');
  });

  it('ignora sfide senza formazioni o non iniziate', () => {
    const s = accumulateStandings([
      { round: 1, matches: [m('dc', 'ap', 5, 0, 84.5, 60)] },
      { round: 2, matches: [m('dc', 'ap', 0, 0, 0, 0, 'scheduled', false), m('rp', 'sf', 0, 0, 0, 0, 'finished', false)] },
    ]);
    expect(s.find((e) => e.teamId === 'dc')!.played).toBe(1);
    expect(s.find((e) => e.teamId === 'rp')!.played).toBe(0);
    expect(lastPlayedRound([{ round: 1, matches: [m('dc', 'ap', 1, 0, 70, 60)] }, { round: 2, matches: [m('dc', 'ap', 0, 0, 0, 0, 'scheduled', false)] }])).toBe(1);
  });

  it('segna live le squadre della giornata in corso', () => {
    const s = accumulateStandings([{ round: 1, matches: [m('dc', 'ap', 1, 0, 70, 60, 'live')] }]);
    expect(s.find((e) => e.teamId === 'dc')!.live).toMatchObject({ opponentId: 'ap', goalsFor: 1 });
  });
});

describe('parseGiornata', () => {
  it('accetta solo interi nell’intervallo', () => {
    expect(parseGiornata('3', 27)).toBe(3);
    expect(parseGiornata('0', 27)).toBeNull();
    expect(parseGiornata('abc', 27)).toBeNull();
    expect(parseGiornata(undefined, 27)).toBeNull();
    expect(parseGiornata('99', 27)).toBeNull();
  });
});

describe('withPositionChange', () => {
  const e = (teamId: string) => ({ teamId, teamName: teamId, played: 1, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, fantaTotal: 0 });
  it('posizioni guadagnate, perse e invariate rispetto alla giornata precedente', async () => {
    const { withPositionChange } = await import('@/lib/standings');
    const out = withPositionChange([e('b'), e('a'), e('c')], [e('a'), e('b'), e('c')]);
    expect(out.map((x) => x.positionChange)).toEqual([1, -1, 0]);
  });
  it('giornata 1: nessun confronto', async () => {
    const { withPositionChange } = await import('@/lib/standings');
    expect(withPositionChange([e('a')], null)[0].positionChange).toBeUndefined();
  });
});
