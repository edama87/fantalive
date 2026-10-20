import { describe, expect, it } from 'vitest';
import {
  calculateAttackModifier,
  calculateDefenseModifier,
  calculateMatch,
  calculateMidfieldModifier,
  explainAttackModifier,
  explainDefenseModifier,
  explainMidfieldModifier,
} from '@/lib/scoring-engine';
import type { Lineup, Player, PlayerMatchData } from '@/types';

describe('modifier explanations (same math as the modifiers)', () => {
  it('defense: average with s.v. = 5, table band and formation adjustment', () => {
    const d = explainDefenseModifier(
      [{ name: 'A', vote: 6 }, { name: 'B', vote: 6.5 }, { name: 'C', vote: 0 }],
      3
    );
    expect(d.inputs.map((i) => i.usedVote)).toEqual([6, 6.5, 5]);
    expect(d.average).toBeCloseTo(5.8333, 3);
    expect(d.band).toEqual({ minAvg: 5.8, maxAvg: 5.999, modifier: 0 });
    expect(d.formationAdjustment).toBe(1);
    expect(d.modifier).toBe(1);
    expect(calculateDefenseModifier([6, 6.5, 0], 3)).toBe(d.modifier);
  });

  it('defense: top and bottom bands', () => {
    expect(explainDefenseModifier([5, 5, 5, 5], 4).band).toEqual({ minAvg: 0, maxAvg: 5.199, modifier: 4 });
    const high = explainDefenseModifier([7, 7, 7, 7, 7], 5);
    expect(high.band?.modifier).toBe(-5);
    expect(high.modifier).toBe(-6);
    expect(explainDefenseModifier([], 4)).toMatchObject({ average: null, band: null, modifier: 0 });
  });

  it('midfield: sums, padding with 5 to the larger midfield, band', () => {
    const m = explainMidfieldModifier([7, 6.5, 6, 6, 0], [6, 6, 6], 5, 3);
    expect(m.homeTotal).toBe(30.5);
    expect(m.awayInputs.filter((i) => i.padded)).toHaveLength(2);
    expect(m.awayTotal).toBe(28);
    expect(m.diff).toBe(2.5);
    expect(m.band).toEqual({ minDiff: 2.5, bonus: 1.5, malus: -1.5 });
    expect([m.homeModifier, m.awayModifier]).toEqual([1.5, -1.5]);
    expect(calculateMidfieldModifier([7, 6.5, 6, 6, 0], [6, 6, 6], 5, 3)).toEqual({ homeModifier: 1.5, awayModifier: -1.5 });
  });

  it('regolamento: fasce a piena precisione', () => {
    // Esempio del regolamento: 27 vs 23 -> +2 / -2.
    expect(calculateMidfieldModifier([7, 7, 7, 6], [6, 6, 6, 5], 4, 4)).toEqual({ homeModifier: 2, awayModifier: -2 });
    // DC-AP giornata 1: 32 vs 27,333 (4,667) -> +2,5 / -2,5.
    expect(calculateMidfieldModifier([4.667, 7.333, 6.667, 6.833, 6.5], [5.833, 4.833, 5, 6.667], 5, 4)).toEqual({ homeModifier: 2.5, awayModifier: -2.5 });
    // Difesa: 6,699 resta -3, 6,7 passa a -4; 5,1995 è ancora +4.
    expect(explainDefenseModifier([6.699, 6.699, 6.699, 6.699], 4).band?.modifier).toBe(-3);
    expect(explainDefenseModifier([6.7, 6.7, 6.7, 6.7], 4).band?.modifier).toBe(-4);
    expect(explainDefenseModifier([5.199, 5.2, 5.199, 5.2], 4).band?.modifier).toBe(4);
  });

  it('attack: only forwards who did not score, by vote band', () => {
    const forwards = [
      { name: 'X', vote: 7.5, scored: false },
      { name: 'Y', vote: 8, scored: true },
      { name: 'Z', vote: 6, scored: false },
      { name: 'W', vote: 6.5, scored: false },
    ];
    const a = explainAttackModifier(forwards);
    expect(a.entries.map((e) => [e.minVote, e.bonus])).toEqual([[7.5, 1.5], [null, 0], [null, 0], [6.5, 0.5]]);
    expect(a.modifier).toBe(2);
    expect(calculateAttackModifier(forwards)).toBe(2);
  });

  it('calculateMatch exposes details that add up to the shown modifiers', () => {
    const players: Record<string, Player> = {
      hd: { id: 'hd', name: 'Home D', role: 'D', teamId: 'dc' },
      hc: { id: 'hc', name: 'Home C', role: 'C', teamId: 'dc' },
      ha: { id: 'ha', name: 'Home A', role: 'A', teamId: 'dc' },
      ad: { id: 'ad', name: 'Away D', role: 'D', teamId: 'ap' },
      ac: { id: 'ac', name: 'Away C', role: 'C', teamId: 'ap' },
    };
    const v = (id: string, vote: number): PlayerMatchData => ({ playerId: id, estimatedVote: vote, minutesPlayed: 90, isPlaying: false, events: [] });
    const data = new Map([['hd', v('hd', 6)], ['hc', v('hc', 7)], ['ha', v('ha', 7)], ['ad', v('ad', 6.5)], ['ac', v('ac', 5.5)]]);
    const home: Lineup = { teamId: 'dc', roundNumber: 1, formation: '4-4-2', starters: ['hd', 'hc', 'ha'].map((playerId, position) => ({ playerId, position })), bench: [] };
    const away: Lineup = { teamId: 'ap', roundNumber: 1, formation: '4-4-2', starters: ['ad', 'ac'].map((playerId, position) => ({ playerId, position })), bench: [] };
    const match = calculateMatch(home, away, data, 'finished', players);

    const h = match.homeModifiers;
    expect(h.details?.opponentDefense.teamId).toBe('ap');
    expect(h.details?.opponentDefense.inputs.map((i) => i.name)).toEqual(['Away D']);
    expect(h.defenseModifier).toBe(h.details?.opponentDefense.modifier);
    expect(h.midfieldModifier).toBe(h.details?.midfield.homeModifier);
    expect(h.attackModifier).toBe(h.details?.attack.modifier);
    expect(h.details?.attack.entries).toMatchObject([{ name: 'Home A', vote: 7, bonus: 1 }]);
    expect(h.total).toBe(h.defenseModifier + h.midfieldModifier + h.attackModifier + h.homeBonus);
    expect(match.awayModifiers.midfieldModifier).toBe(match.awayModifiers.details?.midfield.awayModifier);
    expect(match.awayModifiers.details?.isHome).toBe(false);
  });
});
