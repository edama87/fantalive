/**
 * Parsing puro dei dati ESPN (calcio, ita.1) per il live:
 * - scoreboard -> partite di Serie A con codice squadra (FRO, SAS, ...)
 * - summary -> giocatori (rosters[].roster[]) ed eventi (keyEvents[])
 *
 * La summary del calcio NON ha boxscore.players né plays: minuti, titolari e
 * cambi stanno in rosters, gol/cartellini/rigori in keyEvents.
 */

import type { EventType, MatchStatus, PlayerRole } from '@/types';
import type {
  NormalizedPlayerData,
  NormalizedPlayerEvent,
  NormalizedSerieAMatch,
} from '@/providers/types';
import {
  canonicalTeamCode,
  matchFantacalcioPlayer,
  normalizePlayerName,
  type FantacalcioAlias,
  type FantacalcioCatalogPlayer,
} from '@/lib/fantacalcio-it';

// ---------------------------------------------------------------------------
// Squadre

const ESPN_TEAM_NAMES: Record<string, string> = {
  'inter milan': 'Inter',
  internazionale: 'Inter',
  'fc internazionale milano': 'Inter',
  'ac milan': 'Milan',
  'juventus fc': 'Juventus',
  'as roma': 'Roma',
  'ss lazio': 'Lazio',
  'ssc napoli': 'Napoli',
  'atalanta bc': 'Atalanta',
  'acf fiorentina': 'Fiorentina',
  'bologna fc 1909': 'Bologna',
  'bologna fc': 'Bologna',
  'torino fc': 'Torino',
  'udinese calcio': 'Udinese',
  'us sassuolo calcio': 'Sassuolo',
  'us lecce': 'Lecce',
  'cagliari calcio': 'Cagliari',
  'hellas verona fc': 'Verona',
  'ac monza': 'Monza',
  'genoa cfc': 'Genoa',
  'como 1907': 'Como',
  'parma calcio 1913': 'Parma',
  'venezia fc': 'Venezia',
  'frosinone calcio': 'Frosinone',
};

/** Nome ESPN -> nome breve italiano usato in serie_a_matches ("AS Roma" -> "Roma"). */
export function normalizeEspnTeamName(espnName: string): string {
  const key = espnName.trim().toLowerCase();
  return ESPN_TEAM_NAMES[key] ?? espnName.replace(/ FC$| Calcio$| BC$/g, '').trim();
}

/** Nome squadra (ESPN o breve) -> codice FMS/fantacalcio ("Internazionale" -> "INT"). */
export function espnTeamCode(name: string | null | undefined): string | null {
  if (!name) return null;
  return canonicalTeamCode(normalizeEspnTeamName(name));
}

// ---------------------------------------------------------------------------
// Tipi ESPN (solo i campi usati)

interface EspnTeamRef {
  id?: string;
  displayName?: string;
  abbreviation?: string;
}

interface EspnStatusType {
  name?: string;
  state?: string;
  completed?: boolean;
}

export interface EspnScoreboardEvent {
  id: string;
  date?: string;
  status?: { type?: EspnStatusType; displayClock?: string; clock?: number };
  competitions?: Array<{
    venue?: { fullName?: string };
    status?: { type?: EspnStatusType; displayClock?: string; clock?: number };
    competitors?: Array<{
      homeAway?: 'home' | 'away';
      score?: string;
      team?: EspnTeamRef;
    }>;
  }>;
}

export interface EspnScoreboard {
  events?: EspnScoreboardEvent[];
}

interface EspnAthleteRef {
  id?: string;
  displayName?: string;
  fullName?: string;
  shortName?: string;
}

interface EspnRosterEntry {
  starter?: boolean;
  subbedIn?: boolean | { didSub?: boolean };
  subbedOut?: boolean | { didSub?: boolean };
  athlete?: EspnAthleteRef;
  position?: { abbreviation?: string; name?: string };
  stats?: Array<{ name?: string; value?: number }>;
}

interface EspnRoster {
  homeAway?: 'home' | 'away';
  team?: EspnTeamRef;
  roster?: EspnRosterEntry[];
}

export interface EspnKeyEvent {
  id?: string;
  type?: { type?: string; text?: string };
  text?: string;
  clock?: { value?: number; displayValue?: string };
  period?: { number?: number };
  team?: EspnTeamRef;
  participants?: Array<{ athlete?: EspnAthleteRef }>;
  scoringPlay?: boolean;
}

export interface EspnSummary {
  rosters?: EspnRoster[];
  keyEvents?: EspnKeyEvent[];
  header?: {
    competitions?: Array<{
      status?: { type?: EspnStatusType; displayClock?: string; clock?: number };
    }>;
  };
}

// ---------------------------------------------------------------------------
// Stato partita

export function parseEspnMatchStatus(type: EspnStatusType | undefined): MatchStatus {
  if (!type) return 'scheduled';
  const name = (type.name ?? '').toUpperCase();
  if (name.includes('HALFTIME')) return 'halftime';
  if (type.completed) return 'finished';
  switch ((type.state ?? '').toLowerCase()) {
    case 'in':
      return 'live';
    case 'post':
      // post ma non completed = rinviata/sospesa: non la consideriamo giocata
      return name.includes('FULL_TIME') || name.includes('FINAL') ? 'finished' : 'scheduled';
    default:
      return 'scheduled';
  }
}

export function parseClockMinute(display: string | undefined, seconds?: number): number {
  if (display) {
    const match = display.match(/(\d+)/);
    if (match) return Number.parseInt(match[1], 10);
  }
  return typeof seconds === 'number' && Number.isFinite(seconds) ? Math.floor(seconds / 60) : 0;
}

export function parseEspnScoreboard(scoreboard: EspnScoreboard): NormalizedSerieAMatch[] {
  const matches: NormalizedSerieAMatch[] = [];
  for (const event of scoreboard.events ?? []) {
    const competition = event.competitions?.[0];
    const home = competition?.competitors?.find((c) => c.homeAway === 'home');
    const away = competition?.competitors?.find((c) => c.homeAway === 'away');
    if (!competition || !home?.team?.displayName || !away?.team?.displayName) continue;
    const status = event.status ?? competition.status;
    matches.push({
      matchId: event.id,
      homeTeam: normalizeEspnTeamName(home.team.displayName),
      awayTeam: normalizeEspnTeamName(away.team.displayName),
      homeScore: Number.parseInt(home.score ?? '0', 10) || 0,
      awayScore: Number.parseInt(away.score ?? '0', 10) || 0,
      minute: parseClockMinute(status?.displayClock, status?.clock),
      displayClock: status?.displayClock,
      status: parseEspnMatchStatus(status?.type),
      kickoffTime: event.date,
      venue: competition.venue?.fullName,
    });
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Abbinamento nomi ESPN -> giocatori DB

export interface UnmatchedEspnPlayer {
  name: string;
  team: string | null;
}

export type EspnPlayerMatcher = (name: string, teamCode: string | null, role?: PlayerRole | null) => string | null;

/**
 * Usa lo stesso abbinamento di fantacalcio.it (accenti, cognome-nome tipo
 * "CALO' Giacomo", alias da player_aliases) ristretto alla squadra di Serie A.
 */
export function createEspnPlayerMatcher(
  players: readonly FantacalcioCatalogPlayer[],
  aliases: readonly FantacalcioAlias[] = []
): EspnPlayerMatcher {
  const cache = new Map<string, string | null>();
  return (name, teamCode, role) => {
    const key = `${teamCode ?? ''}|${name}`;
    if (cache.has(key)) return cache.get(key) ?? null;
    const hit = matchFantacalcioPlayer(name, players, aliases, { realTeam: teamCode, role: role ?? null });
    let id = hit?.playerId ?? null;
    // Cognomi composti ("Romano Floriani" -> "FLORIANI MUSSOLINI Romano"):
    // tutte le parole ESPN presenti nel nome DB, stessa squadra, risultato univoco.
    if (!id && teamCode) id = tokenSubsetMatch(name, players.filter((p) => canonicalTeamCode(p.realTeam) === teamCode));
    // Giocatore appena trasferito e non aggiornato nel DB: riprova senza squadra
    // solo se il risultato è univoco.
    if (!id && teamCode) id = matchFantacalcioPlayer(name, players, aliases, { role: role ?? null })?.playerId ?? null;
    cache.set(key, id);
    return id;
  };
}

/**
 * Solo il portiere è affidabile nelle posizioni ESPN (G); per gli altri
 * ruoli non passiamo nulla all'abbinamento per non falsare gli spareggi.
 */
function nameTokens(value: string): string[] {
  return normalizePlayerName(value).split(' ').filter((token) => token.length > 1);
}

function tokenSubsetMatch(name: string, players: readonly FantacalcioCatalogPlayer[]): string | null {
  const wanted = nameTokens(name);
  if (wanted.length < 2) return null;
  const hits = players.filter((player) => {
    const tokens = new Set(nameTokens(player.name));
    return wanted.every((token) => tokens.has(token));
  });
  return hits.length === 1 ? hits[0].id : null;
}

function espnRole(entry: EspnRosterEntry): PlayerRole | null {
  const abbr = (entry.position?.abbreviation ?? '').toUpperCase();
  const name = (entry.position?.name ?? '').toLowerCase();
  if (abbr === 'G' || abbr === 'GK' || name === 'goalkeeper') return 'P';
  return null;
}

// ---------------------------------------------------------------------------
// Summary -> giocatori ed eventi

function didSub(value: EspnRosterEntry['subbedIn']): boolean {
  if (typeof value === 'boolean') return value;
  return Boolean(value?.didSub);
}

function athleteName(athlete: EspnAthleteRef | undefined): string | null {
  return athlete?.displayName || athlete?.fullName || athlete?.shortName || null;
}

function nameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type KeyEventKind =
  | 'goal'
  | 'penalty_scored'
  | 'penalty_missed'
  | 'penalty_saved'
  | 'own_goal'
  | 'yellow_card'
  | 'red_card'
  | 'substitution'
  | null;

export function classifyKeyEvent(event: EspnKeyEvent): KeyEventKind {
  const type = (event.type?.type ?? '').toLowerCase();
  const text = (event.type?.text ?? '').toLowerCase();
  const both = `${type} ${text}`;
  if (type === 'substitution') return 'substitution';
  if (both.includes('own-goal') || both.includes('own goal')) return 'own_goal';
  if (both.includes('penalty')) {
    if (both.includes('saved')) return 'penalty_saved';
    if (both.includes('missed')) return 'penalty_missed';
    if (both.includes('scored') || event.scoringPlay) return 'penalty_scored';
    return null;
  }
  if (type.startsWith('goal') || (event.scoringPlay && both.includes('goal'))) return 'goal';
  if (both.includes('red') || both.includes('second yellow')) return 'red_card';
  if (both.includes('yellow')) return 'yellow_card';
  return null;
}

interface RosterPlayer {
  key: string;
  name: string;
  teamId: string;
  teamCode: string | null;
  role: PlayerRole | null;
  starter: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
  onAt: number | null;
  offAt: number | null;
  playerId: string | null;
  events: NormalizedPlayerEvent[];
}

export interface ParsedEspnSummary {
  players: NormalizedPlayerData[];
  unmatched: UnmatchedEspnPlayer[];
  status: MatchStatus;
  minute: number;
}

/**
 * Voto stimato (marcato come stimato in live_votes):
 * base 6 con >= 45', 5.5 sotto; +1 gol, +0.5 rigore segnato, +0.5 assist,
 * -1 autogol, -1.5 rigore sbagliato, -0.5 giallo, -1 rosso, +1 rigore parato,
 * -0.5 per gol subito del portiere. Limiti 4-10, arrotondato al mezzo voto.
 */
export function estimateEspnVote(minutes: number, events: readonly NormalizedPlayerEvent[], played: boolean): number | null {
  if (!played) return null;
  let vote = minutes >= 45 ? 6 : 5.5;
  for (const event of events) {
    switch (event.type) {
      case 'goal':
        vote += event.relatedPlayerId === 'opponent' ? -0.5 : 1;
        break;
      case 'penalty_scored':
        vote += 0.5;
        break;
      case 'assist':
        vote += 0.5;
        break;
      case 'own_goal':
        vote -= 1;
        break;
      case 'penalty_missed':
        vote -= 1.5;
        break;
      case 'yellow_card':
        vote -= 0.5;
        break;
      case 'red_card':
        vote -= 1;
        break;
      case 'penalty_saved':
        vote += 1;
        break;
    }
  }
  vote = Math.max(4, Math.min(10, vote));
  return Math.round(vote * 2) / 2;
}

export function parseEspnSummary(
  summary: EspnSummary,
  matchPlayer: EspnPlayerMatcher,
  fallback?: { status?: MatchStatus; minute?: number }
): ParsedEspnSummary {
  const headerStatus = summary.header?.competitions?.[0]?.status;
  const status = headerStatus?.type ? parseEspnMatchStatus(headerStatus.type) : fallback?.status ?? 'scheduled';
  const liveMinute = parseClockMinute(headerStatus?.displayClock, headerStatus?.clock) || fallback?.minute || 0;
  const endMinute = status === 'finished' ? 90 : Math.max(1, Math.min(liveMinute, 90));

  const roster: RosterPlayer[] = [];
  const byTeamAndName = new Map<string, RosterPlayer>();
  const teamIds: string[] = [];

  for (const team of summary.rosters ?? []) {
    const teamId = team.team?.id ?? team.team?.displayName ?? '';
    teamIds.push(teamId);
    const teamCode = espnTeamCode(team.team?.displayName);
    for (const entry of team.roster ?? []) {
      const name = athleteName(entry.athlete);
      if (!name) continue;
      const player: RosterPlayer = {
        key: nameKey(name),
        name,
        teamId,
        teamCode,
        role: espnRole(entry),
        starter: entry.starter === true,
        subbedIn: didSub(entry.subbedIn),
        subbedOut: didSub(entry.subbedOut),
        onAt: entry.starter === true ? 0 : null,
        offAt: null,
        playerId: null,
        events: [],
      };
      roster.push(player);
      byTeamAndName.set(`${teamId}|${player.key}`, player);
      if (entry.athlete?.id) byTeamAndName.set(`${teamId}|id:${entry.athlete.id}`, player);
    }
  }

  const findRosterPlayer = (teamId: string | undefined, athlete: EspnAthleteRef | undefined): RosterPlayer | null => {
    if (!athlete) return null;
    const teams = teamId ? [teamId, ...teamIds.filter((id) => id !== teamId)] : teamIds;
    for (const id of teams) {
      if (athlete.id) {
        const hit = byTeamAndName.get(`${id}|id:${athlete.id}`);
        if (hit) return hit;
      }
      const name = athleteName(athlete);
      if (name) {
        const hit = byTeamAndName.get(`${id}|${nameKey(name)}`);
        if (hit) return hit;
      }
    }
    return null;
  };

  const otherTeam = (teamId: string | undefined): string | undefined =>
    teamIds.find((id) => id !== teamId);

  const keeperOnPitch = (teamId: string | undefined, minute: number): RosterPlayer | null => {
    const keepers = roster.filter((p) => p.teamId === teamId && p.role === 'P' && p.onAt != null);
    return (
      keepers.find((p) => (p.onAt ?? 0) <= minute && (p.offAt == null || p.offAt >= minute)) ??
      keepers[0] ??
      null
    );
  };

  const events = [...(summary.keyEvents ?? [])].sort(
    (a, b) => (a.clock?.value ?? 0) - (b.clock?.value ?? 0)
  );

  // 1) cambi ed espulsioni per calcolare i minuti
  for (const event of events) {
    const kind = classifyKeyEvent(event);
    const minute = parseClockMinute(event.clock?.displayValue, event.clock?.value);
    if (kind === 'substitution') {
      const incoming = findRosterPlayer(event.team?.id, event.participants?.[0]?.athlete);
      const outgoing = findRosterPlayer(event.team?.id, event.participants?.[1]?.athlete);
      if (incoming) incoming.onAt = minute;
      if (outgoing) outgoing.offAt = minute;
    } else if (kind === 'red_card') {
      const sent = findRosterPlayer(event.team?.id, event.participants?.[0]?.athlete);
      if (sent) sent.offAt = minute;
    }
  }
  for (const player of roster) {
    if (player.subbedIn && player.onAt == null) player.onAt = endMinute;
  }

  // 2) gol, rigori, cartellini
  const push = (player: RosterPlayer | null, type: EventType, minute: number, relatedPlayerId?: string) => {
    if (!player) return;
    player.events.push({
      playerId: '',
      playerName: player.name,
      type,
      minute,
      ...(relatedPlayerId ? { relatedPlayerId } : {}),
    });
  };

  for (const event of events) {
    const kind = classifyKeyEvent(event);
    if (!kind || kind === 'substitution') continue;
    const minute = parseClockMinute(event.clock?.displayValue, event.clock?.value);
    const teamId = event.team?.id ?? event.team?.displayName;
    const first = event.participants?.[0]?.athlete;

    switch (kind) {
      case 'goal': {
        push(findRosterPlayer(teamId, first), 'goal', minute);
        const assist = event.participants?.[1]?.athlete;
        if (assist) push(findRosterPlayer(teamId, assist), 'assist', minute);
        push(keeperOnPitch(otherTeam(teamId), minute), 'goal', minute, 'opponent');
        break;
      }
      case 'penalty_scored':
        push(findRosterPlayer(teamId, first), 'penalty_scored', minute);
        push(keeperOnPitch(otherTeam(teamId), minute), 'goal', minute, 'opponent');
        break;
      case 'own_goal':
        // team = squadra che beneficia; l'autore è dell'altra squadra
        push(findRosterPlayer(otherTeam(teamId), first), 'own_goal', minute);
        push(keeperOnPitch(otherTeam(teamId), minute), 'goal', minute, 'opponent');
        break;
      case 'penalty_missed':
        push(findRosterPlayer(teamId, first), 'penalty_missed', minute);
        break;
      case 'penalty_saved':
        push(findRosterPlayer(teamId, first), 'penalty_missed', minute);
        push(keeperOnPitch(otherTeam(teamId), minute), 'penalty_saved', minute);
        break;
      case 'yellow_card':
        push(findRosterPlayer(teamId, first), 'yellow_card', minute);
        break;
      case 'red_card':
        push(findRosterPlayer(teamId, first), 'red_card', minute);
        break;
    }
  }

  // 3) abbinamento e output
  const players: NormalizedPlayerData[] = [];
  const unmatched: UnmatchedEspnPlayer[] = [];
  for (const player of roster) {
    const played = player.starter || player.subbedIn;
    if (!played && player.events.length === 0) continue;
    const playerId = matchPlayer(player.name, player.teamCode, player.role);
    if (!playerId) {
      unmatched.push({ name: player.name, team: player.teamCode });
      continue;
    }
    const onAt = player.onAt ?? 0;
    const offAt = player.offAt ?? endMinute;
    const minutes = played ? Math.max(1, offAt - onAt) : 0;
    const events = player.events.map((event) => ({ ...event, playerId }));
    players.push({
      playerId,
      playerName: player.name,
      realTeam: player.teamCode ?? '',
      rating: null,
      estimatedVote: estimateEspnVote(minutes, events, played),
      minutesPlayed: minutes,
      isPlaying: played && (status === 'live' || status === 'halftime') && player.offAt == null,
      isSubstitutedOut: player.subbedOut || player.offAt != null,
      events,
    });
  }

  return { players, unmatched, status, minute: liveMinute };
}

/** Date yyyymmdd da `from` (incluso) per `days` giorni. */
export function espnDateRange(fromIsoDate: string, days: number): string[] {
  const [y, m, d] = fromIsoDate.split('-').map((part) => Number.parseInt(part, 10));
  const out: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(Date.UTC(y, m - 1, d + i));
    out.push(
      `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
    );
  }
  return out;
}
