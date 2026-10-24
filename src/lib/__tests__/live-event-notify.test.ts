import { describe, expect, it } from 'vitest';
import { collectLiveNotifications, DEFAULT_LIVE_EVENT_PREFS, displaySurname, parseLiveEventPrefs } from '@/lib/live-event-notify';
import type { PlayerMatchData } from '@/types';

const d = (playerId: string, events: PlayerMatchData['events'], minutesPlayed = 60): PlayerMatchData => ({ playerId, estimatedVote: 6, minutesPlayed, isPlaying: true, events });
const players = { mct: { name: 'MCTOMINAY Scott', realTeam: 'NAP' }, man: { name: 'MANDAS Christos', realTeam: 'LAZ' }, opp1: { name: 'KEAN Moise', realTeam: 'FIO' }, b: { name: 'BENCH Guy', realTeam: 'NAP' } };
const fixtures = [{ matchId: '1', homeTeam: 'Napoli', awayTeam: 'Roma', homeCode: 'NAP', awayCode: 'ROM', homeScore: 0, awayScore: 0, status: 'live' as const, minute: 30, kickoffTime: null }];

describe('collectLiveNotifications', () => {
  const base = {
    round: 2,
    ours: { teamName: 'Amatori ProSecco', starters: ['mct', 'man'], bench: ['b'] },
    opp: { teamName: 'Real Pedrotte', starters: ['opp1'], bench: [] },
    players, fixtures, prefs: DEFAULT_LIVE_EVENT_PREFS,
  };
  it('formats goals, saves and reds, skips conceded goals and unused bench players', () => {
    const playerData = new Map([
      ['mct', d('mct', [{ playerId: 'mct', type: 'goal', minute: 12 }, { playerId: 'mct', type: 'goal', minute: 40 }])],
      ['man', d('man', [{ playerId: 'man', type: 'goal', minute: 5, relatedPlayerId: 'opponent' }, { playerId: 'man', type: 'penalty_saved', minute: 70 }])],
      ['b', d('b', [], 0)],
      ['opp1', d('opp1', [{ playerId: 'opp1', type: 'red_card', minute: 80 }, { playerId: 'opp1', type: 'yellow_card', minute: 20 }])],
    ]);
    const n = collectLiveNotifications({ ...base, playerData });
    expect(n.map((x) => x.body)).toEqual(['Gol di McTominay (Napoli) 12′', 'Gol di McTominay (Napoli) 40′', 'Rigore parato da Mandas (LAZ) 70′', 'Espulso Kean (FIO) 80′']);
    expect(n[0]).toMatchObject({ key: 'r2:mct:goal:1', title: '⚽ Amatori ProSecco' });
    expect(n[2].title).toBe('🧤 Amatori ProSecco');
    expect(n[3].title).toBe('🟥 Real Pedrotte');
  });

  it('formats surnames for display', () => {
    expect(displaySurname('MCTOMINAY')).toBe('McTominay');
    expect(displaySurname('DE BRUYNE')).toBe('De Bruyne');
    expect(displaySurname("N'DICKA")).toBe("N'Dicka");
  });
  it('respects per-side toggles and bench players who came on', () => {
    const prefs = parseLiveEventPrefs({ goal: { ours: false } });
    const playerData = new Map([['b', d('b', [{ playerId: 'b', type: 'goal', minute: 88 }], 10)], ['opp1', d('opp1', [{ playerId: 'opp1', type: 'goal', minute: 9 }])]]);
    expect(collectLiveNotifications({ ...base, prefs, playerData }).map((x) => x.key)).toEqual(['r2:opp1:goal:1']);
    expect(collectLiveNotifications({ ...base, playerData }).map((x) => x.key)).toEqual(['r2:b:goal:1', 'r2:opp1:goal:1']);
  });
});
