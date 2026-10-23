/**
 * Voti live fantacalcio.it. Durante la partita la pagina /voti NON contiene i
 * voti nell'HTML: il browser li carica da un file protobuf firmato
 * (api.fantacalcio.it/v1/st/{seasonId}/matches/live/{matchweek}.dat, URL
 * firmato via POST /api/v1/SignedUri) e li disegna lato client. Qui si
 * replica quel flusso con un decoder protobuf minimale (schema LiveMessage
 * da /js/proto/live.txt).
 */
import type { PlayerRole } from '@/types';
import { fantavotoFromVote, type FantacalcioBonus, type FantacalcioBonusType, type FantacalcioVotePlayer } from '@/lib/fantacalcio-it';

export interface LivePlayer {
  id: number;
  name: string;
  position: string;
  vote: number | null;
  events: number[];
  eventsMinutes: number[];
}

export interface LiveMatch {
  matchId: number;
  status: number;
  teamHome: string;
  teamAway: string;
  goalHome: number;
  goalAway: number;
  playersHome: LivePlayer[];
  playersAway: LivePlayer[];
}

export interface FantacalcioBridge {
  seasonId: number;
  matchweek: number;
  matchId: number;
}

/** Legge `Bridge = { seasonId: 21, matchweek: 8, matchId: 18033 ... }` dalla pagina /voti. */
export function parseFantacalcioBridge(html: string): FantacalcioBridge | null {
  const num = (key: string) => {
    const m = html.match(new RegExp(`Bridge\\s*=\\s*\\{[\\s\\S]*?\\b${key}\\s*:\\s*(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  const seasonId = num('seasonId');
  const matchweek = num('matchweek');
  const matchId = num('matchId');
  return seasonId && matchweek && matchId ? { seasonId, matchweek, matchId } : null;
}

// ---------- decoder protobuf minimale ----------
class Reader {
  pos = 0;
  constructor(private buf: Uint8Array, private end = buf.length) {}
  done() { return this.pos >= this.end; }
  varint(): number {
    let result = 0, shift = 0, b: number;
    do {
      b = this.buf[this.pos++];
      result += (b & 0x7f) * 2 ** shift;
      shift += 7;
    } while (b & 0x80);
    return result;
  }
  double(): number {
    const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8).getFloat64(0, true);
    this.pos += 8;
    return v;
  }
  bytes(): Reader {
    const len = this.varint();
    const r = new Reader(this.buf, this.pos + len);
    r.pos = this.pos;
    this.pos += len;
    return r;
  }
  string(): string {
    const len = this.varint();
    const s = new TextDecoder().decode(this.buf.subarray(this.pos, this.pos + len));
    this.pos += len;
    return s;
  }
  skip(wire: number) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) {
      const len = this.varint(); // prima la lunghezza: `pos += varint()` leggerebbe pos vecchio
      this.pos += len;
    }
    else if (wire === 5) this.pos += 4;
    else throw new Error(`wire type ${wire} non supportato`);
  }
}

const toInt32 = (v: number) => (v > 0x7fffffff ? v - 2 ** 64 : v) | 0;

function repeatedInt(r: Reader, wire: number, into: number[]) {
  if (wire === 2) {
    const sub = r.bytes();
    while (!sub.done()) into.push(toInt32(sub.varint()));
  } else into.push(toInt32(r.varint()));
}

function decodePlayer(r: Reader): LivePlayer {
  const p: LivePlayer = { id: 0, name: '', position: '', vote: null, events: [], eventsMinutes: [] };
  while (!r.done()) {
    const tag = r.varint(), field = Math.floor(tag / 8), wire = tag & 7;
    if (field === 1 && wire === 0) p.id = r.varint();
    else if (field === 2 && wire === 2) p.name = r.string();
    else if (field === 3 && wire === 2) p.position = r.string();
    else if (field === 4 && wire === 1) p.vote = r.double();
    else if (field === 5) repeatedInt(r, wire, p.events);
    else if (field === 6) repeatedInt(r, wire, p.eventsMinutes);
    else r.skip(wire);
  }
  return p;
}

function decodeMatch(r: Reader): LiveMatch {
  const m: LiveMatch = { matchId: 0, status: 0, teamHome: '', teamAway: '', goalHome: 0, goalAway: 0, playersHome: [], playersAway: [] };
  while (!r.done()) {
    const tag = r.varint(), field = Math.floor(tag / 8), wire = tag & 7;
    if (field === 1 && wire === 0) m.matchId = r.varint();
    else if (field === 5 && wire === 0) m.goalHome = r.varint();
    else if (field === 6 && wire === 0) m.goalAway = r.varint();
    else if (field === 10 && wire === 0) m.status = r.varint();
    else if (field === 13 && wire === 2) m.teamHome = r.string();
    else if (field === 14 && wire === 2) m.teamAway = r.string();
    else if (field === 15 && wire === 2) m.playersHome.push(decodePlayer(r.bytes()));
    else if (field === 16 && wire === 2) m.playersAway.push(decodePlayer(r.bytes()));
    else r.skip(wire);
  }
  return m;
}

export function decodeLiveMessage(buf: Uint8Array): LiveMatch[] {
  const r = new Reader(buf);
  const out: LiveMatch[] = [];
  while (!r.done()) {
    const tag = r.varint(), field = Math.floor(tag / 8), wire = tag & 7;
    if (field === 1 && wire === 2) out.push(decodeMatch(r.bytes()));
    else r.skip(wire);
  }
  return out;
}

// ---------- conversione nel formato della pagina /voti ----------
/** Codici MatchEventType di fantacalcio.it (/js/services/match-events.js). */
const EVENT_BONUS: Record<number, [FantacalcioBonusType, string]> = {
  1: ['yellow_card', 'Ammonizione'],
  2: ['red_card', 'Espulsione'],
  3: ['goal', 'Gol'],
  4: ['goal_conceded', 'Gol subito'],
  7: ['penalty_saved', 'Rigore parato'],
  8: ['penalty_missed', 'Rigore sbagliato'],
  9: ['penalty_scored', 'Rigore segnato'],
  10: ['own_goal', 'Autogol'],
  21: ['assist', 'Assist'],
  22: ['assist', 'Assist'],
  23: ['assist', 'Assist'],
};
const PLAYER_OUT = 14;
const PLAYER_IN = 15;

function toRole(position: string): PlayerRole | null {
  const p = position.trim().toUpperCase();
  return p === 'P' || p === 'D' || p === 'C' || p === 'A' ? p : null;
}

/**
 * Voto valido solo in (0, 10]: come formatGrade di fantacalcio.it, ogni altro
 * valore (0 = non entrato, 55 = senza voto per i subentrati a fine gara) è "-".
 */
export function isLiveGrade(vote: number | null | undefined): vote is number {
  return typeof vote === 'number' && Number.isFinite(vote) && vote > 0 && vote <= 10;
}

function toVotePlayer(p: LivePlayer, team: string): FantacalcioVotePlayer | null {
  const role = toRole(p.position);
  if (!p.name || !role) return null;
  const bonuses: FantacalcioBonus[] = [];
  p.events.forEach((code, i) => {
    const mapped = EVENT_BONUS[code];
    if (!mapped) return;
    const existing = bonuses.find((b) => b.type === mapped[0]);
    if (existing) existing.count += 1;
    else bonuses.push({ type: mapped[0], label: mapped[1], count: 1, minute: p.eventsMinutes[i] || null });
  });
  const minuteOf = (code: number) => {
    const i = p.events.indexOf(code);
    return i < 0 ? undefined : p.eventsMinutes[i] || null;
  };
  const inMinute = minuteOf(PLAYER_IN);
  const outMinute = minuteOf(PLAYER_OUT);
  const substitution =
    inMinute !== undefined || outMinute !== undefined
      ? { ...(inMinute !== undefined ? { in: inMinute } : {}), ...(outMinute !== undefined ? { out: outMinute } : {}) }
      : null;
  // vote 0 / assente = senza voto (non entrato o s.v.).
  const vote = isLiveGrade(p.vote) ? p.vote : null;
  return {
    name: p.name,
    role,
    team,
    vote,
    hiddenGrade: null,
    fantaVote: fantavotoFromVote(vote, bonuses),
    bonuses,
    substitutedOut: p.events.includes(PLAYER_OUT),
    sourcePlayerId: p.id ? String(p.id) : null,
    ...(substitution ? { substitution } : {}),
  };
}

/** Giocatori della partita nel formato di parseFantacalcioVotes (team = nome usato nella pagina). */
export function liveMatchToVotePlayers(match: LiveMatch, homeTeam: string, awayTeam: string): FantacalcioVotePlayer[] {
  return [
    ...match.playersHome.map((p) => toVotePlayer(p, homeTeam)),
    ...match.playersAway.map((p) => toVotePlayer(p, awayTeam)),
  ].filter((p): p is FantacalcioVotePlayer => p !== null);
}

const SITE = 'https://www.fantacalcio.it';
const RESOURCES = 'https://api.fantacalcio.it/v1';

/** Scarica e decodifica il file live della giornata (1 POST firma + 1 GET). */
export async function fetchFantacalcioLiveMatches(
  bridge: Pick<FantacalcioBridge, 'seasonId' | 'matchweek'>,
  fetchImpl: typeof fetch = fetch,
  options: { timeoutMs?: number; referer?: string } = {}
): Promise<LiveMatch[]> {
  const resource = `${RESOURCES}/st/${bridge.seasonId}/matches/live/${bridge.matchweek}.dat`;
  const signal = () => (options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; FantaLive/1.0)',
    'Content-Type': 'application/json',
    Origin: SITE,
    ...(options.referer ? { Referer: options.referer } : {}),
  };
  const signed = await fetchImpl(`${SITE}/api/v1/SignedUri`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resourcesUri: [resource] }),
    signal: signal(),
  });
  if (!signed.ok) throw new Error(`fantacalcio.it SignedUri ${signed.status}`);
  const json = (await signed.json()) as Record<string, { resources?: Array<{ signedUri?: string }> }>;
  const uri = json[resource]?.resources?.[0]?.signedUri;
  if (!uri) throw new Error('fantacalcio.it SignedUri senza URL');
  const data = await fetchImpl(uri, { headers, signal: signal() });
  if (!data.ok) throw new Error(`fantacalcio.it live ${data.status}`);
  return decodeLiveMessage(new Uint8Array(await data.arrayBuffer()));
}

/**
 * Voti dalla pagina /voti; se l'HTML non ne contiene (partita in corso),
 * dal file live. Restituisce anche la fonte usata.
 */
export async function resolveMatchVotes(
  html: string,
  parsed: FantacalcioVotePlayer[],
  teams: { homeTeam: string; awayTeam: string; matchId: string; url?: string },
  fetchImpl: typeof fetch = fetch,
  options: { timeoutMs?: number } = {}
): Promise<{ players: FantacalcioVotePlayer[]; source: 'html' | 'live' }> {
  if (parsed.some((p) => p.vote != null)) return { players: parsed, source: 'html' };
  const bridge = parseFantacalcioBridge(html);
  if (!bridge) return { players: parsed, source: 'html' };
  const matches = await fetchFantacalcioLiveMatches(bridge, fetchImpl, { ...options, referer: teams.url });
  const match = matches.find((m) => String(m.matchId) === String(teams.matchId) || m.matchId === bridge.matchId);
  if (!match) return { players: parsed, source: 'html' };
  const live = liveMatchToVotePlayers(match, teams.homeTeam, teams.awayTeam);
  return live.some((p) => p.vote != null) ? { players: live, source: 'live' } : { players: parsed, source: 'html' };
}
