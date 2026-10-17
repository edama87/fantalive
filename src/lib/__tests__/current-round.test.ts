import { describe, expect, it } from 'vitest';
import { getCurrentRound } from '@/data/calendar';

describe('getCurrentRound', () => {
  it('returns round 1 before and during the first weekend', () => {
    expect(getCurrentRound(new Date('2026-10-01T10:00:00Z')).number).toBe(1);
    expect(getCurrentRound(new Date('2026-10-17T10:00:00Z')).number).toBe(1);
    expect(getCurrentRound(new Date('2026-10-22T20:00:00Z')).number).toBe(1);
  });

  it('moves to round 2 on its date in Rome time', () => {
    // 23/10 00:30 a Roma = 22/10 22:30 UTC
    expect(getCurrentRound(new Date('2026-10-22T22:30:00Z')).number).toBe(2);
    expect(getCurrentRound(new Date('2026-10-23T12:00:00Z')).serieAMatchday).toBe(8);
  });
});
