import { readFileSync } from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFantacalcioCalendar, type FantacalcioCatalogPlayer } from '../fantacalcio-it';
import {
  activeVoteMatches,
  dueForImport,
  fetchActiveMatchVotes,
  findCalendarMatch,
  resetFantacalcioCalendarCache,
  unmatchedRosterCandidates,
} from '../fantacalcio-auto-import';
import type { FantacalcioScrapedPlayer } from '../fantacalcio-it-client';

const calendarHtml = readFileSync('src/lib/__tests__/fixtures/fantacalcio-calendario-7.html', 'utf8');
const votesHtml = readFileSync('src/lib/__tests__/fixtures/fantacalcio-voti-inter-parma.html', 'utf8');
const calendar = parseFantacalcioCalendar(calendarHtml);
const now = new Date('2026-10-17T18:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

const catalog: { players: FantacalcioCatalogPlayer[]; aliases: [] } = {
  players: [
    { id: 'martinez-lautaro-javier-a', name: 'MARTINEZ Lautaro Javier', role: 'A', realTeam: 'INT' },
    { id: 'calha', name: 'CALHANOGLU Hakan', role: 'C', realTeam: 'INT' },
  ],
  aliases: [],
};

function htmlResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/html' } });
}

describe('activeVoteMatches', () => {
  it('keeps live matches and matches finished within the last hours', () => {
    const matches = [
      { id: 'live', status: 'live', kickoff_time: hoursAgo(1) },
      { id: 'ht', status: 'halftime', kickoff_time: hoursAgo(0.8) },
      { id: 'recent', status: 'finished', kickoff_time: hoursAgo(4) },
      { id: 'old', status: 'finished', kickoff_time: hoursAgo(30) },
      { id: 'future', status: 'scheduled', kickoff_time: new Date(now.getTime() + 3_600_000).toISOString() },
      { id: 'nokick', status: 'finished', kickoff_time: null },
    ];
    expect(activeVoteMatches(matches, now).map((m) => m.id)).toEqual(['live', 'ht', 'recent']);
  });
});

describe('dueForImport', () => {
  it('runs at most every ~2 minutes', () => {
    expect(dueForImport(null, now)).toBe(true);
    expect(dueForImport(new Date(now.getTime() - 60_000).toISOString(), now)).toBe(false);
    expect(dueForImport(new Date(now.getTime() - 110_000).toISOString(), now)).toBe(true);
  });
});

describe('findCalendarMatch', () => {
  it('maps ESPN team names onto fantacalcio.it matches', () => {
    const first = calendar[0];
    expect(findCalendarMatch(calendar, { id: 'x', status: 'live', kickoff_time: null, home_team: first.homeTeam, away_team: first.awayTeam })?.matchId).toBe(first.matchId);
    expect(findCalendarMatch(calendar, { id: 'x', status: 'live', kickoff_time: null, home_team: first.awayTeam, away_team: first.homeTeam })).toBeNull();
  });
});

describe('unmatchedRosterCandidates', () => {
  it('flags only unmatched players that look like league players', () => {
    const rows = [
      { name: 'Calhanoglu H.', team: 'Inter', role: 'C', vote: 6.5, playerId: null },
      { name: 'Sconosciuto', team: 'Inter', role: 'D', vote: 6, playerId: null },
      { name: 'Calhanoglu', team: 'Parma', role: 'C', vote: 6, playerId: null },
    ] as unknown as FantacalcioScrapedPlayer[];
    const out = unmatchedRosterCandidates(rows, catalog.players);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'Calhanoglu H.', candidates: [{ id: 'calha' }] });
  });
});

describe('fetchActiveMatchVotes', () => {
  beforeEach(() => resetFantacalcioCalendarCache());
  const [m1, m2] = calendar;
  const active = [
    { id: 'a', status: 'live', kickoff_time: hoursAgo(1), home_team: m1.homeTeam, away_team: m1.awayTeam },
    { id: 'b', status: 'finished', kickoff_time: hoursAgo(3), home_team: m2.homeTeam, away_team: m2.awayTeam },
  ];

  it('makes one request per active match (calendar cached) and matches players', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      htmlResponse(String(url).endsWith('/voti') ? votesHtml : calendarHtml)
    ) as unknown as typeof fetch;

    const first = await fetchActiveMatchVotes(7, active, catalog, { fetchImpl, now });
    expect(first.requests).toBe(3); // calendario + 2 partite
    expect(first.errors).toEqual([]);
    expect(first.players.some((p) => p.playerId === 'martinez-lautaro-javier-a')).toBe(true);

    const second = await fetchActiveMatchVotes(7, active, catalog, { fetchImpl, now });
    expect(second.requests).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('isolates a failing match page', async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u === m2.votesUrl) throw new Error('timeout');
      return htmlResponse(u.endsWith('/voti') ? votesHtml : calendarHtml);
    }) as typeof fetch;
    const result = await fetchActiveMatchVotes(7, active, catalog, { fetchImpl, now });
    expect(result.matches.find((m) => m.id === 'a')?.rows).toBeGreaterThan(0);
    expect(result.matches.find((m) => m.id === 'b')?.error).toBe('timeout');
    expect(result.errors).toHaveLength(1);
  });

  it('returns an error instead of throwing when the calendar is down', async () => {
    const fetchImpl = (async () => htmlResponse('no', 503)) as typeof fetch;
    const result = await fetchActiveMatchVotes(7, active, catalog, { fetchImpl, now });
    expect(result.players).toEqual([]);
    expect(result.errors[0]).toMatch(/calendario/);
  });

  it('does nothing without active matches', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await fetchActiveMatchVotes(7, [], catalog, { fetchImpl, now });
    expect(result.requests).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
