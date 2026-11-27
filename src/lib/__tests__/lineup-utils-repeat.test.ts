import { describe, expect, it } from 'vitest';
import { adaptLineupToRoster, lineupsHaveSamePlayers } from '@/lib/lineup-utils';
import type { Lineup, PlayerRole } from '@/types';

const lineup = (
  starters: string[],
  bench: string[],
  extras: Partial<Lineup> = {},
): Lineup => ({
  teamId: 'sf',
  roundNumber: 6,
  formation: '3-4-3',
  starters: starters.map((playerId, position) => ({ playerId, position })),
  bench: bench.map((playerId, position) => ({ playerId, position })),
  ...extras,
});

describe('lineupsHaveSamePlayers', () => {
  it('matches the same starters and bench in order', () => {
    const a = lineup(['p', 'd1', 'c1'], ['b1', 'b2']);
    const b = lineup(['p', 'd1', 'c1'], ['b1', 'b2']);
    expect(lineupsHaveSamePlayers(a, b)).toBe(true);
  });

  it('detects a changed starter or bench', () => {
    const a = lineup(['p', 'd1', 'c1'], ['b1', 'b2']);
    expect(lineupsHaveSamePlayers(a, lineup(['p', 'd2', 'c1'], ['b1', 'b2']))).toBe(false);
    expect(lineupsHaveSamePlayers(a, lineup(['p', 'd1', 'c1'], ['b1']))).toBe(false);
  });
});

describe('adaptLineupToRoster', () => {
  const roles: Record<string, { role: PlayerRole }> = {
    p: { role: 'P' },
    d1: { role: 'D' },
    d2: { role: 'D' },
    c1: { role: 'C' },
    cNew: { role: 'C' },
    b1: { role: 'C' },
    b2: { role: 'A' },
    a1: { role: 'A' },
  };

  it('copies the previous XI when the roster is unchanged and marks it as not submitted', () => {
    const previous = lineup(['p', 'd1', 'c1', 'a1'], ['b1', 'b2']);
    const roster = new Set(['p', 'd1', 'c1', 'a1', 'b1', 'b2']);
    const adapted = adaptLineupToRoster(previous, roster, {
      playersById: roles,
      roundNumber: 7,
      teamId: 'sf',
    });
    expect(adapted.starters.map((s) => s.playerId)).toEqual(['p', 'd1', 'c1', 'a1']);
    expect(adapted.bench.map((s) => s.playerId)).toEqual(['b1', 'b2']);
    expect(adapted.notSubmitted).toBe(true);
    expect(adapted.roundNumber).toBe(7);
  });

  it('drops sold players and fills the gap from the previous bench of the same role', () => {
    const previous = lineup(['p', 'd1', 'c1', 'a1'], ['b1', 'b2']);
    // c1 sold, b1 (C) still on roster
    const roster = new Set(['p', 'd1', 'a1', 'b1', 'b2', 'cNew']);
    const adapted = adaptLineupToRoster(previous, roster, {
      playersById: roles,
      roundNumber: 7,
    });
    expect(adapted.starters.map((s) => s.playerId)).toEqual(['p', 'd1', 'a1', 'b1']);
    expect(adapted.bench.map((s) => s.playerId)).toEqual(['b2']);
    expect(adapted.notSubmitted).toBe(true);
  });
});
