import { describe, expect, it } from 'vitest';
import { buildSerieAVoteRows, minutesFromSubs } from '@/lib/serie-a-vote-rows';
import type { FantacalcioVotePlayer } from '@/lib/fantacalcio-it';

const base = { team: 'Inter', role: 'A', bonuses: [{ type: 'goal', label: 'Gol', count: 1, minute: 30 }] } as unknown as FantacalcioVotePlayer;

describe('minutesFromSubs', () => {
  it('deduces minutes from substitutions', () => {
    expect(minutesFromSubs(undefined, true)).toBe(90);
    expect(minutesFromSubs(undefined, false)).toBeNull();
    expect(minutesFromSubs({ out: { minute: 74 } }, true)).toBe(74);
    expect(minutesFromSubs({ in: { minute: 58 } }, true)).toBe(32);
    expect(minutesFromSubs({ in: { minute: 46 }, out: { minute: 80 } }, true)).toBe(34);
    expect(minutesFromSubs({ in: { minute: null } }, true)).toBeNull();
  });
});

describe('buildSerieAVoteRows', () => {
  const players = [{ ...base, name: 'Lautaro Martinez', vote: 7, fantaVote: 10 }] as FantacalcioVotePlayer[];

  it('marks non-imported votes as estimated', () => {
    const [row] = buildSerieAVoteRows(players, new Map(), null);
    expect(row.estimated).toBe(true);
    expect(row.consolidated).toBeNull();
    expect(row.vote).toBe(7);
    expect(row.minutesPlayed).toBe(90);
  });

  it('uses consolidated votes and minutes when imported', () => {
    const [row] = buildSerieAVoteRows(players, new Map(), [
      { name: 'Lautaro Martinez', team: 'Inter', votes: { gazzetta: 6.5, corriere: 7, tuttosport: 6.5 }, average: 6.67, minutesPlayed: 81 },
    ]);
    expect(row.estimated).toBe(false);
    expect(row.consolidated).toEqual({ gazzetta: 6.5, corriere: 7, tuttosport: 6.5 });
    expect(row.vote).toBe(6.67);
    expect(row.minutesPlayed).toBe(81);
    expect(row.fantacalcioVote).toBe(7);
    expect(row.bonuses.goals).toBe(1);
    expect(row.fantaVote).toBeCloseTo(9.67, 5);
  });
});
