import { describe, expect, it } from 'vitest';
import catalogPlayers from '@/providers/__tests__/fixtures/espn-catalog-players.json';
import summaryMilVen from '@/providers/__tests__/fixtures/espn-summary-mil-ven.json';
import summaryPenSaved from '@/providers/__tests__/fixtures/espn-summary-pen-saved.json';
import {
  createEspnPlayerMatcher,
  espnDateRange,
  parseClockMinute,
  parseEspnSummary,
  type EspnSummary,
} from '@/lib/espn-live';
import type { FantacalcioCatalogPlayer } from '@/lib/fantacalcio-it';
import {
  cronWindow,
  deriveRoundStatus,
  pickCurrentRound,
  roundEspnDates,
  type DbRoundRow,
} from '@/lib/round-schedule';
import {
  fixtureForTeam,
  fixtureFromRow,
  fixtureLabel,
  teamStatusesFromFixtures,
  type RoundFixture,
} from '@/lib/serie-a-fixtures';
import { calculateMatch, processSubstitutions } from '@/lib/scoring-engine';
import { matchStatusFromTeams } from '@/lib/live-data';
import { assembleRoundPlayerData } from '@/lib/round-player-data';
import type { Lineup, MatchStatus, Player, PlayerMatchData } from '@/types';

const matcher = createEspnPlayerMatcher(catalogPlayers as FantacalcioCatalogPlayer[], []);

describe('ESPN summary parsing (real data)', () => {
  it('handles penalty saved / missed / scored', () => {
    const parsed = parseEspnSummary(summaryPenSaved as EspnSummary, matcher);
    const byId = new Map(parsed.players.map((p) => [p.playerId, p]));
    expect(byId.get('mandas-christos-p')?.events.map((e) => e.type)).toEqual(['penalty_saved']);
    expect(byId.get('yeboah-john-a')?.events.map((e) => e.type)).toEqual(['penalty_missed']);
    expect(byId.get('zaccagni-mattia-c')?.events.map((e) => e.type)).toEqual(['penalty_scored']);
    expect(byId.get('tavares-nuno-albertino-d')?.events.map((e) => e.type)).toEqual(['assist']);
    expect(byId.get('noslin-tijjani-a')?.events.map((e) => e.type)).toEqual(['goal']);
    expect(parsed.status).toBe('finished');
  });

  it('logs as unmatched the players that are not in the catalog (own goal author included)', () => {
    const parsed = parseEspnSummary(summaryMilVen as EspnSummary, matcher);
    expect(parsed.unmatched.length).toBeGreaterThan(0);
    expect(parsed.unmatched.some((p) => /Halhal/i.test(p.name))).toBe(true);
    expect(parsed.players.find((p) => p.playerId === 'ramos-goncalo-matias-a')?.events.map((e) => e.type)).toEqual(['goal']);
  });

  it('matches accented and surname-first DB names', () => {
    expect(matcher('Giacomo Calò', 'FRO')).toBe('calo-giacomo-c');
    expect(matcher('Antonio Raimondo', 'FRO')).toBe('raimondo-antonio-a');
    expect(matcher('Nobody Atall', 'FRO')).toBeNull();
  });

  it('parses stoppage-time clocks and date ranges', () => {
    expect(parseClockMinute("45'+2'")).toBe(45); // recupero conteggiato nel minuto base
    expect(parseClockMinute("63'")).toBe(63);
    expect(espnDateRange('2026-10-16', 4)).toEqual(['20261016', '20261017', '20261018', '20261019']);
  });
});

describe('round schedule', () => {
  const rounds: DbRoundRow[] = [
    { number: 1, serie_a_matchday: 7, kickoff_date: '2026-10-16', status: 'finished' },
    { number: 2, serie_a_matchday: 8, kickoff_date: '2026-10-23', status: 'scheduled' },
  ];

  it('picks the round by date, not by (possibly wrong) status', () => {
    expect(pickCurrentRound(rounds, '2026-10-17')?.number).toBe(1);
    expect(pickCurrentRound(rounds, '2026-10-23')?.number).toBe(2);
    expect(pickCurrentRound(rounds, '2026-10-01')?.number).toBe(1);
  });

  it('covers every matchday date until the next round (max 5)', () => {
    expect(roundEspnDates(rounds[0], rounds[1])).toEqual(['20261016', '20261017', '20261018', '20261019', '20261020']);
    expect(roundEspnDates(rounds[0], { ...rounds[1], kickoff_date: '2026-10-19' })).toEqual(['20261016', '20261017', '20261018']);
  });

  it('is finished only when all 10 fixtures are finished', () => {
    expect(deriveRoundStatus(['finished'])).toBe('live');
    expect(deriveRoundStatus(['finished', ...Array(9).fill('scheduled')])).toBe('live');
    expect(deriveRoundStatus(Array(10).fill('finished'))).toBe('finished');
    expect(deriveRoundStatus(Array(10).fill('scheduled'))).toBe('scheduled');
  });

  it('opens the cron window around kickoffs and for missing fixtures', () => {
    const now = new Date('2026-10-17T12:50:00Z');
    const full = Array.from({ length: 10 }, (_, i) => ({ id: String(i), status: 'finished', kickoff_time: '2026-10-16T18:45:00Z' }));
    expect(cronWindow(full, now, true).active).toBe(false);
    expect(cronWindow(full.slice(0, 1), now, true).reason).toBe('fixtures_missing');
    expect(cronWindow(full.slice(0, 1), now, false).active).toBe(false);
    const upcoming = [...full.slice(1), { id: 'ven-nap', status: 'scheduled', kickoff_time: '2026-10-17T13:00:00Z' }];
    expect(cronWindow(upcoming, now, true).reason).toBe('match_within_window');
    const live = [...full.slice(1), { id: 'x', status: 'halftime', kickoff_time: null }];
    expect(cronWindow(live, now, false).reason).toBe('live_match_in_progress');
  });
});

const fixtures: RoundFixture[] = [
  fixtureFromRow({ id: '1', home_team: 'Frosinone', away_team: 'Sassuolo', home_score: 4, away_score: 2, status: 'finished', minute: 90, kickoff_time: '2026-10-16T18:45:00Z' }),
  fixtureFromRow({ id: '2', home_team: 'Venezia', away_team: 'Napoli', home_score: 1, away_score: 0, status: 'live', minute: 63, kickoff_time: '2026-10-17T13:00:00Z' }),
  fixtureFromRow({ id: '3', home_team: 'Roma', away_team: 'Genoa', home_score: 0, away_score: 0, status: 'scheduled', minute: 0, kickoff_time: '2026-10-17T13:00:00Z' }),
  fixtureFromRow({ id: '4', home_team: 'Bologna', away_team: 'Inter', home_score: 0, away_score: 0, status: 'halftime', minute: 45, kickoff_time: '2026-10-17T16:00:00Z' }),
];

describe('serie A fixtures labels', () => {
  it('formats team, score and status', () => {
    expect(fixtureLabel(fixtureForTeam(fixtures, 'FRO')!)).toBe('FRO-SAS 4-2 finita');
    expect(fixtureLabel(fixtureForTeam(fixtures, 'NAP')!)).toBe('VEN-NAP 1-0 in corso 63′');
    expect(fixtureLabel(fixtureForTeam(fixtures, 'ROM')!)).toBe('ROM-GEN da giocare sab 15:00');
    expect(fixtureLabel(fixtureForTeam(fixtures, 'INT')!)).toBe('BOL-INT 0-0 intervallo');
    expect(fixtureForTeam(fixtures, 'JUV')).toBeNull();
  });

  it('maps every team code to its match status', () => {
    const statuses = teamStatusesFromFixtures(fixtures);
    expect(statuses.get('SAS')).toBe('finished');
    expect(statuses.get('VEN')).toBe('live');
    expect(statuses.get('GEN')).toBe('scheduled');
  });
});

describe('early substitutions wait for the Serie A match', () => {
  const players: Record<string, Player> = {
    gk: { id: 'gk', name: 'GK', role: 'P', teamId: 'dc', realTeam: 'FRO' },
    a1: { id: 'a1', name: 'Finished no vote', role: 'A', teamId: 'dc', realTeam: 'SAS' },
    a2: { id: 'a2', name: 'Not played yet', role: 'A', teamId: 'dc', realTeam: 'ROM' },
    b1: { id: 'b1', name: 'Bench FRO', role: 'A', teamId: 'dc', realTeam: 'FRO' },
    b2: { id: 'b2', name: 'Bench FRO 2', role: 'A', teamId: 'dc', realTeam: 'FRO' },
  };
  const lineup: Lineup = {
    teamId: 'dc',
    roundNumber: 1,
    formation: '4-4-2',
    starters: [
      { playerId: 'gk', position: 0 },
      { playerId: 'a1', position: 1 },
      { playerId: 'a2', position: 2 },
    ],
    bench: [
      { playerId: 'b1', position: 0 },
      { playerId: 'b2', position: 1 },
    ],
  };
  const vote = (id: string, v: number): PlayerMatchData => ({ playerId: id, estimatedVote: v, minutesPlayed: 90, isPlaying: false, events: [] });
  const data = new Map([['gk', vote('gk', 6)], ['b1', vote('b1', 7)], ['b2', vote('b2', 6.5)]]);
  const teamStatuses = teamStatusesFromFixtures(fixtures);

  it('substitutes only the starter whose match is finished', () => {
    const result = processSubstitutions({ ...lineup, starters: [...lineup.starters], bench: [...lineup.bench] }, data, 5, players, teamStatuses);
    expect(result.finalStarters).toEqual(['gk', 'b1']);
    expect(result.pendingStarters).toEqual(['a2']);
    expect(result.subsUsed).toBe(1);
  });

  it('keeps the old behaviour without fixture statuses', () => {
    const result = processSubstitutions({ ...lineup, starters: [...lineup.starters], bench: [...lineup.bench] }, data, 5, players);
    expect(result.finalStarters).toEqual(['gk', 'b1', 'b2']);
    expect(result.pendingStarters).toEqual([]);
  });

  it('shows the pending starter as to play, with no points', () => {
    const away: Lineup = { ...lineup, teamId: 'ap', starters: [], bench: [] };
    const match = calculateMatch({ ...lineup }, away, data, 'live', players, teamStatuses);
    const pending = match.homePlayerScores.find((s) => s.player.id === 'a2');
    expect(pending).toMatchObject({ isStarter: true, fantavoto: 0 });
    expect(['to_play', 'playing']).toContain(pending?.status);
    expect(match.homePlayerScores.some((s) => s.player.id === 'b2' && s.isStarter)).toBe(false);
  });

  it('marks a fantasy matchup finished only when all its Serie A matches are finished', () => {
    const finishedOnly = new Map<string, MatchStatus>([['FRO', 'finished'], ['SAS', 'finished'], ['ROM', 'scheduled']]);
    expect(matchStatusFromTeams([lineup], players, finishedOnly)).toBe('live');
    finishedOnly.set('ROM', 'finished');
    expect(matchStatusFromTeams([lineup], players, finishedOnly)).toBe('finished');
    expect(matchStatusFromTeams([lineup], players, new Map())).toBe('scheduled');
  });
});

describe('live events decoding', () => {
  it('turns a self-referencing goal back into a goal conceded', () => {
    const map = assembleRoundPlayerData(
      [],
      [{ player_id: 'gk', estimated_vote: 5, minutes_played: 90, is_playing: false } as never],
      [
        { player_id: 'gk', event_type: 'goal', minute: 15, related_player_id: 'gk' },
        { player_id: 'gk', event_type: 'yellow_card', minute: 20, related_player_id: null },
      ]
    );
    const events = map.get('gk')?.events ?? [];
    expect(events[0]).toMatchObject({ type: 'goal', relatedPlayerId: 'opponent' });
    expect(events[1].relatedPlayerId).toBeUndefined();
  });
});
