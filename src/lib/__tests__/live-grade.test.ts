import { describe, expect, it } from 'vitest';
import { isLiveGrade, liveMatchToVotePlayers, type LiveMatch } from '@/lib/fantacalcio-live';

const player = (name: string, vote: number | null, events: number[] = []) => ({ id: 1, name, position: 'A', vote, events, eventsMinutes: events.map(() => 85) });

describe('voto dal file live fantacalcio.it', () => {
  it('accetta solo (0, 10] come formatGrade di fantacalcio.it', () => {
    expect(isLiveGrade(5.5)).toBe(true);
    expect(isLiveGrade(10)).toBe(true);
    expect(isLiveGrade(55)).toBe(false);
    expect(isLiveGrade(0)).toBe(false);
    expect(isLiveGrade(null)).toBe(false);
  });
  it('un subentrato a fine gara con 55 è senza voto, non 55,0', () => {
    const match = { matchId: 18033, status: 0, teamHome: '', teamAway: '', goalHome: 0, goalAway: 0, playersHome: [player('Simeone', 7)], playersAway: [player('Cutrone', 55, [15]), player('Mout', 55, [15])] } as LiveMatch;
    const out = liveMatchToVotePlayers(match, 'Torino', 'Monza');
    expect(out.find((p) => p.name === 'Cutrone')).toMatchObject({ vote: null, fantaVote: null, substitution: { in: 85 } });
    expect(out.find((p) => p.name === 'Mout')?.vote).toBeNull();
    expect(out.find((p) => p.name === 'Simeone')?.vote).toBe(7);
  });
});
