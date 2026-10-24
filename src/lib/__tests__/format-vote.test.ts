import { describe, expect, it } from 'vitest';
import { formatSignedPoints, formatVote } from '../utils';
import { calculateFantavoto } from '../scoring-engine';
import { fantavotoFromVote } from '../fantacalcio-it';

const none = { goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0, assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0 };

describe('formatVote (voti, fantavoti, totali)', () => {
  it('shows up to 3 decimals with the Italian comma', () => {
    expect(formatVote(6)).toBe('6,0');
    expect(formatVote(6.5)).toBe('6,5');
    expect(formatVote(6.67)).toBe('6,67');
    expect(formatVote(11 + 1 / 3)).toBe('11,333');
    expect(formatVote(29.83)).toBe('29,83');
    expect(formatVote(72)).toBe('72,0');
    expect(formatVote(67.833)).toBe('67,833');
    expect(formatVote(70.5)).toBe('70,5');
    expect(formatVote(70.25)).toBe('70,25');
    expect(formatVote(70.3333333)).toBe('70,333');
    expect(formatVote(70.9996)).toBe('71,0');
    expect(formatVote(-0.5)).toBe('-0,5');
    expect(formatSignedPoints(1.5)).toBe('+1,5');
    expect(formatSignedPoints(1)).toBe('+1');
    expect(formatSignedPoints(0)).toBe('0');
    expect(formatSignedPoints(-0.25)).toBe('-0,25');
  });
});

describe('no rounding in scoring', () => {
  it('keeps the full consolidated average in the fantavoto', () => {
    expect(calculateFantavoto(7.33, { ...none, goals: 1, assists: 1 }, false)).toBeCloseTo(11.33, 10);
    expect(calculateFantavoto(22 / 3, none, false)).toBe(22 / 3);
    expect(fantavotoFromVote(7.33, [{ type: 'goal', label: 'Gol', count: 1, minute: null }, { type: 'assist', label: 'Assist', count: 1, minute: null }])).toBe(11.33);
  });
});
