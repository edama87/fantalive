/**
 * Quadratura FantaLive ↔ FMS Revo per una giornata (solo lettura su FMS).
 * I tabellini vengono letti on demand e tenuti in una cache in memoria (10 min).
 */
import { teams } from '@/data/teams';
import { computeRoundMatches } from '@/lib/round-matches-server';
import { fetchFMSRevoTabellino, loginFMSRevoReadOnly } from '@/lib/fmsrevo-client';
import {
  matchesFmsName, parseTabellino, reconcileTabellino,
  type Discrepancy, type FmsTabellino, type FmsTabellinoPlayer, type OurPlayer, type OurSideDetail,
} from '@/lib/fms-reconciliation';
import type { FantasyMatchResult, PlayerScore } from '@/types';

/** Primo idIncontro della giornata 1 su FMS; le giornate hanno 5 sfide consecutive. */
const FIRST_INCONTRO_ID = 472;
const MATCHES_PER_ROUND = 5;
const CACHE_TTL_MS = 10 * 60 * 1000;

const teamNames = teams.map((t) => t.name);
const teamName = new Map(teams.map((t) => [t.id, t.name]));

type CacheEntry = { fetchedAt: number; tabellini: FmsTabellino[] };
const cache = new Map<number, CacheEntry>();

export type PlayerState = 'conta' | 'entrato' | 'uscito' | 'panchina' | 'tribuna';

export interface QuadPlayerSide { vote: number | null; fantavoto: number | null; bonus: number | null; state: PlayerState }
export interface QuadPlayerRow {
  name: string;
  role: string | null;
  ours: QuadPlayerSide | null;
  fms: QuadPlayerSide | null;
  diff: string[];
}
export interface QuadNumbers { total: number; goals: number; partial: number; home: number; def: number; mid: number; att: number }
export interface QuadTeam { team: string; ours: QuadNumbers; fms: QuadNumbers; players: QuadPlayerRow[] }
export interface QuadMatch {
  idIncontro: number | null;
  home: QuadTeam;
  away: QuadTeam;
  ok: boolean;
  sameResult: boolean;
  discrepancies: Discrepancy[];
}
export interface Quadratura {
  round: number;
  fetchedAt: string | null;
  cached: boolean;
  error: string | null;
  matches: QuadMatch[];
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const EPS = 0.0015;

function ourSide(m: FantasyMatchResult, which: 'home' | 'away'): OurSideDetail & { all: PlayerScore[] } {
  const list = which === 'home' ? m.homePlayerScores : m.awayPlayerScores;
  const x = which === 'home' ? m.homeModifiers : m.awayModifiers;
  const conv = (p: PlayerScore): OurPlayer => ({ name: p.player.name, role: p.player.role, vote: p.baseVote, fantavoto: p.fantavoto, status: p.status, substitutedFor: p.substitutedFor?.name, counted: true });
  return {
    team: teamName.get(which === 'home' ? m.homeTeamId : m.awayTeamId) ?? '',
    total: which === 'home' ? m.homeTotal : m.awayTotal,
    goals: which === 'home' ? m.homeGoals : m.awayGoals,
    mods: { def: x.defenseModifier, mid: x.midfieldModifier, att: x.attackModifier, home: x.homeBonus, total: x.total },
    counted: list.filter((p) => !p.isUnusedBench && !p.substitutedBy && p.status !== 'substituted').map(conv),
    replaced: list.filter((p) => p.substitutedBy || p.status === 'substituted').map(conv),
    bench: list.filter((p) => p.isUnusedBench).map(conv),
    all: list,
  };
}

function ourState(p: PlayerScore): PlayerState {
  if (p.isUnusedBench) return 'panchina';
  if (p.substitutedBy || p.status === 'substituted') return 'uscito';
  if (p.substitutedFor) return 'entrato';
  return 'conta';
}

function fmsState(fp: FmsTabellinoPlayer, where: 'starters' | 'bench' | 'tribuna'): PlayerState {
  if (where === 'starters') return fp.enteredFromBench ? 'entrato' : 'conta';
  if (where === 'tribuna') return 'tribuna';
  return fp.role === null ? 'uscito' : 'panchina';
}

/** Righe giocatore unite (nostre + FMS), con le differenze evidenziate. */
export function buildPlayerRows(ours: PlayerScore[], fms: FmsTabellino['home']): QuadPlayerRow[] {
  const fmsAll = [
    ...fms.starters.map((p) => ({ p, where: 'starters' as const })),
    ...fms.bench.map((p) => ({ p, where: 'bench' as const })),
    ...fms.tribuna.map((p) => ({ p, where: 'tribuna' as const })),
  ];
  const used = new Set<number>();
  const rows: QuadPlayerRow[] = [];
  for (const op of ours) {
    const idx = fmsAll.findIndex((f, i) => !used.has(i) && matchesFmsName(f.p.name, op.player.name));
    const f = idx >= 0 ? fmsAll[idx] : null;
    if (idx >= 0) used.add(idx);
    const hasVote = op.baseVote > 0;
    const o: QuadPlayerSide = {
      vote: hasVote ? op.baseVote : null,
      fantavoto: hasVote ? r3(op.fantavoto) : null,
      bonus: hasVote ? r3(op.fantavoto - op.baseVote) : null,
      state: ourState(op),
    };
    const fs: QuadPlayerSide | null = f ? { vote: f.p.vote, fantavoto: f.p.fantavoto, bonus: f.p.bonus, state: fmsState(f.p, f.where) } : null;
    rows.push({ name: op.player.name, role: op.player.role, ours: o, fms: fs, diff: diffFields(o, fs) });
  }
  fmsAll.forEach((f, i) => {
    if (used.has(i)) return;
    const fs = { vote: f.p.vote, fantavoto: f.p.fantavoto, bonus: f.p.bonus, state: fmsState(f.p, f.where) };
    rows.push({ name: f.p.name, role: f.p.role, ours: null, fms: fs, diff: diffFields(null, fs) });
  });
  return rows;
}

function counts(s: PlayerState) {
  return s === 'conta' || s === 'entrato';
}

function diffFields(o: QuadPlayerSide | null, f: QuadPlayerSide | null): string[] {
  if (!o || !f) return ['presenza'];
  const d: string[] = [];
  const neq = (a: number | null, b: number | null) => (a === null) !== (b === null) || (a !== null && b !== null && Math.abs(a - b) >= EPS);
  if (neq(o.vote, f.vote)) d.push('voto');
  if (o.vote !== null && f.vote !== null && neq(o.bonus, f.bonus)) d.push('bonus');
  if (o.vote !== null && f.vote !== null && neq(o.fantavoto, f.fantavoto)) d.push('fantavoto');
  if (counts(o.state) !== counts(f.state)) d.push('sostituzione');
  return d;
}

function numbers(s: OurSideDetail): QuadNumbers {
  return { total: s.total, goals: s.goals, partial: r3(s.total - s.mods.total), home: s.mods.home, def: s.mods.def, mid: s.mods.mid, att: s.mods.att };
}

function fmsNumbers(s: FmsTabellino['home']): QuadNumbers {
  return { total: s.total, goals: s.goals, partial: s.partial, home: s.homeFactor, def: s.modDef, mid: s.modMid, att: s.modAtt };
}

async function fetchRoundTabellini(round: number): Promise<{ tabellini: FmsTabellino[]; error: string | null }> {
  const login = await loginFMSRevoReadOnly();
  if (!login.success) return { tabellini: [], error: login.error ?? 'Login FMS fallito' };
  const read = async (id: number) => {
    const html = await fetchFMSRevoTabellino(login.cookies, id);
    return html ? { ...parseTabellino(html, teamNames), idIncontro: id } : null;
  };
  // Stima degli id dalla giornata; se FMS li ha numerati diversamente si corregge una volta.
  let base = FIRST_INCONTRO_ID + (round - 1) * MATCHES_PER_ROUND;
  const probe = await read(base);
  if (probe?.fantaRound && probe.fantaRound !== round) base += (round - probe.fantaRound) * MATCHES_PER_ROUND;
  const ids = Array.from({ length: MATCHES_PER_ROUND }, (_, i) => base + i);
  const tabs = (await Promise.all(ids.map((id) => (id === FIRST_INCONTRO_ID + (round - 1) * MATCHES_PER_ROUND && probe?.fantaRound === round ? probe : read(id)))))
    .filter((t): t is FmsTabellino & { idIncontro: number } => !!t && t.fantaRound === round && !!t.home.team && Number.isFinite(t.home.total));
  return { tabellini: tabs, error: tabs.length ? null : 'Nessun tabellino FMS per questa giornata (non ancora disponibile?)' };
}

export async function getQuadratura(round: number, opts: { refresh?: boolean; fetchFms?: boolean } = {}): Promise<Quadratura> {
  let entry = cache.get(round);
  let cached = true;
  let error: string | null = null;
  const stale = !entry || Date.now() - entry.fetchedAt > CACHE_TTL_MS;
  if (opts.refresh || (stale && opts.fetchFms)) {
    const res = await fetchRoundTabellini(round);
    error = res.error;
    if (res.tabellini.length) {
      entry = { fetchedAt: Date.now(), tabellini: res.tabellini };
      cache.set(round, entry);
    }
    cached = false;
  }
  const { matches } = await computeRoundMatches(round);
  const tabs = entry?.tabellini ?? [];
  const out: QuadMatch[] = [];
  for (const t of tabs) {
    const m = matches.find((x) => teamName.get(x.homeTeamId) === t.home.team && teamName.get(x.awayTeamId) === t.away.team);
    if (!m) continue;
    const h = ourSide(m, 'home');
    const a = ourSide(m, 'away');
    const discrepancies = reconcileTabellino(round, t, { home: h, away: a });
    const home: QuadTeam = { team: h.team, ours: numbers(h), fms: fmsNumbers(t.home), players: buildPlayerRows(h.all, t.home) };
    const away: QuadTeam = { team: a.team, ours: numbers(a), fms: fmsNumbers(t.away), players: buildPlayerRows(a.all, t.away) };
    const sameResult = h.goals === t.home.goals && a.goals === t.away.goals;
    const ok = sameResult && Math.abs(h.total - t.home.total) < EPS && Math.abs(a.total - t.away.total) < EPS;
    out.push({ idIncontro: (t as { idIncontro?: number }).idIncontro ?? null, home, away, ok, sameResult, discrepancies });
  }
  return { round, fetchedAt: entry ? new Date(entry.fetchedAt).toISOString() : null, cached: cached && !!entry, error, matches: out };
}
