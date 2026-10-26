/**
 * Debrief di una formazione consigliata a giornata giocata: confronta, con lo
 * stesso motore della classifica (modificatori, fattore campo, sostituzioni,
 * Gazzetta master, regola a), la formazione consigliata, quella schierata e la
 * migliore possibile col senno di poi, contro la formazione reale dell'avversario.
 * La parte di calcolo è pura (buildDebrief); il caricamento dati è in lineup-debrief-server.
 */
import type { FantasyMatchResult, Lineup, Player, PlayerMatchData, PlayerRole, PlayerScore } from '@/types';
import { calculateBonuses, calculateFantavoto, calculateMatch, parseFormation, type PlayerDirectory, type TeamMatchStatuses } from '@/lib/scoring-engine';
import { roundScore } from '@/lib/vote-precision';
import type { LineupSuggestion } from '@/lib/lineup-suggestions';

export const DEBRIEF_FORMATIONS = ['6-3-1', '5-3-2', '5-4-1', '4-5-1', '4-4-2', '4-3-3', '3-6-1', '3-5-2', '3-4-3'] as const;
const ROLES: PlayerRole[] = ['P', 'D', 'C', 'A'];

export type ScenarioKey = 'suggested' | 'actual' | 'best';
export type Outcome = 'V' | 'N' | 'P';

export interface DebriefPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  realTeam: string | null;
  /** Fantavoto con bonus/malus; null = senza voto. */
  fantavoto: number | null;
  baseVote: number | null;
  starter: boolean;
  /** Contato nel totale (titolare con voto, panchinaro entrato, riserva d'ufficio). */
  counted: boolean;
  status: PlayerScore['status'] | 'unused';
  replacedBy?: string;
  replaces?: string;
}

export interface DebriefScenario {
  key: ScenarioKey;
  label: string;
  formation: string;
  total: number;
  opponentTotal: number;
  goalsFor: number;
  goalsAgainst: number;
  outcome: Outcome;
  modifiers: { defense: number; midfield: number; attack: number; home: number; total: number };
  /** Modificatore difesa che la nostra difesa dà all'avversario. */
  opponentDefenseModifier: number;
  starters: DebriefPlayer[];
  bench: DebriefPlayer[];
  subsUsed: number;
}

export interface DebriefFinding {
  kind: 'sv' | 'wrong_pick' | 'modifier' | 'bench_order' | 'points_lost' | 'info';
  scenario?: ScenarioKey;
  text: string;
  points?: number;
}

export interface LineupDebrief {
  version: 1;
  suggestionId: string;
  teamId: string;
  opponentTeamId: string;
  round: number;
  isHome: boolean;
  generatedAt: string;
  /** Voti non del tutto consolidati (partite non finite, voti live, testate mancanti). */
  warnings: string[];
  consolidated: boolean;
  scenarios: Partial<Record<ScenarioKey, DebriefScenario>>;
  findings: DebriefFinding[];
}

export interface DebriefInput {
  suggestion: LineupSuggestion;
  round: number;
  isHome: boolean;
  opponentTeamId: string;
  /** Formazione schierata dalla squadra (DB), se presente. */
  actualLineup: Lineup | null;
  opponentLineup: Lineup;
  /** Rosa della squadra per la giornata. */
  roster: Player[];
  players: PlayerDirectory;
  playerData: Map<string, PlayerMatchData>;
  teamStatuses?: TeamMatchStatuses;
  /** Partite di Serie A non ancora finite (nomi "Casa-Trasferta"). */
  unfinishedFixtures?: string[];
  now?: Date;
}

/** Fantavoto del singolo (null = senza voto), come lo calcola il motore. */
export function playerFantavoto(player: Player, data: PlayerMatchData | undefined): number | null {
  if (!data || data.estimatedVote == null) return null;
  const bonuses = calculateBonuses(data, player);
  return roundScore(calculateFantavoto(data.estimatedVote, bonuses, player.role === 'P'));
}

export function suggestionToLineup(s: LineupSuggestion, round: number): Lineup {
  const ids = (list: LineupSuggestion['starters']) => list.filter((p) => p.playerId).map((p) => p.playerId as string);
  return {
    teamId: s.teamId,
    roundNumber: round,
    formation: s.formation,
    starters: ids(s.starters).map((playerId, i) => ({ playerId, position: i + 1 })),
    bench: ids(s.bench).map((playerId, i) => ({ playerId, position: i + 1 })),
  };
}

function runMatch(input: DebriefInput, lineup: Lineup): { match: FantasyMatchResult; ours: 'home' | 'away' } {
  const home = input.isHome ? lineup : input.opponentLineup;
  const away = input.isHome ? input.opponentLineup : lineup;
  const match = calculateMatch(home, away, input.playerData, 'finished', input.players, input.teamStatuses);
  return { match, ours: input.isHome ? 'home' : 'away' };
}

function teamTotal(input: DebriefInput, lineup: Lineup): number {
  const { match, ours } = runMatch(input, lineup);
  return ours === 'home' ? match.homeTotal : match.awayTotal;
}

function outcomeOf(gf: number, ga: number): Outcome {
  return gf > ga ? 'V' : gf < ga ? 'P' : 'N';
}

const LABELS: Record<ScenarioKey, string> = {
  suggested: 'Consigliata',
  actual: 'Schierata',
  best: 'Migliore possibile',
};

export function scoreScenario(input: DebriefInput, key: ScenarioKey, lineup: Lineup): DebriefScenario {
  const { match, ours } = runMatch(input, lineup);
  const home = ours === 'home';
  const mods = home ? match.homeModifiers : match.awayModifiers;
  const oppMods = home ? match.awayModifiers : match.homeModifiers;
  const scores = home ? match.homePlayerScores : match.awayPlayerScores;
  const byId = new Map(scores.map((s) => [s.player.id, s]));
  const toPlayer = (id: string, starter: boolean): DebriefPlayer | null => {
    const p = input.players[id];
    if (!p) return null;
    const sc = byId.get(id);
    const data = input.playerData.get(id);
    const counted = !!sc && !sc.isUnusedBench && sc.status !== 'substituted' && (starter || !!sc.substitutedFor);
    return {
      id,
      name: p.name,
      role: p.role,
      realTeam: p.realTeam ?? null,
      fantavoto: playerFantavoto(p, data),
      baseVote: data?.estimatedVote ?? null,
      starter,
      counted,
      status: sc ? sc.status : 'unused',
      replacedBy: sc?.substitutedBy?.id,
      replaces: sc?.substitutedFor?.id,
    };
  };
  const starters = lineup.starters.map((s) => toPlayer(s.playerId, true)).filter((p): p is DebriefPlayer => !!p);
  const bench = [...lineup.bench]
    .sort((a, b) => a.position - b.position)
    .map((s) => toPlayer(s.playerId, false))
    .filter((p): p is DebriefPlayer => !!p);
  const goalsFor = home ? match.homeGoals : match.awayGoals;
  const goalsAgainst = home ? match.awayGoals : match.homeGoals;
  const counts = { D: 0, C: 0, A: 0 };
  for (const p of starters) if (p.role !== 'P') counts[p.role] += 1;
  return {
    key,
    label: LABELS[key],
    formation: `${counts.D}-${counts.C}-${counts.A}`,
    total: home ? match.homeTotal : match.awayTotal,
    opponentTotal: home ? match.awayTotal : match.homeTotal,
    goalsFor,
    goalsAgainst,
    outcome: outcomeOf(goalsFor, goalsAgainst),
    modifiers: {
      defense: mods.defenseModifier,
      midfield: mods.midfieldModifier,
      attack: mods.attackModifier,
      home: mods.homeBonus,
      total: mods.total,
    },
    opponentDefenseModifier: oppMods.defenseModifier,
    starters,
    bench,
    subsUsed: bench.filter((p) => p.replaces).length,
  };
}

/**
 * Migliore formazione col senno di poi: per ogni modulo ammesso parte dai
 * migliori fantavoti per ruolo, poi scambi 1-a-1 (titolare/riserva stesso ruolo)
 * finché il totale col motore completo cresce (i modificatori dipendono dai voti
 * di reparto, non solo dalla somma). Tutti gli altri giocatori in panchina,
 * ordinati per fantavoto.
 */
export function bestLineup(input: DebriefInput): Lineup | null {
  const teamId = input.suggestion.teamId;
  const pool: Record<PlayerRole, Player[]> = { P: [], D: [], C: [], A: [] };
  for (const p of input.roster) pool[p.role].push(p);
  const fv = (p: Player) => playerFantavoto(p, input.playerData.get(p.id)) ?? -Infinity;
  for (const r of ROLES) pool[r].sort((a, b) => fv(b) - fv(a) || a.name.localeCompare(b.name));
  if (!pool.P.length) return null;

  const build = (picked: Record<PlayerRole, Player[]>, formation: string): Lineup => {
    const starterIds = new Set(ROLES.flatMap((r) => picked[r].map((p) => p.id)));
    const starters = ROLES.flatMap((r) => picked[r]).map((p, i) => ({ playerId: p.id, position: i + 1 }));
    const bench = ROLES.flatMap((r) => pool[r].filter((p) => !starterIds.has(p.id)))
      .map((p, i) => ({ playerId: p.id, position: i + 1 }));
    return { teamId, roundNumber: input.round, formation, starters, bench };
  };

  let best: { lineup: Lineup; total: number } | null = null;
  for (const formation of DEBRIEF_FORMATIONS) {
    const f = parseFormation(formation);
    const need: Record<PlayerRole, number> = { P: 1, D: f.D, C: f.C, A: f.A };
    if (ROLES.some((r) => pool[r].length < need[r])) continue;
    const picked = Object.fromEntries(ROLES.map((r) => [r, pool[r].slice(0, need[r])])) as Record<PlayerRole, Player[]>;
    let total = teamTotal(input, build(picked, formation));
    for (let guard = 0, improved = true; improved && guard < 50; guard++) {
      improved = false;
      for (const r of ROLES) {
        for (let i = 0; i < picked[r].length; i++) {
          for (const cand of pool[r]) {
            if (picked[r].includes(cand)) continue;
            const trial = { ...picked, [r]: picked[r].map((p, j) => (j === i ? cand : p)) };
            const t = teamTotal(input, build(trial, formation));
            if (t > total + 1e-9) {
              picked[r] = trial[r];
              total = t;
              improved = true;
            }
          }
        }
      }
    }
    if (!best || total > best.total + 1e-9) best = { lineup: build(picked, formation), total };
  }
  return best?.lineup ?? null;
}

/** Stessa formazione con la panchina riordinata al meglio (per ruolo, fantavoto decrescente). */
export function withOptimalBench(input: DebriefInput, lineup: Lineup): Lineup {
  const fv = (id: string) => {
    const p = input.players[id];
    return p ? playerFantavoto(p, input.playerData.get(id)) ?? -Infinity : -Infinity;
  };
  const bench = [...lineup.bench]
    .sort((a, b) => fv(b.playerId) - fv(a.playerId) || a.position - b.position)
    .map((s, i) => ({ playerId: s.playerId, position: i + 1 }));
  return { ...lineup, bench };
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('it-IT', { maximumFractionDigits: 2 });
const signed = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;

function scenarioFindings(input: DebriefInput, sc: DebriefScenario, lineup: Lineup): DebriefFinding[] {
  const out: DebriefFinding[] = [];
  const tag = sc.label.toLowerCase();
  // titolari senza voto / non scesi in campo
  for (const p of sc.starters) {
    if (p.fantavoto !== null) continue;
    const sub = p.replacedBy ? sc.bench.find((b) => b.id === p.replacedBy) : null;
    out.push({
      kind: 'sv',
      scenario: sc.key,
      text: sub
        ? `${tag}: ${p.name} senza voto, entra ${sub.name} (${sub.fantavoto === null ? 's.v.' : fmt(sub.fantavoto)})`
        : `${tag}: ${p.name} senza voto e nessun cambio utile${p.counted ? ' (riserva d\'ufficio)' : ''}`,
    });
  }
  // scelte sbagliate: titolare contato peggiore di un panchinaro non entrato dello stesso ruolo
  const usedBench = new Set(sc.bench.filter((b) => b.replaces).map((b) => b.id));
  for (const role of ROLES) {
    const counted = [
      ...sc.starters.filter((p) => p.role === role && p.fantavoto !== null),
      ...sc.bench.filter((p) => p.role === role && usedBench.has(p.id)),
    ].sort((a, b) => (a.fantavoto ?? 0) - (b.fantavoto ?? 0));
    const idle = sc.bench
      .filter((p) => p.role === role && !usedBench.has(p.id) && p.fantavoto !== null)
      .sort((a, b) => (b.fantavoto ?? 0) - (a.fantavoto ?? 0));
    for (let i = 0; i < Math.min(counted.length, idle.length); i++) {
      const diff = (idle[i].fantavoto ?? 0) - (counted[i].fantavoto ?? 0);
      if (diff <= 0) break;
      out.push({
        kind: 'wrong_pick',
        scenario: sc.key,
        points: roundScore(diff),
        text: `${tag}: ${counted[i].name} (${fmt(counted[i].fantavoto ?? 0)}) titolare, ${idle[i].name} in panchina (${fmt(idle[i].fantavoto ?? 0)}): ${signed(diff)} di fantavoto`,
      });
    }
  }
  // ordine panchina
  if (sc.bench.length) {
    const reordered = teamTotal(input, withOptimalBench(input, lineup));
    const diff = reordered - sc.total;
    if (Math.abs(diff) > 1e-9) {
      out.push({
        kind: 'bench_order',
        scenario: sc.key,
        points: roundScore(diff),
        text: `${tag}: con la panchina in ordine ottimale il totale sarebbe ${fmt(reordered)} (${signed(diff)})`,
      });
    }
  }
  const m = sc.modifiers;
  out.push({
    kind: 'modifier',
    scenario: sc.key,
    points: m.total - m.home,
    text: `${tag}: modificatori difesa avversaria ${signed(m.defense)}, centrocampo ${signed(m.midfield)}, attacco ${signed(m.attack)}${m.home ? `, casa ${signed(m.home)}` : ''}; la nostra difesa dà ${signed(sc.opponentDefenseModifier)} all'avversario`,
  });
  return out;
}

function consolidationWarnings(input: DebriefInput, ids: Iterable<string>): string[] {
  const warnings: string[] = [];
  if (input.unfinishedFixtures?.length) {
    warnings.push(`Partite non ancora finite: ${input.unfinishedFixtures.join(', ')}`);
  }
  let live = 0;
  let partial = 0;
  for (const id of new Set(ids)) {
    const d = input.playerData.get(id);
    if (!d) continue;
    if (d.voteSource === 'live') live++;
    else if (d.voteSource === 'consolidated' && (d.paperCount ?? 3) < 3) partial++;
  }
  if (live) warnings.push(`${live} giocatori con voto live/provvisorio (non consolidato)`);
  if (partial) warnings.push(`${partial} giocatori in partite senza tutte e 3 le testate (✓)`);
  return warnings;
}

export function buildDebrief(input: DebriefInput): LineupDebrief {
  const scenarios: Partial<Record<ScenarioKey, DebriefScenario>> = {};
  const lineups: Partial<Record<ScenarioKey, Lineup>> = {};
  const suggested = suggestionToLineup(input.suggestion, input.round);
  if (suggested.starters.length) lineups.suggested = suggested;
  if (input.actualLineup?.starters.length) lineups.actual = input.actualLineup;
  const best = bestLineup(input);
  if (best) lineups.best = best;
  for (const key of ['suggested', 'actual', 'best'] as ScenarioKey[]) {
    const l = lineups[key];
    if (l) scenarios[key] = scoreScenario(input, key, l);
  }

  const findings: DebriefFinding[] = [];
  const unmatched = [...input.suggestion.starters, ...input.suggestion.bench].filter((p) => !p.playerId);
  if (unmatched.length) {
    findings.push({ kind: 'info', scenario: 'suggested', text: `Giocatori consigliati non abbinati (ignorati): ${unmatched.map((p) => p.name).join(', ')}` });
  }
  if (!lineups.actual) findings.push({ kind: 'info', scenario: 'actual', text: 'Nessuna formazione schierata nel DB per questa giornata' });
  for (const key of ['suggested', 'actual'] as ScenarioKey[]) {
    const sc = scenarios[key];
    if (sc && lineups[key]) findings.push(...scenarioFindings(input, sc, lineups[key]!));
  }
  const b = scenarios.best;
  const res = (s: DebriefScenario) => `${s.goalsFor}-${s.goalsAgainst}`;
  for (const key of ['suggested', 'actual'] as ScenarioKey[]) {
    const sc = scenarios[key];
    if (!sc || !b) continue;
    const lost = b.total - sc.total;
    if (sc.formation !== b.formation && lost > 0) {
      const inBest = b.starters.filter((p) => !sc.starters.some((x) => x.id === p.id) && !sc.bench.some((x) => x.id === p.id && x.replaces));
      findings.push({
        kind: 'wrong_pick',
        scenario: key,
        text: `${sc.label.toLowerCase()}: modulo ${sc.formation}, il migliore era ${b.formation}${inBest.length ? ` con ${inBest.map((p) => `${p.name} (${p.fantavoto === null ? 's.v.' : fmt(p.fantavoto)})`).join(', ')}` : ''}`,
      });
    }
    findings.push({
      kind: 'points_lost',
      scenario: key,
      points: roundScore(lost),
      text: `${sc.label}: ${fmt(lost)} punti persi rispetto alla migliore (${fmt(sc.total)} vs ${fmt(b.total)}; risultato ${res(sc)} invece di ${res(b)})`,
    });
  }
  const s = scenarios.suggested;
  const a = scenarios.actual;
  if (s && a) {
    const d = s.total - a.total;
    findings.push({
      kind: 'points_lost',
      text: `Consigliata vs schierata: ${signed(d)} punti (${res(s)} vs ${res(a)})${s.outcome !== a.outcome ? ' — risultato diverso' : ''}`,
      points: roundScore(d),
    });
  }

  const ids = [
    ...Object.values(lineups).flatMap((l) => [...l!.starters, ...l!.bench].map((x) => x.playerId)),
    ...input.opponentLineup.starters.map((x) => x.playerId),
    ...input.opponentLineup.bench.map((x) => x.playerId),
  ];
  const warnings = consolidationWarnings(input, ids);
  return {
    version: 1,
    suggestionId: input.suggestion.id,
    teamId: input.suggestion.teamId,
    opponentTeamId: input.opponentTeamId,
    round: input.round,
    isHome: input.isHome,
    generatedAt: (input.now ?? new Date()).toISOString(),
    warnings,
    consolidated: warnings.length === 0,
    scenarios,
    findings,
  };
}
