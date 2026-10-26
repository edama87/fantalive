import { describe, expect, it } from 'vitest';
import type { Lineup, Player, PlayerMatchData, PlayerRole } from '@/types';
import { bestLineup, buildDebrief, suggestionToLineup, withOptimalBench, type DebriefInput } from '@/lib/lineup-debrief';
import { isMissingTableError } from '@/lib/lineup-debrief-server';
import type { LineupSuggestion, SuggestionPlayer } from '@/lib/lineup-suggestions';

function mk(team: string, role: PlayerRole, n: number): Player {
  return { id: `${team}-${role}${n}`, name: `${team.toUpperCase()}${role}${n} Nome`, role, teamId: team, realTeam: 'XXX' };
}
const roles: [PlayerRole, number][] = [['P', 2], ['D', 6], ['C', 6], ['A', 4]];
const roster = (team: string) => roles.flatMap(([r, n]) => Array.from({ length: n }, (_, i) => mk(team, r, i + 1)));
const ours = roster('ap');
const opp = roster('rp');
const players = Object.fromEntries([...ours, ...opp].map((p) => [p.id, p]));

function data(id: string, vote: number | null, extra: Partial<PlayerMatchData> = {}): PlayerMatchData {
  return { playerId: id, estimatedVote: vote, minutesPlayed: vote === null ? 0 : 90, isPlaying: false, events: [], voteSource: 'consolidated', paperCount: 3, ...extra };
}
const votes = new Map<string, PlayerMatchData>();
for (const p of [...ours, ...opp]) votes.set(p.id, data(p.id, 6));
votes.set('ap-D1', data('ap-D1', null)); // titolare s.v.
votes.set('ap-D5', data('ap-D5', 5)); // primo in panchina, peggiore
votes.set('ap-D6', data('ap-D6', 7.5)); // secondo in panchina, migliore
votes.set('ap-A4', data('ap-A4', 6.5, { events: [{ type: 'goal', minute: 10 } as never] })); // in panchina, segna

const lineupOf = (team: string, ids: string[], bench: string[], formation: string): Lineup => ({
  teamId: team, roundNumber: 2, formation,
  starters: ids.map((playerId, i) => ({ playerId, position: i + 1 })),
  bench: bench.map((playerId, i) => ({ playerId, position: i + 1 })),
});
const XI = (t: string) => [`${t}-P1`, `${t}-D1`, `${t}-D2`, `${t}-D3`, `${t}-D4`, `${t}-C1`, `${t}-C2`, `${t}-C3`, `${t}-C4`, `${t}-A1`, `${t}-A2`];
const BENCH = (t: string) => [`${t}-P2`, `${t}-D5`, `${t}-D6`, `${t}-C5`, `${t}-C6`, `${t}-A3`, `${t}-A4`];

const sp = (id: string): SuggestionPlayer => ({ playerId: id, name: players[id].name, role: players[id].role, realTeam: null, fixture: null, homeAway: null, startPct: null, note: null, matched: true });
const suggestion: LineupSuggestion = {
  id: '00000000-0000-4000-8000-000000000001', teamId: 'ap', round: 2, variant: 'principale', status: 'proposta', formation: '4-4-2',
  opponentTeamId: 'rp', starters: XI('ap').map(sp), bench: BENCH('ap').map(sp), rationale: null, alternatives: [], expectedPoints: null,
  sources: [], createdAt: '', updatedAt: '',
};

const input = (over: Partial<DebriefInput> = {}): DebriefInput => ({
  suggestion, round: 2, isHome: true, opponentTeamId: 'rp',
  actualLineup: lineupOf('ap', XI('ap'), BENCH('ap'), '4-4-2'),
  opponentLineup: lineupOf('rp', XI('rp'), BENCH('rp'), '4-4-2'),
  roster: ours, players, playerData: votes, now: new Date('2026-10-20T10:00:00Z'), ...over,
});

describe('lineup debrief', () => {
  it('converte il suggerimento in formazione mantenendo l\'ordine della panchina', () => {
    const l = suggestionToLineup(suggestion, 2);
    expect(l.starters).toHaveLength(11);
    expect(l.bench.map((b) => b.playerId)).toEqual(BENCH('ap'));
  });

  it('calcola i tre scenari col motore completo', () => {
    const d = buildDebrief(input());
    expect(d.scenarios.suggested && d.scenarios.actual && d.scenarios.best).toBeTruthy();
    const s = d.scenarios.suggested!;
    // D1 s.v. -> entra D5 (primo difensore in panchina)
    expect(s.bench.find((b) => b.id === 'ap-D5')?.replaces).toBe('ap-D1');
    expect(s.modifiers.home).toBe(2);
    expect(d.scenarios.best!.total).toBeGreaterThanOrEqual(s.total);
    expect(d.consolidated).toBe(true);
  });

  it('segnala s.v., ordine panchina, scelte sbagliate e punti persi', () => {
    const d = buildDebrief(input());
    const kinds = d.findings.filter((f) => f.scenario === 'suggested').map((f) => f.kind);
    expect(kinds).toContain('sv');
    expect(kinds).toContain('bench_order');
    expect(kinds).toContain('wrong_pick');
    const bench = d.findings.find((f) => f.kind === 'bench_order' && f.scenario === 'suggested');
    expect(bench?.points).toBeCloseTo(2.5);
    expect(d.findings.some((f) => f.kind === 'points_lost' && f.scenario === 'suggested')).toBe(true);
  });

  it('la migliore usa il panchinaro che ha segnato', () => {
    const best = bestLineup(input())!;
    expect(best.starters.map((s) => s.playerId)).toContain('ap-A4');
    expect(best.starters.map((s) => s.playerId)).toContain('ap-D6');
    expect(best.starters.map((s) => s.playerId)).not.toContain('ap-D1');
  });

  it('riordina la panchina per fantavoto', () => {
    const l = withOptimalBench(input(), lineupOf('ap', XI('ap'), BENCH('ap'), '4-4-2'));
    expect(l.bench.indexOf(l.bench.find((b) => b.playerId === 'ap-D6')!)).toBeLessThan(l.bench.indexOf(l.bench.find((b) => b.playerId === 'ap-D5')!));
  });

  it('avvisa se i voti non sono consolidati ma genera comunque', () => {
    const live = new Map(votes);
    live.set('ap-C1', data('ap-C1', 6, { voteSource: 'live' }));
    live.set('rp-C1', data('rp-C1', 6, { paperCount: 2 }));
    const d = buildDebrief(input({ playerData: live, unfinishedFixtures: ['Roma-Lazio'] }));
    expect(d.consolidated).toBe(false);
    expect(d.warnings).toHaveLength(3);
    expect(d.scenarios.suggested).toBeTruthy();
  });

  it('senza formazione schierata genera consigliata e migliore', () => {
    const d = buildDebrief(input({ actualLineup: null }));
    expect(d.scenarios.actual).toBeUndefined();
    expect(d.findings.some((f) => f.kind === 'info' && f.scenario === 'actual')).toBe(true);
  });

  it('riconosce la tabella mancante', () => {
    expect(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.lineup_debriefs'" })).toBe(true);
    expect(isMissingTableError({ code: '23505', message: 'duplicate' })).toBe(false);
  });
});
