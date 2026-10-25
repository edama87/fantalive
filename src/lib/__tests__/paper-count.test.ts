import { describe, expect, it } from 'vitest';
import { paperCountOf } from '@/components/match/vote-source';

describe('paperCountOf', () => {
  it('counts only real paper votes', () => {
    expect(paperCountOf({ gazzetta: 6, corriere: 6.5, tuttosport: 7 })).toBe(3);
    expect(paperCountOf({ gazzetta: 6, corriere: 0, tuttosport: null })).toBe(1);
    expect(paperCountOf({ gazzetta: 6, corriere: 6 })).toBe(2);
    expect(paperCountOf(null)).toBe(0);
  });
});
