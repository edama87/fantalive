import { describe, it, expect } from 'vitest';
import { pickActiveRound } from '@/lib/active-round';
import { getCurrentRound, getRoundByNumber } from '@/data/calendar';

const r3 = getRoundByNumber(3)!;
const kickoff = new Date('2026-10-27T17:30:00Z'); // 18:30 Roma

describe('pickActiveRound', () => {
  it('per data la 3ª parte il 27/10, ma resta attiva la 2ª fino al primo calcio d\'inizio', () => {
    const morning = new Date('2026-10-27T08:00:00Z');
    expect(getCurrentRound(morning).number).toBe(3);
    expect(pickActiveRound(morning, kickoff).number).toBe(2);
    expect(pickActiveRound(new Date('2026-10-27T17:29:59Z'), kickoff).number).toBe(2);
    expect(pickActiveRound(new Date('2026-10-27T17:30:00Z'), kickoff).number).toBe(3);
  });
  it('senza partite in DB passa alla giornata il giorno dopo la data di calendario', () => {
    expect(pickActiveRound(new Date('2026-10-27T20:00:00Z'), null, r3).number).toBe(2);
    expect(pickActiveRound(new Date('2026-10-27T23:00:00Z'), null, r3).number).toBe(3); // 00:00 Roma del 28
  });
  it('il giorno prima resta la giornata per data', () => {
    expect(pickActiveRound(new Date('2026-10-26T22:00:00Z'), null).number).toBe(2);
  });
  it('la 1ª giornata è sempre attiva prima della 2ª', () => {
    expect(pickActiveRound(new Date('2026-10-01T10:00:00Z'), null).number).toBe(1);
  });
});
