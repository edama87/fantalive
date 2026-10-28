/**
 * Voti di giornata per lo scoring, in ordine di priorità:
 * 1. official_votes con source 'pianetafanta' (consolidati: media G/CS/TS);
 * 2. official_votes fantacalcio.it (voto puro + bonus, provvisorio);
 * 3. solo per chi non ha voto ufficiale, live_votes + live_events (stima).
 */

import { getServerClient } from '@/lib/db/supabase';
import { masterVote } from '@/lib/vote-precision';
import { missingOutlets, type PianetafantaOutlet } from '@/lib/pianetafanta';
import { canonicalTeamCode } from '@/lib/fantacalcio-it';
import type { EventType, PlayerEvent, PlayerMatchData } from '@/types';
import { fixtureFromRow, teamStatusesFromFixtures, type RoundFixture, type SerieAMatchRow } from '@/lib/serie-a-fixtures';

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
  /** Media dei voti di testata (Gazzetta/Corriere/Tuttosport), vedi migrazione pianetafanta. */
  vote_average?: number | string | null;
  vote_gazzetta?: number | string | null;
  vote_corriere?: number | string | null;
  vote_tuttosport?: number | string | null;
  /** 'fantacalcio' (default) o 'pianetafanta' (consolidato). */
  source?: string | null;
  minutes_played: number | string | null;
  bonus_malus: unknown;
  /** Solo righe source 'fms' (import FMS Revo, vedi migrazione fms_official_votes). */
  vote_fms?: number | string | null;
  fms_bonus?: number | string | null;
}

export interface LiveVoteRow {
  player_id: string;
  estimated_vote: number | string | null;
  minutes_played: number | string | null;
  is_playing: boolean | null;
  is_subbed_out?: boolean | null;
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
  /** Partite di Serie A della giornata (serie_a_matches). */
  fixtures: RoundFixture[];
  /** Giornata chiusa: import voti FMS confermato (risultati definitivi). */
  closed: boolean;
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

/**
 * Media consolidata a 3 decimali (come FMS) dai soli voti di testata.
 */
export function consolidatedVote(
  row: Pick<OfficialVoteRow, 'vote_gazzetta' | 'vote_corriere' | 'vote_tuttosport'>,
  gazzettaPublished = true
): number | null {
  // Solo voti di testata: senza nessuno è s.v. Mai vote_average, che nel DB
  // ripiega sul voto fantacalcio.it rimasto dalla riga live. Gazzetta master:
  // s.v. Gazzetta in una partita votata dalla Gazzetta = senza voto.
  return masterVote(
    {
      gazzetta: finiteNumber(row.vote_gazzetta ?? null),
      corriere: finiteNumber(row.vote_corriere ?? null),
      tuttosport: finiteNumber(row.vote_tuttosport ?? null),
    },
    gazzettaPublished
  );
}

function officialVoteToPlayerMatchData(row: OfficialVoteRow, info?: MatchPaperInfo): PlayerMatchData | null {
  const minutes = finiteNumber(row.minutes_played);
  const events = bonusMalusToEvents(row.player_id, row.bonus_malus);

  if (row.source === 'fms') {
    // Voto FMS Revo importato: voto (null = s.v.) e totale bonus/malus FMS.
    return {
      playerId: row.player_id,
      estimatedVote: finiteNumber(row.vote_fms ?? null),
      minutesPlayed: minutes ?? 0,
      isPlaying: false,
      events,
      voteSource: 'consolidated',
      bonusOverride: finiteNumber(row.fms_bonus ?? null) ?? 0,
    };
  }

  if (row.source === 'pianetafanta') {
    // Consolidato: media dei voti di testata presenti. Senza nessun voto è un
    // s.v. definitivo (nessuna stima live lo sostituisce).
    return {
      playerId: row.player_id,
      // Senza info sulla partita (import mancante) vale la Gazzetta master.
      estimatedVote: consolidatedVote(row, info ? info.gazzetta : true),
      minutesPlayed: minutes ?? 0,
      isPlaying: false,
      events,
      voteSource: 'consolidated',
    };
  }

  // Voto null = s.v. di fantacalcio.it per un giocatore entrato: niente stima
  // ESPN (a partita in corso la stima live resta, vedi assembleRoundPlayerData).
  const estimatedVote = finiteNumber(row.vote_fantacalcio);
  return {
    playerId: row.player_id,
    estimatedVote,
    minutesPlayed: minutes ?? 90,
    isPlaying: false,
    events,
    voteSource: 'official',
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
      // Gol con related_player_id = se stesso = gol subito dal portiere (il cron
      // non può salvare 'opponent' per la FK su players).
      ...(row.related_player_id
        ? {
            relatedPlayerId:
              row.event_type === 'goal' && row.related_player_id === row.player_id
                ? 'opponent'
                : row.related_player_id,
          }
        : {}),
    });
    grouped.set(row.player_id, events);
  }
  return grouped;
}

export interface ConsolidatedCoverage {
  /** Codici squadra (INT, VEN, ...) delle partite con voti consolidati importati. */
  teams: ReadonlySet<string>;
  /** Squadra reale di ogni giocatore (id -> nome o codice). */
  playerTeams: ReadonlyMap<string, string | null>;
}

/** Giocatore di una partita già consolidata: se non è nel file non ha voto (s.v.), niente stime live. */
function coveredByConsolidated(playerId: string, coverage?: ConsolidatedCoverage): boolean {
  if (!coverage || coverage.teams.size === 0) return false;
  const team = canonicalTeamCode(coverage.playerTeams.get(playerId) ?? null);
  return team != null && coverage.teams.has(team);
}

export interface ConsolidatedImportRow {
  home_team: string | null;
  away_team: string | null;
  players?: Array<{
    playerId?: string | null;
    excluded?: boolean;
    votes?: Partial<Record<PianetafantaOutlet, number | null>> | null;
  }> | null;
}

/**
 * Testate uscite per ogni partita consolidata (3 - testate mancanti per tutta la
 * partita), assegnate a ogni giocatore di quella partita. Un s.v. del singolo
 * (ha giocato poco) non conta: conta solo se la testata manca a tutti.
 */
export interface MatchPaperInfo {
  /** Testate (0-3) uscite per la partita. */
  papers: number;
  /** La Gazzetta ha pubblicato i voti della partita (Gazzetta master). */
  gazzetta: boolean;
}

export function matchPaperCounts(imports: readonly ConsolidatedImportRow[]): Map<string, MatchPaperInfo> {
  const counts = new Map<string, MatchPaperInfo>();
  for (const row of imports) {
    const players = (row.players ?? []).filter((p) => !p.excluded);
    const missing = missingOutlets(players);
    const info = { papers: 3 - missing.length, gazzetta: !missing.includes('gazzetta') };
    for (const p of players) if (p.playerId) counts.set(p.playerId, info);
  }
  return counts;
}

export function assembleRoundPlayerData(
  officialVotes: readonly OfficialVoteRow[],
  liveVotes: readonly LiveVoteRow[],
  liveEvents: readonly LiveEventRow[],
  coverage?: ConsolidatedCoverage,
  matchPapers?: ReadonlyMap<string, MatchPaperInfo>
): Map<string, PlayerMatchData> {
  const playerData = new Map<string, PlayerMatchData>();

  for (const row of officialVotes) {
    const info = matchPapers?.get(row.player_id);
    const data = officialVoteToPlayerMatchData(row, info);
    if (!data) continue;
    if (data.voteSource === 'consolidated' && info) data.paperCount = info.papers;
    playerData.set(data.playerId, data);
  }

  const eventsByPlayer = liveEventsByPlayer(liveEvents);
  for (const row of pickLatestLiveVotes(liveVotes)) {
    const existing = playerData.get(row.player_id);
    // s.v. provvisorio di chi è ancora in campo: vale il feed live.
    const svStillPlaying =
      existing?.voteSource === 'official' && existing.estimatedVote == null && row.is_playing === true && row.is_subbed_out !== true;
    if (existing && !svStillPlaying) {
      // Voto fantacalcio.it durante la partita: lo stato in campo e i minuti
      // restano quelli del feed live (ESPN), che li azzera a fine partita o
      // dopo un cambio. Un espulso non è più in campo.
      if (existing.voteSource === 'official') {
        const sentOff = existing.events.some((e) => e.type === 'red_card');
        existing.isPlaying = row.is_playing === true && row.is_subbed_out !== true && !sentOff;
        const liveMinutes = finiteNumber(row.minutes_played);
        const officialMinutes = officialVotes.find((o) => o.player_id === row.player_id)?.minutes_played;
        if (existing.isPlaying && liveMinutes != null && finiteNumber(officialMinutes ?? null) == null) existing.minutesPlayed = liveMinutes;
      }
      continue;
    }
    if (coveredByConsolidated(row.player_id, coverage)) continue;
    playerData.set(row.player_id, {
      playerId: row.player_id,
      estimatedVote: finiteNumber(row.estimated_vote),
      minutesPlayed: finiteNumber(row.minutes_played) ?? 0,
      isPlaying: row.is_playing === true,
      events: eventsByPlayer.get(row.player_id) ?? [],
      voteSource: 'live',
    });
    eventsByPlayer.delete(row.player_id);
  }

  for (const [playerId, events] of eventsByPlayer) {
    if (playerData.has(playerId)) continue;
    if (coveredByConsolidated(playerId, coverage)) continue;
    playerData.set(playerId, {
      playerId,
      estimatedVote: null,
      minutesPlayed: 0,
      isPlaying: false,
      events,
      voteSource: 'live',
    });
  }

  return playerData;
}

/**
 * "In campo" rimasto a true dopo il fischio finale (summary ESPN in ritardo
 * sullo scoreboard nell'ultimo giro del cron): se la partita della squadra del
 * giocatore è finita, non è più in campo.
 */
export function clearFinishedIsPlaying<T extends { player_id: string; is_playing: boolean | null }>(
  liveVotes: readonly T[],
  playerTeams: ReadonlyMap<string, string | null>,
  teamStatuses: ReadonlyMap<string, string>
): T[] {
  return liveVotes.map((row) => {
    if (row.is_playing !== true) return row;
    const team = canonicalTeamCode(playerTeams.get(row.player_id) ?? null);
    return team && teamStatuses.get(team) === 'finished' ? { ...row, is_playing: false } : row;
  });
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

async function consolidatedCoverage(
  supabase: ReturnType<typeof getServerClient>,
  imports: ReadonlyArray<{ home_team: string | null; away_team: string | null }>,
  livePlayerIds: readonly string[]
): Promise<ConsolidatedCoverage | undefined> {
  const teams = new Set<string>();
  for (const row of imports) {
    for (const team of [row.home_team, row.away_team]) {
      const code = canonicalTeamCode(team);
      if (code) teams.add(code);
    }
  }
  if (teams.size === 0 || livePlayerIds.length === 0) return undefined;
  const { data, error } = await supabase.from('players').select('id, real_team').in('id', livePlayerIds);
  if (error) throw new Error(`players: ${error.message}`);
  return {
    teams,
    playerTeams: new Map((data ?? []).map((row) => [row.id as string, (row.real_team as string | null) ?? null])),
  };
}

export async function getRoundPlayerState(roundNumber: number): Promise<RoundPlayerState> {
  const supabase = getServerClient();
  const [officialResult, liveVotesResult, liveEventsResult, matchesResult, importsResult, fmsImportsResult] = await Promise.all([
    supabase
      .from('official_votes')
      .select('*')
      .eq('round_number', roundNumber),
    supabase
      .from('live_votes')
      .select('player_id, estimated_vote, minutes_played, is_playing, is_subbed_out, updated_at, source_provider')
      .eq('round_number', roundNumber),
    supabase
      .from('live_events')
      .select('player_id, event_type, minute, related_player_id')
      .eq('round_number', roundNumber)
      .order('minute'),
    supabase
      .from('serie_a_matches')
      .select('id, home_team, away_team, home_score, away_score, status, minute, kickoff_time')
      .eq('round_number', roundNumber)
      .order('kickoff_time'),
    supabase
      .from('official_vote_imports')
      .select('home_team, away_team, players')
      .eq('round_number', roundNumber)
      .eq('source', 'pianetafanta'),
    supabase
      .from('official_vote_imports')
      .select('round_number', { count: 'exact', head: true })
      .eq('round_number', roundNumber)
      .eq('source', 'fms'),
  ]);
  const closed = !fmsImportsResult.error && (fmsImportsResult.count ?? 0) > 0;

  const officialVotes = assertQuery<OfficialVoteRow>('official_votes', officialResult);
  const liveEvents = assertQuery<LiveEventRow>('live_events', liveEventsResult);
  const matches = assertQuery<SerieAMatchRow>('serie_a_matches', matchesResult);
  let liveVotes = assertQuery<LiveVoteRow>('live_votes', liveVotesResult);
  const playingIds = liveVotes.filter((row) => row.is_playing === true).map((row) => row.player_id);
  if (playingIds.length > 0 && matches.some((m) => m.status === 'finished')) {
    const { data: teams } = await supabase.from('players').select('id, real_team').in('id', playingIds);
    liveVotes = clearFinishedIsPlaying(
      liveVotes,
      new Map((teams ?? []).map((row) => [row.id as string, (row.real_team as string | null) ?? null])),
      teamStatusesFromFixtures(matches.map(fixtureFromRow))
    );
  }

  const imports = assertQuery<ConsolidatedImportRow>(
    'official_vote_imports',
    importsResult
  );
  const coverage = await consolidatedCoverage(supabase, imports, [
    ...new Set([...liveVotes.map((row) => row.player_id), ...liveEvents.map((row) => row.player_id)]),
  ]);

  return {
    playerData: assembleRoundPlayerData(officialVotes, liveVotes, liveEvents, coverage, matchPaperCounts(imports)),
    // Chiusa: niente più live, partite tutte finite.
    isLive: closed ? false : isRoundLive(liveVotes, matches),
    fixtures: matches.map(fixtureFromRow).map((f) => (closed ? { ...f, status: 'finished' as const } : f)),
    closed,
  };
}

export async function getRoundPlayerData(
  roundNumber: number
): Promise<Map<string, PlayerMatchData>> {
  const state = await getRoundPlayerState(roundNumber);
  return state.playerData;
}
