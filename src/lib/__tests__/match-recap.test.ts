import { describe, expect, it } from 'vitest';
import { buildMatchRecap } from '@/lib/match-recap';
import { parseNotifySettings, planReminders, isIos } from '@/lib/notify-settings';
import type { RoundFixture } from '@/lib/serie-a-fixtures';

const fx = (id: string, h: string, a: string, kickoff: string | null, status: RoundFixture['status'] = 'scheduled'): RoundFixture => ({
  matchId: id, homeTeam: h, awayTeam: a, homeCode: h, awayCode: a, homeScore: 0, awayScore: 0, status, minute: 0, kickoffTime: kickoff,
});
const p = (id: string, team: string, starter: boolean, role: 'P' | 'D' | 'C' | 'A' = 'C') => ({ player: { id, name: id.toUpperCase(), role, realTeam: team }, isStarter: starter });

describe('buildMatchRecap', () => {
  const fixtures = [fx('2', 'INT', 'FIO', '2026-10-25T11:30:00Z'), fx('1', 'TOR', 'MON', '2026-10-24T13:00:00Z'), fx('3', 'LEC', 'JUV', '2026-10-25T17:00:00Z')];
  it('groups both sides by match in kickoff order, starters first, skipping empty matches', () => {
    const r = buildMatchRecap(fixtures, [p('b', 'INT', false), p('a', 'FIO', true), p('c', 'TOR', true)], [p('d', 'MON', false), p('e', 'XXX', true)]);
    expect(r.map((e) => e.fixture.matchId)).toEqual(['1', '2']);
    expect(r[1].home.map((x) => [x.id, x.starter])).toEqual([['a', true], ['b', false]]);
    expect(r[0].away.map((x) => x.id)).toEqual(['d']);
  });
});

describe('notifiche', () => {
  it('parses settings defensively', () => {
    expect(parseNotifySettings('{"enabled":true,"minutesBefore":60,"teamId":"am"}')).toEqual({ enabled: true, minutesBefore: 60, teamId: 'am' });
    expect(parseNotifySettings('{"minutesBefore":7}')).toEqual({ enabled: false, minutesBefore: 30, teamId: null });
    expect(parseNotifySettings('nope').enabled).toBe(false);
  });
  it('plans only future reminders for scheduled matches with my players', () => {
    const now = Date.parse('2026-10-24T12:00:00Z');
    const plan = planReminders([
      { fixture: fx('1', 'TOR', 'MON', '2026-10-24T13:00:00Z'), players: [{ name: 'KEITA', starter: true }, { name: 'X', starter: false }] },
      { fixture: fx('2', 'INT', 'FIO', '2026-10-24T12:10:00Z'), players: [{ name: 'Y', starter: true }] },
      { fixture: fx('3', 'LEC', 'JUV', '2026-10-24T11:00:00Z', 'live'), players: [{ name: 'Z', starter: true }] },
    ], 30, now);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ at: Date.parse('2026-10-24T12:30:00Z'), title: 'TOR-MON tra 30′', body: 'In campo: KEITA (+1 in panchina)' });
  });
  it('detects iOS', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIos('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
  });
});
