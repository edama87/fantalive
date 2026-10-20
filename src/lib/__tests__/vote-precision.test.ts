import { describe, expect, it } from 'vitest';
import { averageOfVotes, roundScore, truncateScore } from '@/lib/vote-precision';
import { applyGoalConversionRules, calculateGoals } from '@/lib/scoring-engine';

describe('precisione voti (come FMS Revo)', () => {
  it('medie troncate a 3 decimali', () => {
    expect(averageOfVotes([7.5, 7, 7.5])).toBe(7.333);
    expect(averageOfVotes([7, 6.5, 6.5])).toBe(6.666);
    expect(averageOfVotes([6, 6.5, 6])).toBe(6.166);
    expect(averageOfVotes([6.5, null, 6.5])).toBe(6.5);
    expect(averageOfVotes([null, undefined])).toBeNull();
    expect(truncateScore(6.5)).toBe(6.5);
    expect(truncateScore(0.1 + 0.2)).toBe(0.3);
    expect(roundScore(71.99950001)).toBe(72);
  });

  it('soglie gol a piena precisione', () => {
    expect(calculateGoals(71.999)).toBe(1);
    expect(calculateGoals(71.9995)).toBe(1);
    expect(calculateGoals(72)).toBe(2);
    expect(calculateGoals(65.999)).toBe(0);
    expect(calculateGoals(88.999)).toBe(5);
    expect(calculateGoals(89)).toBe(6);
    expect(calculateGoals(93)).toBe(7);
  });

  it('regola c: sotto 59 gol omaggio solo se l\'altra ha almeno 59 e +3', () => {
    expect(applyGoalConversionRules(84.497, 57.496, 4, 0)).toEqual({ homeGoals: 5, awayGoals: 0 });
    expect(applyGoalConversionRules(61, 58.5, 0, 0)).toEqual({ homeGoals: 0, awayGoals: 0 });
    expect(applyGoalConversionRules(61.5, 58.5, 0, 0)).toEqual({ homeGoals: 1, awayGoals: 0 });
    expect(applyGoalConversionRules(58.9, 50, 0, 0)).toEqual({ homeGoals: 0, awayGoals: 0 });
    expect(applyGoalConversionRules(55, 62, 0, 0)).toEqual({ homeGoals: 0, awayGoals: 1 });
  });

  it('regola a/d al limite: differenza calcolata a 3 decimali', () => {
    // 75,668 - 72,668 = 3 esatto (con i float sarebbe 2,99999...): niente pareggio.
    expect(applyGoalConversionRules(75.668, 72.668, 2, 2)).toEqual({ homeGoals: 2, awayGoals: 2 });
    expect(applyGoalConversionRules(72.001, 69.002, 2, 1)).toEqual({ homeGoals: 1, awayGoals: 1 });
    expect(applyGoalConversionRules(70, 66, 1, 1)).toEqual({ homeGoals: 2, awayGoals: 1 });
  });
});
