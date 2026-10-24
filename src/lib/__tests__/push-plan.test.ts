import { describe, expect, it } from 'vitest';
import { dueReminders, liveMessages, messagesFor, parsePushPrefs, type RoundSnapshot } from '@/lib/push/plan';
import { pushWindowActive } from '@/lib/push/window';
import { isAllowedEndpoint } from '@/lib/push/web-push';
import { teams } from '@/data/teams';
import type { Lineup, PlayerMatchData } from '@/types';
import type { RoundFixture } from '@/lib/serie-a-fixtures';

const [A, B] = [teams[0], teams[1]];
const lineup = (teamId: string, starters: string[], bench: string[] = []): Lineup => ({
  teamId, roundNumber: 3, formation: '343',
  starters: starters.map((playerId) => ({ playerId })) as Lineup['starters'],
  bench: bench.map((playerId) => ({ playerId })) as Lineup['bench'],
});
const fx = (id: string, h: string, a: string, kickoff: string, status: RoundFixture['status']): RoundFixture => ({
  matchId: id, homeTeam: h === 'COM' ? 'Como' : h, awayTeam: a === 'SAS' ? 'Sassuolo' : a, homeCode: h, awayCode: a, homeScore: 0, awayScore: 0, status, minute: 0, kickoffTime: kickoff,
});
const d = (playerId: string, events: PlayerMatchData['events']): PlayerMatchData => ({ playerId, estimatedVote: 6, minutesPlayed: 30, isPlaying: true, events });

const snapshot = (playerData: Map<string, PlayerMatchData>): RoundSnapshot => ({
  round: 3,
  pairings: [{ homeTeamId: A.id, awayTeamId: B.id }],
  lineups: { [`${A.id}-3`]: lineup(A.id, ['caq']), [`${B.id}-3`]: lineup(B.id, ['opp']) },
  players: {
    caq: { id: 'caq', name: 'CAQUERET Maxence', role: 'C', realTeam: 'COM' },
    opp: { id: 'opp', name: 'BERARDI Domenico', role: 'A', realTeam: 'SAS' },
  } as unknown as RoundSnapshot['players'],
  playerData,
  fixtures: [fx('m1', 'COM', 'SAS', '2026-10-24T13:00:00Z', 'live')],
});

describe('push plan', () => {
  const prefs = parsePushPrefs({ liveEnabled: true });
  it('notifies assists of my players with team title and sfida url; opponent assists off by default', () => {
    const s = snapshot(new Map([
      ['caq', d('caq', [{ playerId: 'caq', type: 'assist', minute: 23 }])],
      ['opp', d('opp', [{ playerId: 'opp', type: 'assist', minute: 30 }, { playerId: 'opp', type: 'goal', minute: 31 }])],
    ]));
    const m = liveMessages(s, A.id, prefs);
    expect(m.map((x) => [x.title, x.body])).toEqual([
      [`👟 ${A.name}`, 'Assist di Caqueret (Como) 23′'],
      [`⚽ ${B.name}`, 'Gol di Berardi (Sassuolo) 31′'],
    ]);
    expect(m[0]).toMatchObject({ key: 'r3:caq:assist:1', url: `/sfida/3/${A.id}-${B.id}` });
    // per il seed si prendono tutti i tipi, preferenze a parte
    expect(liveMessages(s, A.id, null, true)).toHaveLength(3);
    expect(liveMessages(s, A.id, parsePushPrefs({ liveEnabled: false }))).toEqual([]);
  });

  it('sends a reminder only between minutesBefore and kickoff', () => {
    const s: RoundSnapshot = { ...snapshot(new Map()), fixtures: [fx('m2', 'COM', 'SAS', '2026-10-24T13:00:00Z', 'scheduled')] };
    const p = parsePushPrefs({ enabled: true, minutesBefore: 30 });
    expect(dueReminders(s, A.id, p, Date.parse('2026-10-24T12:29:00Z'))).toEqual([]);
    const due = dueReminders(s, A.id, p, Date.parse('2026-10-24T12:31:00Z'));
    expect(due).toEqual([{ key: 'r3:kickoff-m2-30', title: '⏰ COM–SAS tra 30′', body: 'In campo: Caqueret', url: '/' }]);
    expect(dueReminders(s, A.id, p, Date.parse('2026-10-24T13:01:00Z'))).toEqual([]);
    expect(messagesFor(s, A.id, parsePushPrefs({ enabled: false }), Date.parse('2026-10-24T12:31:00Z'))).toEqual([]);
  });
});

describe('push window and endpoints', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  it('is active only around matches', () => {
    expect(pushWindowActive([{ status: 'live', kickoff_time: null }], now)).toBe(true);
    expect(pushWindowActive([{ status: 'scheduled', kickoff_time: '2026-10-24T12:50:00Z' }], now)).toBe(true);
    expect(pushWindowActive([{ status: 'scheduled', kickoff_time: '2026-10-24T14:00:00Z' }], now)).toBe(false);
    expect(pushWindowActive([{ status: 'finished', kickoff_time: '2026-10-24T09:00:00Z' }], now)).toBe(true);
    expect(pushWindowActive([{ status: 'finished', kickoff_time: '2026-10-24T06:00:00Z' }], now)).toBe(false);
  });
  it('accepts only push-service endpoints', () => {
    expect(isAllowedEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isAllowedEndpoint('https://web.push.apple.com/QO')).toBe(true);
    expect(isAllowedEndpoint('https://evil.example.com/x')).toBe(false);
    expect(isAllowedEndpoint('http://fcm.googleapis.com/x')).toBe(false);
  });
});
