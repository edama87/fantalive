import { describe, expect, it } from 'vitest';
import { missingOutlets, outletList } from '@/lib/pianetafanta';

const p = (gazzetta: number | null, corriere: number | null, tuttosport: number | null) => ({
  votes: { gazzetta, corriere, tuttosport },
});

describe('missingOutlets', () => {
  it('flags papers missing for every player (only Gazzetta)', () => {
    const players = Array.from({ length: 15 }, () => p(6, null, null));
    expect(missingOutlets(players)).toEqual(['corriere', 'tuttosport']);
  });

  it('treats 0 votes as missing', () => {
    expect(missingOutlets([p(6, 0, 0), p(6.5, 0, null)])).toEqual(['corriere', 'tuttosport']);
  });

  it('uses the 90% threshold', () => {
    const ten = [...Array.from({ length: 9 }, () => p(6, null, 6)), p(6, 6, 6)];
    expect(missingOutlets(ten)).toEqual(['corriere']); // 9/10 missing
    const five = [...Array.from({ length: 8 }, () => p(6, null, 6)), p(6, 6, 6), p(6, 6, 6)];
    expect(missingOutlets(five)).toEqual([]); // 8/10 missing
  });

  it('ignores players without any vote and returns [] for complete or empty groups', () => {
    expect(missingOutlets([p(6, 6, 6), p(null, null, null)])).toEqual([]);
    expect(missingOutlets([p(null, null, null)])).toEqual([]);
    expect(missingOutlets([])).toEqual([]);
  });
});

describe('outletList', () => {
  it('joins with "e"', () => {
    expect(outletList(['corriere', 'tuttosport'])).toBe('Corriere e Tuttosport');
    expect(outletList(['gazzetta'])).toBe('Gazzetta');
    expect(outletList(['gazzetta', 'corriere', 'tuttosport'])).toBe('Gazzetta, Corriere e Tuttosport');
  });
});
