import { describe, expect, it } from 'vitest';
import { calculateTeamScore } from '@/lib/scoring-engine';
import {
  assembleRoundPlayerData,
  bonusMalusToEvents,
  isRoundLive,
  type LiveEventRow,
  type LiveVoteRow,
  type OfficialVoteRow,
} from '@/lib/round-player-data';
import type { Lineup, Player } from '@/types';

function scorePlayer(player: Player, vote: number, bonusMalus: unknown) {
  const data = {
    playerId: player.id,
    estimatedVote: vote,
    minutesPlayed: 90,
    isPlaying: false,
    events: bonusMalusToEvents(player.id, bonusMalus),
  };
  const lineup: Lineup = {
    teamId: 'dc',
    roundNumber: 1,
    formation: '4-3-3',
    starters: [{ playerId: player.id, position: 0 }],
    bench: [],
  };
  const result = calculateTeamScore(
    lineup,
    new Map([[player.id, data]]),
    false,
    0,
    0,
    null,
    { [player.id]: player }
  );
  return result.playerScores[0];
}

describe('bonus_malus to events', () => {
  it('turns Raimondo 8.5 with 3 goals into fantavoto 17.5', () => {
    const player: Player = {
      id: 'raimondo-antonio-a',
      name: 'RAIMONDO Antonio',
      role: 'A',
      teamId: 'dc',
    };
    const scored = scorePlayer(player, 8.5, [
      { type: 'goal', count: 3, minute: 57, label: 'Gol segnato' },
    ]);

    expect(scored.baseVote).toBe(8.5);
    expect(scored.bonuses.goals).toBe(3);
    expect(scored.fantavoto).toBe(17.5);
    expect(scored.bonuses.goalsConceded).toBe(0);
  });

  it('turns Palmisani goalkeeper 6 with 2 goals conceded into fantavoto 4', () => {
    const player: Player = {
      id: 'palmisani-lorenzo-p',
      name: 'PALMISANI Lorenzo',
      role: 'P',
      teamId: 'dc',
    };
    const scored = scorePlayer(player, 6, [
      { type: 'goal_conceded', count: 2, minute: null, label: 'Gol subito' },
    ]);

    expect(scored.baseVote).toBe(6);
    expect(scored.bonuses.goals).toBe(0);
    expect(scored.bonuses.goalsConceded).toBe(2);
    expect(scored.fantavoto).toBe(4);
  });

  it('repeats each bonus count times and skips unknown types', () => {
    const events = bonusMalusToEvents('p', [
      { type: 'assist', count: 2, minute: 12 },
      { type: 'yellow_card', count: 1, minute: 40 },
      { type: 'assist_soft', count: 1, minute: 70 },
    ]);
    expect(events).toEqual([
      { playerId: 'p', type: 'assist', minute: 12 },
      { playerId: 'p', type: 'assist', minute: 12 },
      { playerId: 'p', type: 'yellow_card', minute: 40 },
    ]);
  });
});

describe('official votes take priority over live votes', () => {
  const official: OfficialVoteRow = {
    player_id: 'raimondo-antonio-a',
    vote_fantacalcio: '8.5',
    minutes_played: null,
    bonus_malus: [{ type: 'goal', count: 3, minute: 57 }],
  };
  const liveVote: LiveVoteRow = {
    player_id: 'raimondo-antonio-a',
    estimated_vote: 6,
    minutes_played: 40,
    is_playing: true,
    updated_at: '2026-10-17T18:00:00.000Z',
  };
  const liveEvent: LiveEventRow = {
    player_id: 'raimondo-antonio-a',
    event_type: 'yellow_card',
    minute: 10,
    related_player_id: null,
  };

  it('keeps the pure official vote and ignores live events for that player', () => {
    const map = assembleRoundPlayerData([official], [liveVote], [liveEvent]);
    const data = map.get('raimondo-antonio-a');

    expect(data?.estimatedVote).toBe(8.5);
    expect(data?.minutesPlayed).toBe(90);
    expect(data?.isPlaying).toBe(false);
    expect(data?.events).toHaveLength(3);
    expect(data?.events.every((event) => event.type === 'goal' && !event.relatedPlayerId)).toBe(true);
  });

  it('uses live vote and live events when there is no official vote', () => {
    const onlyLive = assembleRoundPlayerData(
      [{ ...official, vote_fantacalcio: null }],
      [liveVote],
      [liveEvent]
    );
    expect(onlyLive.get('raimondo-antonio-a')).toMatchObject({
      estimatedVote: 6,
      minutesPlayed: 40,
      isPlaying: true,
      events: [{ playerId: 'raimondo-antonio-a', type: 'yellow_card', minute: 10 }],
    });
  });

  it('keeps an explicit official minutes value', () => {
    const map = assembleRoundPlayerData(
      [{ ...official, minutes_played: 63 }],
      [],
      []
    );
    expect(map.get('raimondo-antonio-a')?.minutesPlayed).toBe(63);
  });

  it('picks the latest live vote when providers disagree', () => {
    const map = assembleRoundPlayerData(
      [],
      [
        { ...liveVote, estimated_vote: 5, updated_at: '2026-10-17T12:00:00.000Z' },
        { ...liveVote, estimated_vote: 7, updated_at: '2026-10-17T18:00:00.000Z', source_provider: 'espn' },
      ],
      []
    );
    expect(map.get('raimondo-antonio-a')?.estimatedVote).toBe(7);
  });
});

describe('isRoundLive', () => {
  it('is live when a player is on the pitch or a Serie A match is live', () => {
    expect(isRoundLive([{ is_playing: true }], [{ status: 'finished' }])).toBe(true);
    expect(isRoundLive([{ is_playing: false }], [{ status: 'live' }])).toBe(true);
    expect(isRoundLive([{ is_playing: false }], [{ status: 'finished' }])).toBe(false);
    expect(isRoundLive([], [{ status: 'halftime' }])).toBe(true);
    expect(isRoundLive([], [{ status: 'scheduled' }])).toBe(false);
  });
});

describe('unused bench players', () => {
  it('show their fantavoto but stay out of the team total', () => {
    const gk: Player = { id: 'gk', name: 'GK', role: 'P', teamId: 'dc' };
    const fw: Player = { id: 'fw', name: 'FW', role: 'A', teamId: 'dc' };
    const lineup: Lineup = {
      teamId: 'dc',
      roundNumber: 1,
      formation: '4-3-3',
      starters: [{ playerId: 'gk', position: 0 }],
      bench: [{ playerId: 'fw', position: 0 }],
    };
    const data = assembleRoundPlayerData(
      [
        { player_id: 'gk', vote_fantacalcio: '6', minutes_played: null, bonus_malus: [] },
        { player_id: 'fw', vote_fantacalcio: '8.5', minutes_played: null, bonus_malus: [{ type: 'goal', count: 3 }] },
      ],
      [],
      []
    );
    const result = calculateTeamScore(lineup, data, false, 0, 0, null, { gk, fw });
    const bench = result.playerScores.find((ps) => ps.player.id === 'fw');
    expect(bench?.isUnusedBench).toBe(true);
    expect(bench?.fantavoto).toBe(17.5);
    expect(result.playerScores.find((ps) => ps.player.id === 'gk')?.isUnusedBench).toBeUndefined();
  });
});
