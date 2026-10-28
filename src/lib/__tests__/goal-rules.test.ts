import { describe, it, expect } from 'vitest';
import { explainGoalConversion } from '@/lib/goal-rules';

describe('explainGoalConversion', () => {
  it('regola c: Atletico 65,83 vs Sfortonia 32,498 → 1-0', () => {
    const e = explainGoalConversion('Atletico Magari', 'Sfortonia', 65.83, 32.498)!;
    expect(e.rule).toBe('c');
    expect(e.before).toEqual([0, 0]);
    expect(e.after).toEqual([1, 0]);
    expect(e.text).toBe('Regola c: Sfortonia sotto 59, Atletico Magari ≥59 e +3 (65,83 vs 32,498) → +1 gol Atletico Magari (0-0 → 1-0)');
  });
  it('regola a: pareggio con differenza sotto 3', () => {
    const e = explainGoalConversion('A', 'B', 72.5, 70)!;
    expect(e.rule).toBe('a');
    expect(e.after).toEqual([2, 2]);
  });
  it('regola a sotto 66: 0-0', () => {
    const e = explainGoalConversion('A', 'B', 67, 65)!;
    expect(e.rule).toBe('a0');
    expect(e.after).toEqual([0, 0]);
  });
  it('regola d: +4 a pari fasce', () => {
    const e = explainGoalConversion('A', 'B', 70, 66)!;
    expect(e.rule).toBe('d');
    expect(e.after).toEqual([2, 1]);
  });
  it('trasferta in vantaggio (regola c)', () => {
    expect(explainGoalConversion('A', 'B', 55, 62)!.text).toContain('+1 gol B (0-0 → 0-1)');
  });
  it('nessuna regola → null', () => {
    expect(explainGoalConversion('A', 'B', 74, 66)).toBeNull();
    expect(explainGoalConversion('A', 'B', 50, 52)).toBeNull();
  });
});
