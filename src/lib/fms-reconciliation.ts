/**
 * Quadratura con FMS Revo (sito ufficiale della lega).
 *
 * Parser puri per le fonti FMS raggiungibili e confronto con i nostri calcoli
 * (FantasyMatchResult). Nessun I/O qui: il fetch sta nello script / route.
 *
 * Fonti FMS note:
 * - Home pubblica (GET https://bundlesliga.fmsrevo.it/): blocco "Autonews" con i
 *   risultati dell'ultima giornata in prosa (solo gol, niente totali).
 * - Widget (POST template/controller/ctrlWidget.php, richiedono sessione):
 *   ultimo_turno (risultati casa-trasferta), migliore_peggiore (totale/voti/mod di
 *   2 squadre), topflop (voto/bonus/fantavoto di 22 giocatori).
 * - Dettaglio giornata/formazioni con voti: solo da loggati (errors/reserved.php).
 */

export interface FmsMatchResult {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  /** true se casa/trasferta sono certi (widget), false se dedotti dalla prosa. */
  ordered: boolean;
}

export interface FmsTeamTotal {
  team: string;
  total: number;
  votes: number;
  modifiers: number;
}

export interface FmsPlayerLine {
  role: 'P' | 'D' | 'C' | 'A';
  name: string;
  serieATeam: string;
  fantaTeam: string;
  vote: number;
  bonus: number;
  fantavoto: number;
}

export interface FmsRoundData {
  serieAMatchday?: number;
  fantaRound?: number;
  results: FmsMatchResult[];
  teamTotals: FmsTeamTotal[];
  players: FmsPlayerLine[];
  sources: string[];
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à').replace(/&ograve;/g, 'ò').replace(/&ugrave;/g, 'ù').replace(/&igrave;/g, 'ì').replace(/&eacute;/g, 'é')
    .replace(/&times;/g, '×')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normName(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function num(s: string): number {
  return Number(s.replace(',', '.'));
}

function serieAMatchdayFrom(text: string): number | undefined {
  const m = text.match(/(\d+)a (?:di Serie A|giornata)/);
  return m ? Number(m[1]) : undefined;
}

/** Widget "Ultimo turno": "Little Eagles 2 - 1 Salen Team Dinamo ... 5 - 0 ...". */
export function parseUltimoTurno(html: string, teamNames: string[]): FmsRoundData {
  const text = htmlToText(html);
  const results: FmsMatchResult[] = [];
  const names = [...teamNames].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  const re = new RegExp(`(${names})\\s+(\\d+)\\s*-\\s*(\\d+)\\s+(${names})`, 'g');
  for (const m of text.matchAll(re)) {
    results.push({ home: m[1], away: m[4], homeGoals: Number(m[2]), awayGoals: Number(m[3]), ordered: true });
  }
  return { serieAMatchday: serieAMatchdayFrom(text), results, teamTotals: [], players: [], sources: ['widget ultimo_turno'] };
}

/**
 * Autonews della home pubblica: prosa generata a caso ad ogni caricamento, una
 * frase per sfida. A volte c'è il punteggio ("4 a 1"), a volte no ("ne fa uno in
 * più"), e il nome di una squadra può essere sostituito dal manager. Tengo solo i
 * punteggi con un nome di squadra nella STESSA frase, e attribuisco la sfida con le
 * coppie del nostro calendario. Il punteggio resta senza ordine casa/trasferta.
 * Conviene leggere la home più volte e unire (mergeAutonews).
 */
export function parseAutonews(html: string, pairings: [string, string][]): FmsRoundData {
  const text = htmlToText(html);
  const start = text.indexOf('Risultati della');
  if (start < 0) return { results: [], teamTotals: [], players: [], sources: [] };
  const header = text.slice(start, start + 80);
  const fanta = header.match(/Fantagiornata:\s*(\d+)/);
  const next = text.indexOf('Risultati della', start + 10);
  const block = text.slice(start + header.indexOf(fanta?.[0] ?? '') + (fanta?.[0].length ?? 0), next > 0 ? next : start + 3000);
  const teamNames = pairings.flat();
  const nameRe = new RegExp([...teamNames].sort((x, y) => y.length - x.length).map(escapeRe).join('|'), 'g');
  // confine di frase: punto non preceduto da iniziale maiuscola ("Mirko M.")
  const sentences = block.split(/(?<![A-Z])[.!?]\s+/);
  const results: FmsMatchResult[] = [];
  for (const sentence of sentences) {
    const sm = sentence.match(/(\d+)\s+a\s+(\d+)/);
    if (!sm) continue;
    const named = [...sentence.matchAll(nameRe)].map((m) => m[0]);
    if (named.length === 0) continue;
    const pair = pairings.find((pp) => pp.includes(named[named.length - 1]));
    if (!pair) continue;
    if (named.some((n) => !pair.includes(n))) continue; // frase ambigua
    results.push({ home: pair[0], away: pair[1], homeGoals: Number(sm[1]), awayGoals: Number(sm[2]), ordered: false });
  }
  return {
    serieAMatchday: serieAMatchdayFrom(header),
    fantaRound: fanta ? Number(fanta[1]) : undefined,
    results,
    teamTotals: [],
    players: [],
    sources: ['home pubblica (autonews)'],
  };
}

/** Unisce più letture dell'autonews; punteggi in conflitto vengono scartati. */
export function mergeAutonews(reads: FmsRoundData[]): FmsRoundData {
  const by = new Map<string, FmsMatchResult[]>();
  for (const r of reads) for (const x of r.results) {
    const k = `${x.home}|${x.away}`;
    by.set(k, [...(by.get(k) ?? []), x]);
  }
  const results: FmsMatchResult[] = [];
  for (const list of by.values()) {
    const keys = new Set(list.map((x) => [x.homeGoals, x.awayGoals].sort().join('-')));
    if (keys.size === 1) results.push(list[0]);
  }
  const first = reads.find((r) => r.fantaRound) ?? reads[0];
  return { ...(first ?? { teamTotals: [], players: [] }), results, teamTotals: [], players: [], sources: [`home pubblica (autonews, ${reads.length} letture)`] } as FmsRoundData;
}

/** Widget "Migliore e peggiore": "Christian P. Dinamo Cecchignola 1927 Campionato 84.497 Voti Mod 68.997 15.5". */
export function parseMiglioriPeggiori(html: string, teamNames: string[]): FmsTeamTotal[] {
  const text = htmlToText(html);
  const names = [...teamNames].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  const re = new RegExp(`(${names})\\s+Campionato\\s+(-?[\\d.,]+)\\s+Voti\\s+Mod\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)`, 'g');
  return [...text.matchAll(re)].map((m) => ({ team: m[1], total: num(m[2]), votes: num(m[3]), modifiers: num(m[4]) }));
}

/** Widget "Top & Flop": "D Provstgaard O. LAZ - Real Pedrotte 8 3 11". */
export function parseTopFlop(html: string, teamNames: string[]): FmsPlayerLine[] {
  const text = htmlToText(html).replace(/\d+a di Serie A|Top & Flop|\bTop\b|\bFlop\b|voto mod TOT/g, ' ');
  const names = [...teamNames].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  const re = new RegExp(`\\b([PDCA])\\s+(.+?)\\s+([A-Z]{3})\\s+-\\s+(${names})\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)\\s+(-?[\\d.,]+)`, 'g');
  return [...text.matchAll(re)].map((m) => ({
    role: m[1] as FmsPlayerLine['role'],
    name: m[2].trim(),
    serieATeam: m[3],
    fantaTeam: m[4],
    vote: num(m[5]),
    bonus: num(m[6]),
    fantavoto: num(m[7]),
  }));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Confronto

export interface OurPlayer {
  name: string; // "COGNOME Nome"
  role: string;
  vote: number;
  fantavoto: number;
  status: string;
  substitutedFor?: string;
  counted: boolean;
}

export interface OurMatch {
  home: string;
  away: string;
  homeTotal: number;
  awayTotal: number;
  homeGoals: number;
  awayGoals: number;
  homeMods: { def: number; mid: number; att: number; home: number; total: number };
  awayMods: { def: number; mid: number; att: number; home: number; total: number };
  homePlayers: OurPlayer[];
  awayPlayers: OurPlayer[];
}

export type Blame = 'noi' | 'fms' | 'fonte voti' | 'da verificare';

export interface Discrepancy {
  level: 'sfida' | 'squadra' | 'giocatore';
  subject: string;
  field: string;
  ours: string;
  fms: string;
  cause: string;
  blame: Blame;
}

export interface ReconcileReport {
  round: number;
  checked: { field: string; subject: string; ok: boolean }[];
  discrepancies: Discrepancy[];
  coverage: string[];
}

const EPS = 0.01;

/** Calcolo gol della lega (soglie + regole di conversione), iniettato dal chiamante. */
export type ScoreFn = (homeTotal: number, awayTotal: number) => [number, number];

/**
 * Più piccola variazione (passo 0,5, entro ±6) del totale di UNA squadra che porta
 * al risultato FMS. Dice quanto "manca" e a chi: una delta di 0,5 di solito è un
 * modificatore CEN o un mezzo voto, 1 un modificatore DIF/ATT, 3 un bonus.
 */
export function minimalDeltas(home: number, away: number, target: [number, number], score: ScoreFn): { team: 'home' | 'away'; delta: number }[] {
  const out: { team: 'home' | 'away'; delta: number }[] = [];
  for (const team of ['home', 'away'] as const) {
    let best: number | null = null;
    for (let k = 1; k <= 24 && best === null; k++) {
      for (const sign of [1, -1]) {
        const d = sign * k * 0.5;
        const [hg, ag] = team === 'home' ? score(home + d, away) : score(home, away + d);
        if (hg === target[0] && ag === target[1]) { best = d; break; }
      }
    }
    if (best !== null) out.push({ team, delta: best });
  }
  return out;
}

/** Abbina "Provstgaard O." (FMS) a "PROVSTGAARD Oliver" (nostro). */
export function matchesFmsName(fms: string, ours: string): boolean {
  const f = normName(fms).split(' ').filter((t) => t.length > 1);
  const o = normName(ours);
  return f.length > 0 && f.every((t) => o.split(' ').includes(t));
}

function fmt(n: number): string {
  return Number.isFinite(n) ? (Math.round(n * 1000) / 1000).toString() : '—';
}

export function reconcileRound(round: number, ours: OurMatch[], fms: FmsRoundData, score: ScoreFn): ReconcileReport {
  const discrepancies: Discrepancy[] = [];
  const checked: ReconcileReport['checked'] = [];
  const key = (a: string, b: string) => [normName(a), normName(b)].sort().join('|');

  for (const r of fms.results) {
    const m = ours.find((o) => key(o.home, o.away) === key(r.home, r.away));
    const subject = `${r.home} – ${r.away}`;
    if (!m) {
      discrepancies.push({ level: 'sfida', subject, field: 'abbinamento', ours: 'assente', fms: `${r.homeGoals}-${r.awayGoals}`, cause: 'Sfida FMS non presente nel nostro calendario', blame: 'noi' });
      continue;
    }
    let fHome = r.homeGoals;
    let fAway = r.awayGoals;
    if (r.ordered && normName(r.home) !== normName(m.home)) [fHome, fAway] = [fAway, fHome];
    const ourScore = `${m.homeGoals}-${m.awayGoals}`;
    let ok: boolean;
    let fmsScore: string;
    if (r.ordered) {
      ok = fHome === m.homeGoals && fAway === m.awayGoals;
      fmsScore = `${fHome}-${fAway}`;
    } else {
      const fs = [fHome, fAway].sort().join('-');
      ok = fs === [m.homeGoals, m.awayGoals].sort().join('-');
      fmsScore = `${Math.max(fHome, fAway)}-${Math.min(fHome, fAway)} (ordine dalla prosa)`;
    }
    checked.push({ field: 'risultato', subject: `${m.home} – ${m.away}`, ok });
    if (!ok) {
      const hints: string[] = [];
      const targets: [number, number][] = r.ordered || fHome === fAway ? [[fHome, fAway]] : [[fHome, fAway], [fAway, fHome]];
      for (const t of targets) {
        const ds = minimalDeltas(m.homeTotal, m.awayTotal, t, score);
        const prefix = targets.length > 1 ? `se ${t[0]}-${t[1]}: ` : '';
        hints.push(prefix + (ds.length
          ? ds.map((d) => `${d.team === 'home' ? m.home : m.away} ${d.delta > 0 ? '+' : ''}${fmt(d.delta)} (noi ${fmt(d.team === 'home' ? m.homeTotal : m.awayTotal)})`).join(' oppure ')
          : 'serve cambiare entrambi i totali'));
      }
      discrepancies.push({
        level: 'sfida', subject: `${m.home} – ${m.away}`, field: 'risultato', ours: ourScore, fms: fmsScore,
        cause: `Basta variare un totale: ${hints.join(' · ')}. Cause tipiche: voto diverso (fonte), sostituzione/s.v. diversa, modificatore DIF/CEN calcolato diverso.`,
        blame: 'da verificare',
      });
    }
  }

  for (const t of fms.teamTotals) {
    const m = ours.find((o) => normName(o.home) === normName(t.team) || normName(o.away) === normName(t.team));
    if (!m) continue;
    const isHome = normName(m.home) === normName(t.team);
    const ourTot = isHome ? m.homeTotal : m.awayTotal;
    const ok = Math.abs(ourTot - t.total) < EPS;
    checked.push({ field: 'totale', subject: t.team, ok });
    if (!ok) {
      discrepancies.push({ level: 'squadra', subject: t.team, field: 'totale', ours: fmt(ourTot), fms: fmt(t.total), cause: `Differenza ${fmt(ourTot - t.total)}. FMS: voti ${fmt(t.votes)}, mod ${fmt(t.modifiers)}.`, blame: 'da verificare' });
    }
  }

  for (const p of fms.players) {
    const m = ours.find((o) => normName(o.home) === normName(p.fantaTeam) || normName(o.away) === normName(p.fantaTeam));
    if (!m) continue;
    const list = normName(m.home) === normName(p.fantaTeam) ? m.homePlayers : m.awayPlayers;
    const op = list.find((x) => matchesFmsName(p.name, x.name));
    const subject = `${p.name} (${p.fantaTeam})`;
    // Top & Flop FMS pesca da tutta la rosa (anche non schierati): se non è nella
    // nostra formazione non è una differenza.
    if (!op) continue;
    if (!op.counted) {
      discrepancies.push({ level: 'giocatore', subject, field: 'conteggiato', ours: op.status, fms: `fv ${fmt(p.fantavoto)}`, cause: 'Noi lo escludiamo (s.v./sostituito), FMS lo conta: sostituzioni diverse', blame: 'da verificare' });
    }
    const vOk = Math.abs(op.vote - p.vote) < EPS;
    const fvOk = Math.abs(op.fantavoto - p.fantavoto) < EPS;
    const ourBonus = op.fantavoto - op.vote;
    const bOk = Math.abs(ourBonus - p.bonus) < EPS;
    checked.push({ field: 'voto', subject, ok: vOk }, { field: 'bonus/malus', subject, ok: bOk }, { field: 'fantavoto', subject, ok: fvOk });
    if (!vOk) discrepancies.push({ level: 'giocatore', subject, field: 'voto', ours: fmt(op.vote), fms: fmt(p.vote), cause: 'Voto base diverso: FMS usa Gazzetta (master); controllare la nostra fonte/consolidato', blame: 'fonte voti' });
    if (!bOk) discrepancies.push({ level: 'giocatore', subject, field: 'bonus/malus', ours: fmt(ourBonus), fms: fmt(p.bonus), cause: 'Evento bonus/malus diverso (gol, assist, ammonizione, rigore, autogol, gol subiti)', blame: 'da verificare' });
  }

  const coverage = [
    `risultati: ${fms.results.length} sfide (${fms.results.every((r) => r.ordered) ? 'casa/trasferta certi' : 'in parte dalla prosa'})`,
    `totali squadra: ${fms.teamTotals.length}`,
    `giocatori: ${fms.players.length}`,
    'non disponibili senza login: voti di tutti i giocatori, sostituzioni, singoli modificatori DIF/CEN/ATT, fattore casa',
  ];
  return { round, checked, discrepancies, coverage };
}

// ---------------------------------------------------------------------------
// Tabellino FMS (modale "TABELLINI", richiede login): dettaglio completo di una sfida.

export interface FmsTabellinoPlayer {
  /** Ruolo; null per i titolari sostituiti (in panchina con ruolo "-"). */
  role: 'P' | 'D' | 'C' | 'A' | null;
  name: string;
  /** null = s.v. / non a voto ("-"). */
  vote: number | null;
  bonus: number | null;
  fantavoto: number | null;
  /** Titolare finale entrato dalla panchina (ruolo "DR", "CR", ...). */
  enteredFromBench: boolean;
}

export interface FmsTabellinoSide {
  team: string;
  goals: number;
  total: number;
  partial: number;
  homeFactor: number;
  modDef: number;
  modMid: number;
  modAtt: number;
  malus: number;
  /** Gli 11 che contano (dopo le sostituzioni). */
  starters: FmsTabellinoPlayer[];
  bench: FmsTabellinoPlayer[];
  tribuna: FmsTabellinoPlayer[];
}

export interface FmsTabellino {
  serieAMatchday?: number;
  fantaRound?: number;
  home: FmsTabellinoSide;
  away: FmsTabellinoSide;
}

function cellText(s: string): string {
  return htmlToText(s).replace(/&#0?39;|&apos;/g, "'");
}

function numOrNull(s: string): number | null {
  const t = s.trim();
  return t === '-' || t === '' ? null : num(t);
}

function parseRows(tableHtml: string): FmsTabellinoPlayer[] {
  const out: FmsTabellinoPlayer[] = [];
  for (const tr of tableHtml.match(/<tr\b[\s\S]*?<\/tr>/g) ?? []) {
    const tds = [...tr.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)].map((m) => ({ attrs: m[1], html: m[2], text: cellText(m[2]) }));
    const nameIdx = tds.findIndex((t) => /formazioni__name/.test(t.html));
    const roleIdx = tds.findIndex((t) => /top-flop__role/.test(t.attrs));
    if (nameIdx < 0 || roleIdx < 0) continue;
    // La colonna casa del desktop è speculare (fv, bonus, voto, nome, ruolo).
    const mirrored = roleIdx > nameIdx;
    const nums = tds.filter((t, i) => i !== nameIdx && i !== roleIdx && /text-center/.test(t.attrs)).map((t) => t.text);
    if (nums.length < 3) continue;
    const [v, b, fv] = mirrored ? nums.slice(0, 3).reverse() : nums.slice(-3);
    const roleRaw = tds[roleIdx].text.trim();
    const r = roleRaw.charAt(0);
    out.push({
      role: (['P', 'D', 'C', 'A'].includes(r) ? r : null) as FmsTabellinoPlayer['role'],
      name: cellText(tds[nameIdx].html),
      vote: numOrNull(v),
      bonus: numOrNull(b),
      fantavoto: numOrNull(fv),
      enteredFromBench: /^[PDCA]R$/.test(roleRaw),
    });
  }
  return out;
}

function sectionBetween(html: string, startId: string, endMarker: string): string {
  const s = html.indexOf(`id="${startId}"`);
  if (s < 0) return '';
  const e = html.indexOf(endMarker, s + startId.length);
  return html.slice(s, e > s ? e : undefined);
}

function parseResultBlock(block: string): Omit<FmsTabellinoSide, 'team' | 'starters' | 'bench' | 'tribuna'> {
  const get = (label: string) => {
    // casa: valore prima dell'etichetta; trasferta: etichetta prima del valore
    const m = block.match(new RegExp(`>(-?[\\d.]+)</div>\\s*<span>${label}</span>`))
      ?? block.match(new RegExp(`<span>${label}</span>\\s*<div[^>]*>(-?[\\d.]+)</div>`));
    return m ? num(m[1]) : NaN;
  };
  return {
    partial: get('Parziale Squadra'), homeFactor: get('Fattore Campo'), modDef: get('Mod Difesa'),
    modMid: get('Mod Centrocampo'), modAtt: get('Mod Attacco'), malus: get('Malus formazione non inviata'),
    total: get('Totale Squadra'), goals: get('Gol'),
  };
}

/** Parser del tabellino (versione desktop: colonne --left = casa, --right = trasferta). */
export function parseTabellino(html: string, teamNames: string[]): FmsTabellino {
  const text = htmlToText(html);
  const names = [...teamNames].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  const found = [...text.matchAll(new RegExp(names, 'g'))].map((m) => m[0]);
  const [homeName, awayName] = [found[0], found.find((n) => n !== found[0])];
  const blocks = html.split('tabellino__risultati-partita').slice(1, 3);
  const side = (dir: 'left' | 'right', team: string | undefined, block: string): FmsTabellinoSide => {
    const titolari = sectionBetween(html, `titolari--${dir}`, '</table>');
    const panchinaTab = sectionBetween(html, `panchina--${dir}`, dir === 'left' ? 'id="titolari--right"' : 'tabellino__risultati-partita');
    const [benchTable, tribunaTable] = panchinaTab.split(/<th colspan="5">tribuna<\/th>/);
    return {
      team: team ?? '', ...parseResultBlock(block ?? ''),
      starters: parseRows(titolari), bench: parseRows(benchTable ?? ''), tribuna: parseRows(tribunaTable ?? ''),
    };
  };
  const fanta = text.match(/Fantagiornata:\s*(\d+)/);
  return {
    serieAMatchday: serieAMatchdayFrom(text),
    fantaRound: fanta ? Number(fanta[1]) : undefined,
    home: side('left', homeName, blocks[0]),
    away: side('right', awayName, blocks[1]),
  };
}

export interface OurSideDetail {
  team: string;
  total: number;
  goals: number;
  mods: { def: number; mid: number; att: number; home: number; total: number };
  /** Gli 11 che contano per noi (titolari a voto + entrati), con eventuali s.v. rimasti. */
  counted: OurPlayer[];
  /** Titolari usciti per s.v. (sostituiti). */
  replaced: OurPlayer[];
  /** Panchina non entrata (per controllare i voti). */
  bench: OurPlayer[];
}

/** Confronto completo di una sfida col tabellino FMS. */
export function reconcileTabellino(
  round: number,
  tab: FmsTabellino,
  ours: { home: OurSideDetail; away: OurSideDetail },
): Discrepancy[] {
  const out: Discrepancy[] = [];
  const sfida = `${tab.home.team} – ${tab.away.team}`;
  const push = (d: Omit<Discrepancy, 'level'> & { level?: Discrepancy['level'] }) => out.push({ level: 'giocatore', ...d });
  for (const [f, o] of [[tab.home, ours.home], [tab.away, ours.away]] as const) {
    const ourPartial = Math.round((o.total - o.mods.total) * 1000) / 1000;
    const checks: [string, number, number][] = [
      ['totale', o.total, f.total], ['parziale (somma fantavoti)', ourPartial, f.partial],
      ['fattore campo', o.mods.home, f.homeFactor], ['mod difesa', o.mods.def, f.modDef],
      ['mod centrocampo', o.mods.mid, f.modMid], ['mod attacco', o.mods.att, f.modAtt],
    ];
    for (const [field, a, b] of checks) {
      if (!(Math.abs(a - b) < EPS)) {
        out.push({ level: 'squadra', subject: `${f.team} (${sfida})`, field, ours: fmt(a), fms: fmt(b), cause: field.startsWith('mod') || field === 'fattore campo' ? 'Modificatore calcolato diversamente: vedi input/fasce' : 'Somma dei fantavoti diversa: vedi righe giocatore', blame: 'da verificare' });
      }
    }
    // giocatori che contano
    const fmsCounted = f.starters;
    for (const fp of fmsCounted) {
      const op = o.counted.find((x) => matchesFmsName(fp.name, x.name));
      const subject = `${fp.name} (${f.team})`;
      if (!op) {
        const inBench = o.bench.find((x) => matchesFmsName(fp.name, x.name));
        const wasReplaced = o.replaced.find((x) => matchesFmsName(fp.name, x.name));
        push({ subject, field: 'sostituzione', ours: inBench ? `in panchina, non entrato (voto ${fmt(inBench.vote)})` : wasReplaced ? 'sostituito (s.v.)' : 'assente', fms: `${fp.enteredFromBench ? 'entrato' : 'titolare'}, fv ${fmt(fp.fantavoto ?? NaN)}`, cause: inBench ? 'FMS lo fa entrare, noi no: ordine panchina/regola sostituzioni o s.v. del titolare diverso' : 'Formazione o sostituzione diversa', blame: 'da verificare' });
        continue;
      }
      compareVotes(fp, op, subject, push);
    }
    for (const op of o.counted) {
      if (!fmsCounted.some((fp) => matchesFmsName(fp.name, op.name))) {
        const fb = [...f.bench, ...f.tribuna].find((fp) => matchesFmsName(fp.name, op.name));
        push({ subject: `${op.name} (${f.team})`, field: 'sostituzione', ours: `conta (${op.substitutedFor ? `entrato per ${op.substitutedFor}` : 'titolare'}, fv ${fmt(op.fantavoto)})`, fms: fb ? `non conta (${fb.role === null ? 'titolare sostituito' : 'panchina'}, voto ${fb.vote ?? 's.v.'})` : 'assente', cause: 'Sostituzione diversa', blame: 'da verificare' });
      }
    }
    // voti dei panchinari (non contano ma rivelano differenze di fonte)
    for (const fp of f.bench) {
      const op = o.bench.find((x) => matchesFmsName(fp.name, x.name));
      if (op && fp.role !== null) compareVotes(fp, op, `${fp.name} (${f.team}, panchina)`, push, true);
    }
  }
  return out;
}

function compareVotes(
  fp: FmsTabellinoPlayer,
  op: OurPlayer,
  subject: string,
  push: (d: Omit<Discrepancy, 'level'> & { level?: Discrepancy['level'] }) => void,
  benchOnly = false,
) {
  const fmsVote = fp.vote ?? 0;
  const ourVote = op.vote;
  const note = benchOnly ? ' (non incide sul totale)' : '';
  if (fp.vote === null && ourVote > 0) {
    push({ subject, field: 'voto', ours: fmt(ourVote), fms: 's.v.', cause: `FMS senza voto, noi a voto${note}`, blame: 'fonte voti' });
    return;
  }
  if (fp.vote !== null && ourVote === 0) {
    push({ subject, field: 'voto', ours: 's.v.', fms: fmt(fmsVote), cause: `Noi senza voto, FMS a voto${note}: manca il voto nel nostro consolidato`, blame: 'noi' });
    return;
  }
  if (Math.abs(fmsVote - ourVote) >= EPS) {
    push({ subject, field: 'voto', ours: fmt(ourVote), fms: fmt(fmsVote), cause: `Voto base diverso (${fmt(ourVote - fmsVote)})${note}: una testata ha un voto diverso nella nostra media`, blame: 'fonte voti' });
  }
  const ourBonus = Math.round((op.fantavoto - op.vote) * 1000) / 1000;
  if (fp.bonus !== null && Math.abs(ourBonus - fp.bonus) >= EPS) {
    push({ subject, field: 'bonus/malus', ours: fmt(ourBonus), fms: fmt(fp.bonus), cause: `Evento bonus/malus diverso${note}`, blame: 'da verificare' });
  }
}
