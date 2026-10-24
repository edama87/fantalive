/**
 * Fantacalcio.it calendar and votes parsing.
 *
 * On each .player-grade the site prints two numbers. CSS shows only one:
 * - if data-value does not start with "-", the text is hidden (font-size: 0)
 *   and data-value is the visible grade;
 * - if data-value starts with "-", that minus is a flag, not a negative vote,
 *   and the visible grade is the text.
 * The hidden number is a decoy (the live script only has p.vote). The visible
 * number is the pure vote. Fantavoto is the pure vote plus bonus/malus icons.
 * Rows immediately after a player whose data-r starts with 1 or 2 are hidden
 * decoys and are ignored.
 */

import { roundScore } from '@/lib/vote-precision';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { EventType, PlayerRole } from '@/types';
import { getLeagueRules } from '@/lib/league-rules';

export const FANTACALCIO_ORIGIN = 'https://www.fantacalcio.it';
export const FANTACALCIO_ALIAS_SOURCE = 'fantacalcio';

const SERIE_A_TEAM_CODES: Record<string, string> = {
  atalanta: 'ATA',
  bologna: 'BOL',
  cagliari: 'CAG',
  como: 'COM',
  fiorentina: 'FIO',
  frosinone: 'FRO',
  genoa: 'GEN',
  inter: 'INT',
  juventus: 'JUV',
  lazio: 'LAZ',
  lecce: 'LEC',
  milan: 'MIL',
  monza: 'MON',
  napoli: 'NAP',
  parma: 'PAR',
  roma: 'ROM',
  sassuolo: 'SAS',
  torino: 'TOR',
  udinese: 'UDI',
  venezia: 'VEN',
};

const NAME_PARTICLES = new Set([
  'de', 'di', 'del', 'della', 'dei', 'degli', 'da', 'dos', 'do',
  'van', 'von', 'der', 'den', 'la', 'le', 'st',
]);

export type FantacalcioBonusType =
  | 'goal'
  | 'penalty_scored'
  | 'penalty_missed'
  | 'penalty_saved'
  | 'assist'
  | 'own_goal'
  | 'yellow_card'
  | 'red_card'
  | 'goal_conceded';

export interface FantacalcioBonus {
  type: FantacalcioBonusType;
  label: string;
  count: number;
  minute: number | null;
}

export interface FantacalcioCalendarMatch {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: 'scheduled' | 'live' | 'halftime' | 'finished';
  minute: number;
  /** Minuto live da ESPN ("83′", "45′+2"). */
  clock?: string;
  kickoffTime?: string;
  venue?: string;
  matchUrl: string;
  votesUrl: string;
}

export interface FantacalcioVotePlayer {
  name: string;
  role: PlayerRole | null;
  team: string;
  vote: number | null;
  hiddenGrade: number | null;
  fantaVote: number | null;
  bonuses: FantacalcioBonus[];
  substitutedOut: boolean;
  sourcePlayerId: string | null;
  /** Minuti di ingresso/uscita quando la fonte li fornisce (file live fantacalcio.it). */
  substitution?: { in?: number | null; out?: number | null };
  /** Senza voto dichiarato dalla fonte (file live: voto 55 = s.v.). */
  noGrade?: boolean;
}

export interface FantacalcioCatalogPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  realTeam: string | null;
}

export interface FantacalcioAlias {
  alias: string;
  playerId: string;
  source: string;
}

export interface FantacalcioMatchContext {
  role?: PlayerRole | null;
  realTeam?: string | null;
}

export function fantacalcioCalendarUrl(matchday: number): string {
  return `${FANTACALCIO_ORIGIN}/serie-a/calendario/${matchday}`;
}

export function canonicalTeamCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (Object.values(SERIE_A_TEAM_CODES).includes(upper)) return upper;
  const key = normalizePlayerName(trimmed);
  return SERIE_A_TEAM_CODES[key] ?? upper;
}

export function normalizePlayerName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/\./g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseItalianGrade(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, '').replace(',', '.');
  if (!cleaned || cleaned === '-' || cleaned === '--') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Visible grade on fantacalcio.it. The other number is the CSS-hidden decoy.
 */
export function resolveVisibleVote(
  dataValue: string | undefined,
  text: string
): { vote: number | null; hiddenGrade: number | null } {
  const raw = (dataValue ?? '').trim();
  const textVote = parseItalianGrade(text);
  if (raw.startsWith('-') && raw !== '-' && raw !== '--') {
    return {
      vote: textVote,
      hiddenGrade: parseItalianGrade(raw.slice(1)),
    };
  }
  return {
    vote: parseItalianGrade(raw),
    hiddenGrade: textVote,
  };
}

export function fantavotoFromVote(
  vote: number | null,
  bonuses: readonly FantacalcioBonus[]
): number | null {
  if (vote == null) return null;
  const count = (type: FantacalcioBonusType) =>
    bonuses.find((bonus) => bonus.type === type)?.count ?? 0;
  const r = getLeagueRules().scoring;
  let total = vote;
  total += count('goal') * r.goalBonus;
  total += count('penalty_scored') * r.penaltyGoalBonus;
  total += count('assist') * r.assistBonus;
  total += count('penalty_saved') * r.penaltySavedBonus;
  total += count('penalty_missed') * r.penaltyMissedMalus;
  total += count('own_goal') * r.ownGoalMalus;
  total += count('yellow_card') * r.yellowCardMalus;
  total += count('red_card') * r.redCardMalus;
  total += count('goal_conceded') * r.goalConcededMalus;
  // Solo pulizia dei float (6,667 + 3 = 9,667000001): le medie hanno al massimo 3 decimali.
  return roundScore(total);
}

export function bonusToEventType(type: FantacalcioBonusType): EventType | null {
  switch (type) {
    case 'goal':
      return 'goal';
    case 'penalty_scored':
      return 'penalty_scored';
    case 'penalty_missed':
      return 'penalty_missed';
    case 'penalty_saved':
      return 'penalty_saved';
    case 'assist':
      return 'assist';
    case 'own_goal':
      return 'own_goal';
    case 'yellow_card':
      return 'yellow_card';
    case 'red_card':
      return 'red_card';
    case 'goal_conceded':
      return null;
    default:
      return null;
  }
}

function mapMatchStatus(code: string | undefined): FantacalcioCalendarMatch['status'] {
  switch (code) {
    case '1':
    case '3':
    case '5':
      return 'live';
    case '2':
      return 'halftime';
    case '4':
      return 'finished';
    default:
      return 'scheduled';
  }
}

function statusMinute(status: FantacalcioCalendarMatch['status']): number {
  if (status === 'finished') return 90;
  if (status === 'halftime') return 45;
  return 0;
}

function absoluteUrl(href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return `${FANTACALCIO_ORIGIN}${href.startsWith('/') ? '' : '/'}${href}`;
}

function parseScore(raw: string): number {
  const value = Number.parseInt(raw.replace(/\s+/g, ''), 10);
  return Number.isFinite(value) ? value : 0;
}

export function parseFantacalcioCalendar(html: string): FantacalcioCalendarMatch[] {
  const $ = cheerio.load(html);
  const matches: FantacalcioCalendarMatch[] = [];

  $('ul.match-list > li.match').each((_, element) => {
    const item = $(element);
    const pill = item.find('[data-match-status]').first();
    const homeTeam = item.find('[itemprop="homeTeam"] meta[itemprop="name"]').attr('content')?.trim() || '';
    const awayTeam = item.find('[itemprop="awayTeam"] meta[itemprop="name"]').attr('content')?.trim() || '';
    const href = item.find('a.match-score').attr('href')?.trim();
    if (!homeTeam || !awayTeam || !href) return;

    const matchUrl = absoluteUrl(href.split('#')[0].replace(/\/$/, ''));
    const matchId = matchUrl.split('/').filter(Boolean).pop() || matchUrl;
    const status = mapMatchStatus(pill.attr('data-match-status'));
    const startDate = item.find('meta[itemprop="startDate"]').attr('content');
    const hours = item.find('.hours').first().text().replace(/\s+/g, ' ').trim();
    const venue = item.find('[itemprop="location"]').first().text().replace(/\s+/g, ' ').trim();

    matches.push({
      matchId,
      homeTeam,
      awayTeam,
      homeScore: parseScore(item.find('.score-home').first().text()),
      awayScore: parseScore(item.find('.score-away').first().text()),
      status,
      minute: statusMinute(status),
      kickoffTime: startDate ? `${startDate}T${hours || '00:00'}` : undefined,
      venue: venue || undefined,
      matchUrl,
      votesUrl: `${matchUrl}/voti`,
    });
  });

  return matches;
}

function bonusTypeFromLabel(label: string): FantacalcioBonusType | null {
  const normalized = label.toLowerCase();
  if (normalized.startsWith('gol segnato')) return 'goal';
  if (normalized.startsWith('gol subito')) return 'goal_conceded';
  if (normalized.startsWith('rigore segnato')) return 'penalty_scored';
  if (normalized.startsWith('rigore sbagliato')) return 'penalty_missed';
  if (normalized.startsWith('rigore parato')) return 'penalty_saved';
  if (normalized.startsWith('assist soft')) return null;
  if (normalized.startsWith('assist')) return 'assist';
  if (normalized.startsWith('ammonizione')) return 'yellow_card';
  if (normalized.startsWith('espulsione')) return 'red_card';
  if (normalized.startsWith('autorete')) return 'own_goal';
  return null;
}

function parseBonuses(
  $: cheerio.CheerioAPI,
  item: cheerio.Cheerio<AnyNode>
): FantacalcioBonus[] {
  const grouped = new Map<FantacalcioBonusType, FantacalcioBonus>();

  item.find('.player-event').each((_, element) => {
    const node = $(element);
    const title = (node.attr('title') || '').replace(/\s+/g, ' ').trim();
    const label = title.replace(/\s*\(\d+\s*°\)\s*$/, '').trim();
    const type = bonusTypeFromLabel(label);
    if (!type) return;
    const minuteMatch = title.match(/(\d+)\s*°/);
    const minute = minuteMatch ? Number(minuteMatch[1]) : null;
    const count = Number.parseInt(node.attr('data-count') || '1', 10);
    const safeCount = Number.isFinite(count) && count > 0 ? count : 1;
    const current = grouped.get(type);
    if (!current || safeCount > current.count) {
      grouped.set(type, {
        type,
        label,
        count: safeCount,
        minute: minute ?? current?.minute ?? null,
      });
    } else if (current.minute == null && minute != null) {
      current.minute = minute;
    }
  });

  return [...grouped.values()];
}

function mapRole(raw: string | undefined): PlayerRole | null {
  switch ((raw || '').toLowerCase()) {
    case 'p':
    case 'por':
      return 'P';
    case 'd':
      return 'D';
    case 'c':
      return 'C';
    case 'a':
      return 'A';
    default:
      return null;
  }
}

export function parseFantacalcioVotes(html: string): FantacalcioVotePlayer[] {
  const $ = cheerio.load(html);
  const decoys = new Set(
    $('#grades .player-list > .player-item[data-r^="1"] + .player-item, #grades .player-list > .player-item[data-r^="2"] + .player-item').toArray()
  );
  const players: FantacalcioVotePlayer[] = [];

  $('#playersListsTemplateTarget .col').each((_, column) => {
    const team = $(column).find('header .team-name').first().text().replace(/\s+/g, ' ').trim();
    $(column).find('ul.player-list > li.player-item').each((__, row) => {
      if (decoys.has(row)) return;
      const item = $(row);
      const name = item.find('.player-name').first().text().replace(/\s+/g, ' ').trim();
      const role = mapRole(item.find('.role').not('.role-mantra').first().attr('data-value'));
      if (!name || role == null) return;

      const grade = item.find('.player-grade').first();
      const { vote, hiddenGrade } = resolveVisibleVote(grade.attr('data-value'), grade.text());
      const bonuses = parseBonuses($, item);
      players.push({
        name,
        role,
        team,
        vote,
        hiddenGrade,
        fantaVote: fantavotoFromVote(vote, bonuses),
        bonuses,
        substitutedOut: item.hasClass('player-out'),
        sourcePlayerId: item.attr('data-id') || null,
      });
    });
  });

  return players;
}

interface NameCandidate {
  surname: string;
  initials: string[];
  given: string[];
}

function isInitialToken(token: string): boolean {
  return /^[a-z]{1,2}$/.test(token);
}

function isParticle(token: string): boolean {
  return NAME_PARTICLES.has(token);
}

function splitDatabaseName(name: string): { surname: string; given: string[] } {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  const isCaps = (word: string) => {
    const letters = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '');
    return letters.length > 1 && letters === letters.toUpperCase();
  };

  if (tokens.length > 0 && isCaps(tokens[0])) {
    const surname: string[] = [];
    let index = 0;
    while (index < tokens.length && (isCaps(tokens[index]) || isParticle(normalizePlayerName(tokens[index])))) {
      surname.push(tokens[index]);
      index += 1;
    }
    return {
      surname: normalizePlayerName(surname.join(' ')),
      given: tokens.slice(index).map((token) => normalizePlayerName(token)),
    };
  }

  let index = tokens.length - 1;
  const surname = [tokens[index]];
  index -= 1;
  while (index >= 0 && isParticle(normalizePlayerName(tokens[index]))) {
    surname.unshift(tokens[index]);
    index -= 1;
  }
  return {
    surname: normalizePlayerName(surname.join(' ')),
    given: tokens.slice(0, index + 1).map((token) => normalizePlayerName(token)),
  };
}

function fantacalcioNameCandidates(rawName: string): NameCandidate[] {
  const tokens = normalizePlayerName(rawName).split(' ').filter(Boolean);
  const initials: string[] = [];
  const core = [...tokens];
  while (core.length > 1 && isInitialToken(core[core.length - 1])) {
    initials.unshift(core.pop() as string);
  }
  if (core.length === 0) return [];

  const candidates: NameCandidate[] = [];
  let index = core.length - 1;
  const surname = [core[index]];
  index -= 1;
  while (index >= 0 && isParticle(core[index])) {
    surname.unshift(core[index]);
    index -= 1;
  }
  candidates.push({
    surname: surname.join(' '),
    initials,
    given: core.slice(0, index + 1),
  });

  if (core.length > 1) {
    candidates.push({
      surname: core.join(' '),
      initials,
      given: [],
    });
  }
  return candidates;
}

function initialsMatch(initials: string[], given: string[]): boolean {
  if (initials.length === 0) return true;
  if (initials.length > given.length) return false;
  return initials.every((initial, index) => given[index]?.startsWith(initial));
}

function scoreNameCandidate(
  candidate: NameCandidate,
  player: FantacalcioCatalogPlayer,
  context?: FantacalcioMatchContext
): number | null {
  const db = splitDatabaseName(player.name);
  const playerTeam = canonicalTeamCode(player.realTeam);
  const contextTeam = canonicalTeamCode(context?.realTeam);
  if (contextTeam && playerTeam && contextTeam !== playerTeam) return null;

  if (candidate.surname !== db.surname) return null;
  if (candidate.initials.length > 0 && !initialsMatch(candidate.initials, db.given)) return null;
  if (candidate.given.length > 0) {
    const givenOk = candidate.given.every((token, index) => db.given[index] === token || db.given.includes(token));
    if (!givenOk) return null;
  }

  let score = candidate.initials.length > 0 ? 88 : candidate.given.length > 0 ? 86 : 70;
  if (candidate.given.length === 0 && candidate.initials.length === 0 && candidate.surname.includes(' ')) {
    score = 92;
  }
  if (context?.role && player.role === context.role) score += 3;
  if (contextTeam && playerTeam && contextTeam === playerTeam) score += 5;
  return score;
}

export function matchFantacalcioPlayer(
  rawName: string,
  players: readonly FantacalcioCatalogPlayer[],
  aliases: readonly FantacalcioAlias[] = [],
  context?: FantacalcioMatchContext
): { playerId: string; playerName: string; confidence: number } | null {
  const normalized = normalizePlayerName(rawName);
  if (!normalized) return null;

  const aliasHits = aliases.filter((alias) => normalizePlayerName(alias.alias) === normalized);
  aliasHits.sort((a, b) => {
    const rank = (source: string) => (source === FANTACALCIO_ALIAS_SOURCE ? 0 : 1);
    return rank(a.source) - rank(b.source);
  });
  for (const alias of aliasHits) {
    const player = players.find((entry) => entry.id === alias.playerId);
    if (player) {
      return { playerId: player.id, playerName: player.name, confidence: 1 };
    }
  }

  const candidates = fantacalcioNameCandidates(rawName);
  let best: { player: FantacalcioCatalogPlayer; score: number } | null = null;
  let tied = false;

  for (const player of players) {
    const playerTeam = canonicalTeamCode(player.realTeam);
    const contextTeam = canonicalTeamCode(context?.realTeam);
    if (contextTeam && playerTeam && contextTeam !== playerTeam) continue;

    let playerScore: number | null = null;
    const dbNorm = normalizePlayerName(player.name);
    if (dbNorm === normalized) playerScore = 98;
    for (const candidate of candidates) {
      const score = scoreNameCandidate(candidate, player, context);
      if (score != null && (playerScore == null || score > playerScore)) playerScore = score;
    }
    if (playerScore == null) continue;
    if (!best || playerScore > best.score) {
      best = { player, score: playerScore };
      tied = false;
    } else if (playerScore === best.score && player.id !== best.player.id) {
      tied = true;
    }
  }

  if (best && !tied) {
    return { playerId: best.player.id, playerName: best.player.name, confidence: best.score / 100 };
  }
  return looseClubMatch(rawName, players, context);
}

/** Parole del nome (minuscole, senza accenti), con i cognomi composti divisi ("kessie'" -> "kessie"). */
function nameWords(value: string): string[] {
  return normalizePlayerName(value.replace(/[-']/g, ' ')).split(' ').filter(Boolean);
}

/**
 * Secondo tentativo, solo nello stesso club: "COGNOME I." dove l'iniziale non è
 * il primo nome in anagrafica (NDICKA E. = NDICKA Obite Evan), il cognome è
 * composto (MUSSOLINI R. = FLORIANI MUSSOLINI Romano), il cognome è il secondo
 * nome brasiliano (GABRIEL T. = TIAGO GABRIEL) o l'iniziale è di un soprannome
 * (PEREZ K. = Kike, PEREZ Enrique). Tutte le parole lunghe devono comparire
 * nel nome in anagrafica; l'iniziale e il ruolo servono solo per spareggiare.
 * Se resta un pareggio non abbina (meglio un alias che un voto sbagliato).
 */
export function looseClubMatch(
  rawName: string,
  players: readonly FantacalcioCatalogPlayer[],
  context?: FantacalcioMatchContext
): { playerId: string; playerName: string; confidence: number } | null {
  const contextTeam = canonicalTeamCode(context?.realTeam);
  if (!contextTeam) return null;
  const tokens = nameWords(rawName);
  const words = tokens.filter((token) => token.length >= 3);
  const initials = tokens.filter((token) => token.length < 3);
  if (words.length === 0) return null;

  let best: { player: FantacalcioCatalogPlayer; score: number } | null = null;
  let tied = false;
  for (const player of players) {
    if (canonicalTeamCode(player.realTeam) !== contextTeam) continue;
    const dbWords = nameWords(player.name);
    if (!words.every((word) => dbWords.includes(word))) continue;
    const rest = dbWords.filter((word) => !words.includes(word));
    let score = 60;
    if (initials.length > 0 && initials.every((initial) => rest.some((word) => word.startsWith(initial)))) score += 10;
    if (context?.role && player.role === context.role) score += 3;
    if (!best || score > best.score) {
      best = { player, score };
      tied = false;
    } else if (score === best.score) {
      tied = true;
    }
  }
  if (!best || tied) return null;
  return { playerId: best.player.id, playerName: best.player.name, confidence: best.score / 100 };
}
