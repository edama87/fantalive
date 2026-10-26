/**
 * Import dei voti FMS Revo come voti ufficiali consolidati (source 'fms').
 *
 * Anteprima: ogni giocatore schierato il cui voto o bonus/malus FantaLive è
 * diverso da FMS, più la simulazione della giornata con i voti FMS (quali
 * risultati cambiano). Conferma: scrive le righe official_votes 'fms' (la riga
 * sostituita resta in previous_row). Annulla: ripristina le righe precedenti.
 * FMS è letto in sola lettura (login + tabellini, vedi quadratura-server).
 */
import { teams } from '@/data/teams';
import { matchesFmsName, type FmsTabellino, type FmsTabellinoPlayer } from '@/lib/fms-reconciliation';
import type { FantasyMatchResult, PlayerEvent, PlayerMatchData, PlayerScore } from '@/types';

export const FMS_SOURCE = 'fms';
const EPS = 0.0015;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const teamName = new Map(teams.map((t) => [t.id, t.name]));

export interface FmsVoteValues { vote: number | null; bonus: number | null; fantavoto: number | null }
export interface FmsImportItem {
  playerId: string;
  name: string;
  fmsName: string;
  role: string;
  team: string;
  matchKey: string;
  idIncontro: number | null;
  ours: FmsVoteValues & { source: string | null };
  fms: FmsVoteValues;
  diff: Array<'voto' | 'bonus'>;
  /** Eventi aggiunti/tolti per allineare il bonus FMS (cartellini, gol, assist). */
  eventChanges: string[];
}
export interface FmsMatchOutcome {
  matchKey: string;
  home: string;
  away: string;
  current: { goals: [number, number]; totals: [number, number] };
  after: { goals: [number, number]; totals: [number, number] };
  fms: { goals: [number, number]; totals: [number, number] };
  /** Il risultato cambia con l'import. */
  flips: boolean;
  /** Dopo l'import il risultato coincide con FMS. */
  matchesFms: boolean;
}
export interface FmsImportPreview {
  round: number;
  error: string | null;
  items: FmsImportItem[];
  outcomes: FmsMatchOutcome[];
  /** Righe 'fms' già salvate per la giornata (import già fatto). */
  imported: number;
}

function fmsVotes(fp: FmsTabellinoPlayer): FmsVoteValues {
  const vote = fp.vote;
  const bonus = vote == null ? null : (fp.bonus ?? 0);
  const fantavoto = vote == null ? null : (fp.fantavoto ?? r3(vote + (bonus ?? 0)));
  return { vote, bonus, fantavoto };
}

function oursVotes(ps: PlayerScore): FmsVoteValues {
  if (!(ps.baseVote > 0)) return { vote: null, bonus: null, fantavoto: null };
  return { vote: ps.baseVote, bonus: r3(ps.fantavoto - ps.baseVote), fantavoto: r3(ps.fantavoto) };
}

const neq = (a: number | null, b: number | null) => (a === null) !== (b === null) || (a !== null && b !== null && Math.abs(a - b) >= EPS);

export function matchKeyOf(m: FantasyMatchResult): string {
  return `${m.homeTeamId}-${m.awayTeamId}`;
}

/** Differenze giocatore per giocatore tra una nostra sfida e il tabellino FMS. */
export function diffMatchVotes(
  m: FantasyMatchResult,
  t: FmsTabellino & { idIncontro?: number },
  playerData: ReadonlyMap<string, PlayerMatchData>
): FmsImportItem[] {
  const items: FmsImportItem[] = [];
  for (const which of ['home', 'away'] as const) {
    const side = t[which];
    const list = which === 'home' ? m.homePlayerScores : m.awayPlayerScores;
    const fmsAll = [...side.starters, ...side.bench, ...side.tribuna];
    const used = new Set<number>();
    for (const ps of list) {
      const idx = fmsAll.findIndex((f, i) => !used.has(i) && matchesFmsName(f.name, ps.player.name));
      if (idx < 0) continue;
      used.add(idx);
      const fp = fmsAll[idx];
      const ours = oursVotes(ps);
      const fms = fmsVotes(fp);
      const diff: FmsImportItem['diff'] = [];
      if (neq(ours.vote, fms.vote)) diff.push('voto');
      if (ours.vote !== null && fms.vote !== null && neq(ours.bonus, fms.bonus)) diff.push('bonus');
      if (!diff.length) continue;
      const data = playerData.get(ps.player.id);
      const delta = (fms.bonus ?? 0) - (ours.bonus ?? 0);
      const eventChanges = fms.vote == null ? [] : adjustEvents(data?.events ?? [], ps.player.id, delta, ps.player.role === 'P').changes;
      items.push({
        playerId: ps.player.id,
        name: ps.player.name,
        fmsName: fp.name,
        role: ps.player.role,
        team: side.team,
        matchKey: matchKeyOf(m),
        idIncontro: t.idIncontro ?? null,
        ours: { ...ours, source: data?.voteSource ?? null },
        fms,
        diff,
        eventChanges,
      });
    }
  }
  return items;
}

/**
 * Allinea gli eventi al bonus FMS (delta = bonus FMS − bonus nostro): ±3 gol
 * (rigore parato per i portieri), ±1 assist, ±0,5 ammonizione. Il fantavoto usa comunque il
 * bonus FMS; gli eventi servono a modificatori e dettagli.
 */
export function adjustEvents(events: readonly PlayerEvent[], playerId: string, delta: number, isGoalkeeper: boolean): { events: PlayerEvent[]; changes: string[] } {
  const out = [...events];
  const changes: string[] = [];
  let d = Math.round(delta * 2) / 2;
  const remove = (type: PlayerEvent['type']) => {
    const i = out.findIndex((e) => e.type === type && e.relatedPlayerId !== 'opponent');
    if (i < 0) return false;
    out.splice(i, 1);
    return true;
  };
  const add = (type: PlayerEvent['type']) => out.push({ playerId, type, minute: 0 });
  let guard = 0;
  while (Math.abs(d) >= 0.5 && guard++ < 10) {
    if (!isGoalkeeper && d >= 3) { add('goal'); changes.push('+ gol'); d -= 3; continue; }
    if (isGoalkeeper && d >= 3) { add('penalty_saved'); changes.push('+ rigore parato'); d -= 3; continue; }
    if (!isGoalkeeper && d <= -3 && remove('goal')) { changes.push('− gol'); d += 3; continue; }
    if (d >= 1 && d % 1 === 0) { add('assist'); changes.push('+ assist'); d -= 1; continue; }
    if (d <= -1 && d % 1 === 0 && remove('assist')) { changes.push('− assist'); d += 1; continue; }
    if (d > 0 && remove('yellow_card')) { changes.push('− ammonizione'); d -= 0.5; continue; }
    if (d < 0 && d % 1 !== 0) { add('yellow_card'); changes.push('+ ammonizione'); d += 0.5; continue; }
    break;
  }
  if (Math.abs(d) >= 0.5) changes.push(`bonus FMS ${d > 0 ? '+' : ''}${d} senza evento`);
  return { events: out, changes };
}

/** Dati giocatore con il voto FMS (per motore e simulazione). */
export function fmsPlayerData(existing: PlayerMatchData | undefined, item: FmsImportItem): PlayerMatchData {
  const events = item.fms.vote == null
    ? (existing?.events ?? [])
    : adjustEvents(existing?.events ?? [], item.playerId, (item.fms.bonus ?? 0) - (item.ours.bonus ?? 0), item.role === 'P').events;
  return {
    playerId: item.playerId,
    estimatedVote: item.fms.vote,
    minutesPlayed: existing?.minutesPlayed ?? 0,
    isPlaying: false,
    events,
    voteSource: 'consolidated',
    bonusOverride: item.fms.bonus ?? 0,
  };
}

export function applyItemsToPlayerData(data: Map<string, PlayerMatchData>, items: readonly FmsImportItem[]): Map<string, PlayerMatchData> {
  const next = new Map(data);
  for (const item of items) next.set(item.playerId, fmsPlayerData(data.get(item.playerId), item));
  return next;
}

export function outcomeOf(before: FantasyMatchResult, after: FantasyMatchResult, t: FmsTabellino): FmsMatchOutcome {
  const g = (m: FantasyMatchResult): [number, number] => [m.homeGoals, m.awayGoals];
  const tot = (m: FantasyMatchResult): [number, number] => [r3(m.homeTotal), r3(m.awayTotal)];
  const fmsGoals: [number, number] = [t.home.goals, t.away.goals];
  return {
    matchKey: matchKeyOf(before),
    home: teamName.get(before.homeTeamId) ?? before.homeTeamId,
    away: teamName.get(before.awayTeamId) ?? before.awayTeamId,
    current: { goals: g(before), totals: tot(before) },
    after: { goals: g(after), totals: tot(after) },
    fms: { goals: fmsGoals, totals: [t.home.total, t.away.total] },
    flips: before.homeGoals !== after.homeGoals || before.awayGoals !== after.awayGoals,
    matchesFms: after.homeGoals === fmsGoals[0] && after.awayGoals === fmsGoals[1],
  };
}

function findMatch(matches: readonly FantasyMatchResult[], t: FmsTabellino) {
  return matches.find((x) => teamName.get(x.homeTeamId) === t.home.team && teamName.get(x.awayTeamId) === t.away.team);
}

/** Anteprima pura: differenze + simulazione (computeWith ricalcola la giornata con i dati modificati). */
export async function buildFmsImportPreview(
  round: number,
  tabellini: readonly (FmsTabellino & { idIncontro?: number })[],
  current: { matches: FantasyMatchResult[]; playerData: Map<string, PlayerMatchData> },
  computeWith: (data: Map<string, PlayerMatchData>) => Promise<FantasyMatchResult[]>,
  imported = 0
): Promise<FmsImportPreview> {
  const items: FmsImportItem[] = [];
  for (const t of tabellini) {
    const m = findMatch(current.matches, t);
    if (m) items.push(...diffMatchVotes(m, t, current.playerData));
  }
  const afterMatches = items.length ? await computeWith(applyItemsToPlayerData(current.playerData, items)) : current.matches;
  const outcomes: FmsMatchOutcome[] = [];
  for (const t of tabellini) {
    const before = findMatch(current.matches, t);
    const after = findMatch(afterMatches, t);
    if (before && after) outcomes.push(outcomeOf(before, after, t));
  }
  return { round, error: null, items, outcomes, imported };
}

// ---------------------------------------------------------------- scrittura

type Row = Record<string, unknown>;
/** Client Supabase minimo usato da conferma/annullamento (mockabile nei test). */
export interface VotesDb {
  from(table: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function eventsToBonusMalus(events: readonly PlayerEvent[]) {
  const counts = new Map<string, number>();
  for (const e of events) {
    const type = e.type === 'goal' && e.relatedPlayerId === 'opponent' ? 'goal_conceded' : e.type;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts].map(([type, count]) => ({ type, count, minute: null }));
}

function previousOf(existing: Row | undefined): Row | null {
  if (!existing) return null;
  if (existing.source === FMS_SOURCE) return (existing.previous_row as Row | null) ?? null;
  const { vote_average: _avg, previous_row: _prev, ...rest } = existing; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

export function fmsVoteRow(round: number, item: FmsImportItem, data: PlayerMatchData, existing: Row | undefined, now: string): Row {
  return {
    round_number: round,
    player_id: item.playerId,
    source: FMS_SOURCE,
    consolidated_at: now,
    vote_fms: item.fms.vote,
    fms_bonus: item.fms.vote == null ? null : item.fms.bonus,
    vote_fantacalcio: null,
    vote_gazzetta: null,
    vote_corriere: null,
    vote_tuttosport: null,
    minutes_played: data.minutesPlayed,
    fanta_vote: item.fms.fantavoto,
    bonus_malus: eventsToBonusMalus(data.events),
    previous_row: previousOf(existing),
  };
}

export async function saveFmsVotes(
  db: VotesDb,
  round: number,
  serieAMatchday: number,
  items: readonly FmsImportItem[],
  playerData: ReadonlyMap<string, PlayerMatchData>
): Promise<{ saved: number }> {
  if (!items.length) return { saved: 0 };
  const now = new Date().toISOString();
  const ids = items.map((i) => i.playerId);
  const { data: existingRows, error: readError } = await db.from('official_votes').select('*').eq('round_number', round).in('player_id', ids);
  if (readError) throw new Error(`official_votes: ${readError.message}`);
  const byId = new Map<string, Row>(((existingRows ?? []) as Row[]).map((r) => [r.player_id as string, r]));
  const rows = items.map((item) => fmsVoteRow(round, item, fmsPlayerData(playerData.get(item.playerId), item), byId.get(item.playerId), now));
  const { error } = await db.from('official_votes').upsert(rows, { onConflict: 'round_number,player_id' });
  if (error) throw new Error(`official_votes: ${error.message}`);

  const byMatch = new Map<string, FmsImportItem[]>();
  for (const i of items) byMatch.set(i.matchKey, [...(byMatch.get(i.matchKey) ?? []), i]);
  for (const [key, group] of byMatch) {
    const [home, away] = key.split('-');
    const { error: importError } = await db.from('official_vote_imports').upsert(
      {
        round_number: round,
        serie_a_matchday: serieAMatchday,
        source: FMS_SOURCE,
        match_key: key,
        home_team: teamName.get(home) ?? home,
        away_team: teamName.get(away) ?? away,
        players: group.map((g) => ({ playerId: g.playerId, name: g.name, idIncontro: g.idIncontro, ours: g.ours, fms: g.fms })),
        matched_count: group.length,
        unmatched_count: 0,
        imported_at: now,
      },
      { onConflict: 'round_number,source,match_key' }
    );
    if (importError) throw new Error(`official_vote_imports: ${importError.message}`);
  }
  return { saved: rows.length };
}

/** Annulla l'import FMS della giornata: toglie le righe 'fms' e rimette quelle sostituite. */
export async function undoFmsVotes(db: VotesDb, round: number): Promise<{ removed: number; restored: number }> {
  const { data, error } = await db.from('official_votes').select('*').eq('round_number', round).eq('source', FMS_SOURCE);
  if (error) throw new Error(`official_votes: ${error.message}`);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return { removed: 0, restored: 0 };
  const { error: delError } = await db.from('official_votes').delete().eq('round_number', round).eq('source', FMS_SOURCE);
  if (delError) throw new Error(`official_votes: ${delError.message}`);
  const previous = rows.map((r) => r.previous_row as Row | null).filter((r): r is Row => !!r);
  if (previous.length) {
    const { error: insError } = await db.from('official_votes').insert(previous);
    if (insError) throw new Error(`official_votes (ripristino): ${insError.message}`);
  }
  const { error: impError } = await db.from('official_vote_imports').delete().eq('round_number', round).eq('source', FMS_SOURCE);
  if (impError) throw new Error(`official_vote_imports: ${impError.message}`);
  return { removed: rows.length, restored: previous.length };
}
