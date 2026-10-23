import { describe, expect, it } from 'vitest';
import { espnClockLabel, matchClockText } from '@/lib/match-clock';
import { mergeEspnClock } from '@/lib/serie-a-subs-loader';
import type { FantacalcioCalendarMatch } from '@/lib/fantacalcio-it';

describe('minuto partita', () => {
  it('converte il displayClock ESPN', () => {
    expect(espnClockLabel("83'")).toBe('83′');
    expect(espnClockLabel("45'+2'")).toBe('45′+2');
    expect(espnClockLabel("90'+5'")).toBe('90′+5');
    expect(espnClockLabel("0'")).toBeNull();
    expect(espnClockLabel(undefined)).toBeNull();
  });
  it('testo per stato', () => {
    expect(matchClockText({ status: 'live', minute: 0, clock: '83′' })).toBe('83′');
    expect(matchClockText({ status: 'live', minute: 0 })).toBe('In corso');
    expect(matchClockText({ status: 'halftime', minute: 45 })).toBe('Intervallo');
    expect(matchClockText({ status: 'finished', minute: 90 })).toBe('Finale');
  });
  it('unisce il minuto ESPN al calendario fantacalcio.it (che ha minuto 0)', () => {
    const fc = { homeTeam: 'Torino', awayTeam: 'Monza', status: 'live', minute: 0, homeScore: 3, awayScore: 1 } as FantacalcioCalendarMatch;
    const espn = [{ matchId: '1', homeTeam: 'Torino', awayTeam: 'Monza', homeScore: 3, awayScore: 1, minute: 83, displayClock: "83'", status: 'live' as const }];
    expect(mergeEspnClock([fc], espn)[0]).toMatchObject({ minute: 83, clock: '83′', status: 'live' });
    expect(mergeEspnClock([fc], [{ ...espn[0], status: 'finished' as const }])[0]).toMatchObject({ status: 'finished' });
    expect(mergeEspnClock([fc], [])[0]).toEqual(fc);
  });
});
