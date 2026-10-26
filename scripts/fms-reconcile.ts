/**
 * Quadratura FMS Revo (sola lettura): confronta i nostri calcoli delle giornate
 * con i dati FMS raggiungibili senza credenziali.
 *
 *   npx tsx --env-file=.env.local scripts/fms-reconcile.ts [round...]
 *
 * Fonti: home pubblica FMS (GET, autonews ultima giornata) e widget salvati in
 * uploads/fmsrevo/ (ultimo_turno, migliore_peggiore, topflop). Nessuna scrittura
 * su DB, nessun login, nessun invio su FMS.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { teams } from '@/data/teams';
import { calendar } from '@/data/calendar';
import { applyGoalConversionRules, calculateGoals } from '@/lib/scoring-engine';
import { computeRoundMatches } from '@/lib/round-matches-server';
import type { FantasyMatchResult, PlayerScore } from '@/types';
import {
  mergeAutonews, parseAutonews, parseTabellino, reconcileTabellino, type FmsTabellino, type OurSideDetail, parseMiglioriPeggiori, parseTopFlop, parseUltimoTurno, reconcileRound,
  type FmsRoundData, type OurMatch, type OurPlayer,
} from '@/lib/fms-reconciliation';

const score = (h: number, a: number): [number, number] => {
  const g = applyGoalConversionRules(h, a, calculateGoals(h), calculateGoals(a));
  return [g.homeGoals, g.awayGoals];
};
const AUTONEWS_READS = Number(process.env.FMS_AUTONEWS_READS ?? 6);
const FMS_HOME = 'https://bundlesliga.fmsrevo.it/';
const UPLOADS = join(process.cwd(), 'uploads/fmsrevo');
const teamNames = teams.map((t) => t.name);
const teamName = new Map(teams.map((t) => [t.id, t.name]));

function fantaRoundFor(serieA?: number): number | undefined {
  return calendar.find((r) => r.serieAMatchday === serieA)?.number;
}

function toOurPlayers(list: PlayerScore[]): OurPlayer[] {
  return list.filter((p) => !p.isUnusedBench).map((p) => ({
    name: p.player.name, role: p.player.role, vote: p.baseVote, fantavoto: p.fantavoto, status: p.status,
    substitutedFor: p.substitutedFor?.name, counted: p.status !== 'sv' && p.status !== 'substituted',
  }));
}

function side(m: FantasyMatchResult, which: 'home' | 'away'): OurSideDetail {
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
  };
}

/** Tabellini salvati da scripts/fms-fetch-tabellini.ts (uploads/fmsrevo/rounds/). */
function loadTabellini(): FmsTabellino[] {
  const dir = join(UPLOADS, 'rounds');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^tabellino-\d+\.html$/.test(f))
    .map((f) => parseTabellino(readFileSync(join(dir, f), 'utf8'), teamNames));
}

function toOur(m: FantasyMatchResult): OurMatch {
  const mods = (x: FantasyMatchResult['homeModifiers']) => ({ def: x.defenseModifier, mid: x.midfieldModifier, att: x.attackModifier, home: x.homeBonus, total: x.total });
  return {
    home: teamName.get(m.homeTeamId) ?? m.homeTeamId, away: teamName.get(m.awayTeamId) ?? m.awayTeamId,
    homeTotal: m.homeTotal, awayTotal: m.awayTotal, homeGoals: m.homeGoals, awayGoals: m.awayGoals,
    homeMods: mods(m.homeModifiers), awayMods: mods(m.awayModifiers),
    homePlayers: toOurPlayers(m.homePlayerScores), awayPlayers: toOurPlayers(m.awayPlayerScores),
  };
}

function readWidget(name: string): string | null {
  const f = join(UPLOADS, `idFsq11.widget.${name}.html`);
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
}

async function collectFms(): Promise<Map<number, FmsRoundData>> {
  const byRound = new Map<number, FmsRoundData>();
  const merge = (round: number | undefined, d: Partial<FmsRoundData>) => {
    if (!round) return;
    const cur = byRound.get(round) ?? { results: [], teamTotals: [], players: [], sources: [] };
    if (d.results?.length && !cur.results.some((r) => r.ordered)) cur.results = d.results;
    cur.teamTotals.push(...(d.teamTotals ?? []));
    cur.players.push(...(d.players ?? []));
    cur.sources.push(...(d.sources ?? []));
    byRound.set(round, cur);
  };

  // Widget salvati (sessione del 23/10): giornata indicata nel titolo del widget
  const ut = readWidget('ultimo_turno-2-11-on');
  if (ut) { const d = parseUltimoTurno(ut, teamNames); merge(fantaRoundFor(d.serieAMatchday), d); }
  const mp = readWidget('migliore_peggiore-7-X-X');
  const tf = readWidget('topflop-16-X-X');
  for (const [html, kind] of [[mp, 'mp'], [tf, 'tf']] as const) {
    if (!html) continue;
    const sa = Number(html.replace(/<[^>]+>/g, ' ').match(/(\d+)a di Serie A/)?.[1]);
    const round = fantaRoundFor(sa);
    if (kind === 'mp') merge(round, { teamTotals: parseMiglioriPeggiori(html, teamNames), sources: ['widget migliore_peggiore (salvato)'] });
    else merge(round, { players: parseTopFlop(html, teamNames), sources: ['widget topflop (salvato)'] });
  }

  // Home pubblica: autonews dell'ultima giornata (solo GET, senza login). La prosa
  // cambia a ogni caricamento: leggo più volte, con una pausa, e unisco.
  const reads: FmsRoundData[] = [];
  for (let i = 0; i < AUTONEWS_READS; i++) {
    try {
      const res = await fetch(FMS_HOME, { headers: { 'User-Agent': 'Mozilla/5.0 FantaLive quadratura' } });
      if (!res.ok) continue;
      const html = await res.text();
      const head = parseAutonews(html, []);
      const round = head.fantaRound ?? fantaRoundFor(head.serieAMatchday);
      const def = round ? calendar.find((r) => r.number === round) : undefined;
      if (!def) continue;
      const pairings = def.pairings.map((pp) => [teamName.get(pp.homeTeamId)!, teamName.get(pp.awayTeamId)!] as [string, string]);
      reads.push(parseAutonews(html, pairings));
    } catch (e) {
      console.warn('Home FMS non raggiungibile:', (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (reads.length) {
    const merged = mergeAutonews(reads);
    merge(merged.fantaRound ?? fantaRoundFor(merged.serieAMatchday), merged);
  }
  return byRound;
}

async function main() {
  const rounds = process.argv.slice(2).map(Number).filter(Boolean);
  const wanted = rounds.length ? rounds : [1, 2];
  const fms = await collectFms();
  const out = [];
  const tabellini = loadTabellini();
  for (const r of wanted) {
    const { matches } = await computeRoundMatches(r);
    const tabs = tabellini.filter((t) => t.fantaRound === r);
    if (tabs.length) {
      const all = [];
      console.log(`\n=== Giornata ${r} — tabellini FMS (${tabs.length})`);
      for (const t of tabs) {
        const m = matches.find((x) => teamName.get(x.homeTeamId) === t.home.team && teamName.get(x.awayTeamId) === t.away.team);
        if (!m) { console.log('  ✗ sfida non trovata:', t.home.team, t.away.team); continue; }
        const ds = reconcileTabellino(r, t, { home: side(m, 'home'), away: side(m, 'away') });
        console.log(`  ${t.home.team} – ${t.away.team}: noi ${m.homeGoals}-${m.awayGoals} (${m.homeTotal} – ${m.awayTotal}) | FMS ${t.home.goals}-${t.away.goals} (${t.home.total} – ${t.away.total})`);
        for (const d of ds) console.log(`    ✗ [${d.level}] ${d.subject} · ${d.field}: noi ${d.ours} | FMS ${d.fms} → ${d.cause} [${d.blame}]`);
        all.push({ sfida: `${t.home.team} – ${t.away.team}`, ours: [m.homeGoals, m.awayGoals, m.homeTotal, m.awayTotal], fms: [t.home.goals, t.away.goals, t.home.total, t.away.total], discrepancies: ds });
      }
      out.push({ round: r, source: 'tabellini FMS', matches: all });
      continue;
    }
    const ours = matches.map(toOur);
    const data = fms.get(r) ?? { results: [], teamTotals: [], players: [], sources: [] };
    const rep = reconcileRound(r, ours, data, score);
    out.push({ ...rep, sources: data.sources, ours });
    const ok = rep.checked.filter((c) => c.ok).length;
    console.log(`\n=== Giornata ${r} — fonti: ${data.sources.join(', ') || 'nessuna'} — controlli ${ok}/${rep.checked.length} ok`);
    for (const c of rep.coverage) console.log('  ·', c);
    for (const d of rep.discrepancies) console.log(`  ✗ [${d.level}] ${d.subject} · ${d.field}: noi ${d.ours} | FMS ${d.fms}\n      → ${d.cause} [${d.blame}]`);
  }
  const outFile = process.env.FMS_RECONCILE_OUT ?? '/workspace/fms-reconcile.json';
  writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.log(`\nReport JSON: ${outFile}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
