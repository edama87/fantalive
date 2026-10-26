/**
 * Nota qualitativa del debrief: 4-8 frasi in italiano costruite in modo
 * deterministico dai dati (template a regole, variante scelta con un hash
 * stabile di suggerimento+giornata: stesso debrief -> stesso testo).
 */
import type { LineupSuggestion } from '@/lib/lineup-suggestions';
import type { DebriefPlayer, LineupDebrief } from '@/lib/lineup-debrief';
import { shortName } from '@/lib/player-name';

export interface DebriefNarrative {
  verdict: 'giusta' | 'da rivedere';
  sentences: string[];
}

const SURE_PCT = 75;
const num = (n: number) => (Math.round(n * 100) / 100).toLocaleString('it-IT', { maximumFractionDigits: 2 });
const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`);
const OUTCOME_WORD = { V: 'vittoria', N: 'pareggio', P: 'sconfitta' } as const;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function buildNarrative(d: LineupDebrief, suggestion: LineupSuggestion): DebriefNarrative | null {
  const s = d.scenarios.suggested;
  if (!s) return null;
  const best = d.scenarios.best;
  const actual = d.scenarios.actual;
  let seed = hash(`${d.suggestionId}:${d.round}`);
  const pick = <T,>(options: T[]): T => {
    const v = options[seed % options.length];
    seed = Math.imul(seed ^ (seed >>> 15), 2246822519) >>> 0;
    return v;
  };
  const meta = new Map(
    [...suggestion.starters, ...suggestion.bench].filter((p) => p.playerId).map((p) => [p.playerId as string, p]),
  );
  const pct = (p: DebriefPlayer) => meta.get(p.id)?.startPct ?? null;
  const isGamble = (p: DebriefPlayer) => {
    const m = meta.get(p.id);
    return (m?.startPct != null && m.startPct < SURE_PCT) || /scommess/i.test(m?.note ?? '');
  };
  const name = (p: DebriefPlayer) => shortName(p.name);
  const lost = best ? best.total - s.total : 0;
  const sameAsBest = best ? best.outcome === s.outcome && best.goalsFor - best.goalsAgainst === s.goalsFor - s.goalsAgainst : true;
  const verdict: DebriefNarrative['verdict'] =
    s.outcome === 'P' || (best && best.outcome !== s.outcome) || lost >= 6 ? 'da rivedere' : 'giusta';
  const out: string[] = [];

  // 1. verdetto
  const res = `${s.goalsFor}-${s.goalsAgainst}`;
  if (verdict === 'giusta') {
    out.push(pick([
      `Formazione giusta: ${num(s.total)} punti e ${OUTCOME_WORD[s.outcome]} per ${res}${sameAsBest ? ', lo stesso risultato della migliore possibile' : ''}.`,
      `Nel complesso la scelta ha retto: ${OUTCOME_WORD[s.outcome]} ${res} con ${num(s.total)} punti${sameAsBest ? ', risultato che neanche la formazione ideale avrebbe migliorato' : ''}.`,
      `Consiglio azzeccato nella sostanza: ${res} e ${num(s.total)} punti${lost > 0 ? `, ${num(lost)} sotto il massimo teorico` : ''}.`,
    ]));
  } else {
    out.push(pick([
      `Formazione da rivedere: ${OUTCOME_WORD[s.outcome]} ${res} con ${num(s.total)} punti${best ? `, mentre col senno di poi si poteva arrivare a ${num(best.total)} (${best.goalsFor}-${best.goalsAgainst})` : ''}.`,
      `Il consiglio non ha pagato del tutto: ${res} e ${num(s.total)} punti${best ? `, contro i ${num(best.total)} della migliore possibile` : ''}.`,
    ]));
  }

  // 2. cosa ha funzionato: titolari sicuri
  const sure = s.starters.filter((p) => (pct(p) ?? 0) >= SURE_PCT);
  const delivered = sure.filter((p) => p.fantavoto !== null && p.fantavoto >= 6.5);
  if (delivered.length) {
    out.push(pick([
      `Le certezze hanno risposto: ${list(delivered.map((p) => `${name(p)} (${num(p.fantavoto!)})`))}.`,
      `Tra i titolari sicuri, bene ${list(delivered.map((p) => `${name(p)} (${num(p.fantavoto!)})`))}.`,
    ]));
  }

  // 3. modulo e modificatori
  const m = s.modifiers;
  const modParts: string[] = [];
  if (m.midfield) modParts.push(`centrocampo ${m.midfield > 0 ? '+' : ''}${num(m.midfield)}`);
  if (m.defense) modParts.push(`difesa avversaria ${m.defense > 0 ? '+' : ''}${num(m.defense)}`);
  if (m.attack) modParts.push(`attacco +${num(m.attack)}`);
  const modNet = m.total - m.home;
  const moduleOk = !best || best.formation === s.formation;
  out.push(
    moduleOk
      ? `Il ${s.formation} si è rivelato il modulo giusto${modParts.length ? `; modificatori: ${modParts.join(', ')}` : ''}${m.home ? ', più il +2 casalingo' : ''}.`
      : `Il ${s.formation} ha reso meno del ${best!.formation}${modParts.length ? ` (modificatori: ${modParts.join(', ')}, netto ${modNet > 0 ? '+' : ''}${num(modNet)})` : ''}${m.home ? ', con il +2 casalingo a favore' : ''}.`,
  );

  // 4. cosa è andato storto: s.v. e sorprese di turnover
  const sv = s.starters.filter((p) => p.fantavoto === null);
  const subText = (p: DebriefPlayer) => {
    const sub = s.bench.find((b) => b.replaces === p.id);
    return sub ? `al posto di ${name(p)} è entrato ${name(sub)}${sub.fantavoto !== null ? ` con ${num(sub.fantavoto)}` : ''}` : `${name(p)} non ha avuto un cambio utile`;
  };
  const surprises = sv.filter((p) => (pct(p) ?? 0) >= SURE_PCT);
  const otherSv = sv.filter((p) => !surprises.includes(p) && !isGamble(p));
  if (surprises.length) {
    const many = surprises.length > 1;
    out.push(`Sorpresa di formazione: ${list(surprises.map(name))}, dat${many ? 'i' : 'o'} per titolar${many ? 'i' : 'e'}, ${many ? 'sono rimasti' : 'è rimasto'} senza voto; ${surprises.map(subText).join('; ')}.`);
  }
  if (otherSv.length) out.push(`Pesano i senza voto: ${otherSv.map(subText).join('; ')}.`);

  // 5. scommesse
  const gambles = s.starters.filter(isGamble);
  const won = gambles.filter((p) => p.fantavoto !== null && p.fantavoto >= 7);
  const failed = gambles.filter((p) => p.fantavoto === null || p.fantavoto < 6);
  if (won.length || failed.length) {
    const bits: string[] = [];
    if (won.length) bits.push(`ha pagato ${list(won.map((p) => `${name(p)} (${num(p.fantavoto!)})`))}`);
    if (failed.length) {
      bits.push(`non ${failed.length > 1 ? 'hanno' : 'ha'} reso ${list(failed.map((p) => {
        if (p.fantavoto !== null) return `${name(p)} (${num(p.fantavoto)})`;
        const sub = s.bench.find((b) => b.replaces === p.id);
        return `${name(p)} (s.v.${sub ? `, dentro ${name(sub)}${sub.fantavoto !== null ? ` ${num(sub.fantavoto)}` : ''}` : ''})`;
      }))}`);
    }
    out.push(`Sulle scommesse ${bits.join(', mentre ')}.`);
  }

  // 6. ordine panchina
  const benchFinding = d.findings.find((f) => f.kind === 'bench_order' && f.scenario === 'suggested');
  if (benchFinding?.points && benchFinding.points > 0) {
    out.push(`L'ordine della panchina è costato ${num(benchFinding.points)} punti: chi è entrato non era il migliore disponibile nel ruolo.`);
  }

  // 7. giocatore decisivo
  const counted = [...s.starters, ...s.bench].filter((p) => p.counted && p.fantavoto !== null);
  const top = [...counted].sort((a, b) => b.fantavoto! - a.fantavoto!)[0];
  const missed = best?.starters.filter((p) => !counted.some((c) => c.id === p.id) && p.fantavoto !== null).sort((a, b) => b.fantavoto! - a.fantavoto!)[0];
  if (top) {
    out.push(pick([
      `Decisivo ${name(top)} con ${num(top.fantavoto!)}${missed && missed.fantavoto! >= 7 ? `; è mancato invece ${name(missed)} (${num(missed.fantavoto!)}), rimasto fuori` : ''}.`,
      `L'uomo partita è ${name(top)} (${num(top.fantavoto!)})${missed && missed.fantavoto! >= 7 ? `, mentre ${name(missed)} (${num(missed.fantavoto!)}) è rimasto fuori dai conti` : ''}.`,
    ]));
  }

  // confronto con la schierata
  if (actual && Math.abs(actual.total - s.total) > 0.001) {
    const diff = s.total - actual.total;
    out.push(`Rispetto alla formazione schierata la consigliata avrebbe fatto ${diff > 0 ? '+' : ''}${num(diff)} punti (${s.goalsFor}-${s.goalsAgainst} contro ${actual.goalsFor}-${actual.goalsAgainst}).`);
  }

  // 8. lezione
  const wrong = d.findings.filter((f) => f.kind === 'wrong_pick' && f.scenario === 'suggested' && f.points).reduce((a, f) => a + (f.points ?? 0), 0);
  let lesson: string;
  if (benchFinding?.points && benchFinding.points >= 1) lesson = 'curare l\'ordine della panchina per ruolo, mettendo prima chi ha più probabilità di giocare e di prendere un buon voto';
  else if (!moduleOk && best) lesson = `valutare il ${best.formation} quando in panchina c'è un giocatore in forma nel reparto${missed ? ` (come ${name(missed)})` : ''}, pesando il modificatore difesa`;
  else if (sv.some((p) => (pct(p) ?? 0) >= SURE_PCT)) lesson = 'nei turni con rotazioni non fidarsi delle percentuali di titolarità e tenere riserve affidabili nello stesso ruolo';
  else if (wrong >= 1) lesson = 'rivedere i ballottaggi: un panchinaro ha fatto meglio di un titolare dello stesso ruolo';
  else lesson = 'confermare l\'impostazione, il margine perso è fisiologico';
  out.push(pick([`Lezione per la prossima: ${lesson}.`, `Per la prossima giornata: ${lesson}.`]));

  return { verdict, sentences: out.slice(0, 8) };
}
