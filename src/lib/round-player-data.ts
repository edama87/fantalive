/**
 * Voti di giornata per lo scoring: official_votes (voto puro + bonus) e,
 * solo per chi non ha voto ufficiale, live_votes + live_events.
 */

import { getServerClient } from '@/lib/db/supabase';
import type { EventType, PlayerEvent, PlayerMatchData } from '@/types';

const PLAYER_EVENT_TYPES = new Set<EventType>([
  'goal',
  'penalty_scored',
  'penalty_missed',
  'penalty_saved',
  'assist',
  'own_goal',
  'yellow_card',
  'red_card',
  'substitution_in',
  'substitution_out',
]);

export interface OfficialVoteRow {
  player_id: string;
  vote_fantacalcio: number | string | null;
  minutes_played: number | string | null;
  bonus_malus: unknown;
}

export interface LiveVoteRow {
  player_id: string;
  estimated_vote: number | string | null;
  minutes_played: number | string | null;
  is_playing: boolean | null;
  updated_at?: string | null;
  source_provider?: string | null;
}

export interface LiveEventRow {
  player_id: string;
  event_type: string;
  minute: number | string | null;
  related_player_id?: string | null;
}

export interface SerieAMatchStatusRow {
  status: string;
}

export interface RoundPlayerState {
  playerData: Map<string, PlayerMatchData>;
  isLive: boolean;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isEventType(value: string): value is EventType {
  return PLAYER_EVENT_TYPES.has(value as EventType);
}

/**
 * bonus_malus è un array {type, count, minute}. Ogni bonus diventa `count` eventi.
 * goal_conceded del portiere diventa un gol con relatedPlayerId 'opponent',
 * così calculateTeamScore lo conta come gol subito e non come bonus gol.
 */
export function bonusMalusToEvents(playerId: string, bonusMalus: unknown): PlayerEvent[] {
  if (!Array.isArray(bonusMalus)) return [];

  const events: PlayerEvent[] = [];
  for (const raw of bonusMalus) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as { type?: unknown; count?: unknown; minute?: unknown };
    if (typeof item.type !== 'string') continue;

    const countValue = finiteNumber(item.count);
    const count = Math.max(0, Math.trunc(countValue ?? 1));
    const minute = finiteNumber(item.minute) ?? 0;

    if (item.type === 'goal_conceded') {
      for (let index = 0; index < count; index += 1) {
        events.push({
          playerId,
          type: 'goal',
          minute,
          relatedPlayerId: 'opponent',
        });
      }
      continue;
    }

    if (!isEventType(item.type)) continue;
    for (let index = 0; index < count; index += 1) {
      events.push({
        playerId,
        type: item.type,
        minute,
      });
    }
  }

  return events;
}

function officialVoteToPlayerMatchData(row: OfficialVoteRow): PlayerMatchData | null {
  const estimatedVote = finiteNumber(row.vote_fantacalcio);
  if (estimatedVote == null) return null;

  const minutes = finiteNumber(row.minutes_played);
  return {
    playerId: row.player_id,
    estimatedVote,
    minutesPlayed: minutes ?? 90,
    isPlaying: false,
    events: bonusMalusToEvents(row.player_id, row.bonus_malus),
  };
}

function pickLatestLiveVotes(rows: readonly LiveVoteRow[]): LiveVoteRow[] {
  const byPlayer = new Map<string, LiveVoteRow>();
  for (const row of rows) {
    const current = byPlayer.get(row.player_id);
    if (!current) {
      byPlayer.set(row.player_id, row);
      continue;
    }
    const currentTime = Date.parse(current.updated_at ?? '') || 0;
    const nextTime = Date.parse(row.updated_at ?? '') || 0;
    if (nextTime >= currentTime) byPlayer.set(row.player_id, row);
  }
  return [...byPlayer.values()];
}

function liveEventsByPlayer(rows: readonly LiveEventRow[]): Map<string, PlayerEvent[]> {
  const grouped = new Map<string, PlayerEvent[]>();
  for (const row of rows) {
    if (!isEventType(row.event_type)) continue;
    const events = grouped.get(row.player_id) ?? [];
    events.push({
      playerId: row.player_id,
      type: row.event_type,
      minute: finiteNumber(row.minute) ?? 0,
      ...(row.related_player_id ? { relatedPlayerId: row.related_player_id } : {}),
    });
    grouped.set(row.player_id, events);
  }
  return grouped;
}

export function assembleRoundPlayerData(
  officialVotes: readonly OfficialVoteRow[],
  liveVotes: readonly LiveVoteRow[],
  liveEvents: readonly LiveEventRow[]
): Map<string, PlayerMatchData> {
  const playerData = new Map<string, PlayerMatchData>();

  for (const row of officialVotes) {
    const data = officialVoteToPlayerMatchData(row);
    if (data) playerData.set(data.playerId, data);
  }

  const eventsByPlayer = liveEventsByPlayer(liveEvents);
  for (const row of pickLatestLiveVotes(liveVotes)) {
    if (playerData.has(row.player_id)) continue;
    playerData.set(row.player_id, {
      playerId: row.player_id,
      estimatedVote: finiteNumber(row.estimated_vote),
      minutesPlayed: finiteNumber(row.minutes_played) ?? 0,
      isPlaying: row.is_playing === true,
      events: eventsByPlayer.get(row.player_id) ?? [],
    });
    eventsByPlayer.delete(row.player_id);
  }

  for (const [playerId, events] of eventsByPlayer) {
    if (playerData.has(playerId)) continue;
    playerData.set(playerId, {
      playerId,
      estimatedVote: null,
      minutesPlayed: 0,
      isPlaying: false,
      events,
    });
  }

  return playerData;
}

export function isRoundLive(
  liveVotes: readonly { is_playing: boolean | null }[],
  matches: readonly { status: string }[]
): boolean {
  return (
    liveVotes.some((vote) => vote.is_playing === true) ||
    matches.some((match) => match.status === 'live' || match.status === 'halftime')
  );
}

function assertQuery<T>(label: string, result: { data: T[] | null; error: { message: string } | null }): T[] {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data ?? [];
}

export async function getRoundPlayerState(roundNumber: number): Promise<RoundPlayerState> {
  const supabase = getServerClient();
  const [officialResult, liveVotesResult, liveEventsResult, matchesResult] = await Promise.all([
    supabase
      .from('official_votes')
      .select('player_id, vote_fantacalcio, minutes_played, bonus_malus')
      .eq('round_number', roundNumber),
    supabase
      .from('live_votes')
      .select('player_id, estimated_vote, minutes_played, is_playing, updated_at, source_provider')
      .eq('round_number', roundNumber),
    supabase
      .from('live_events')
      .select('player_id, event_type, minute, related_player_id')
      .eq('round_number', roundNumber)
      .order('minute'),
    supabase
      .from('serie_a_matches')
      .select('status')
      .eq('round_number', roundNumber),
  ]);

  const officialVotes = assertQuery<OfficialVoteRow>('official_votes', officialResult);
  const liveVotes = assertQuery<LiveVoteRow>('live_votes', liveVotesResult);
  const liveEvents = assertQuery<LiveEventRow>('live_events', liveEventsResult);
  const matches = assertQuery<SerieAMatchStatusRow>('serie_a_matches', matchesResult);

  return {
    playerData: assembleRoundPlayerData(officialVotes, liveVotes, liveEvents),
    isLive: isRoundLive(liveVotes, matches),
  };
}

export async function getRoundPlayerData(
  roundNumber: number
): Promise<Map<string, PlayerMatchData>> {
  const state = await getRoundPlayerState(roundNumber);
  return state.playerData;
}
