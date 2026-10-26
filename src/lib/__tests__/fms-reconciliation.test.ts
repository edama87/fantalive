import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { teams } from '@/data/teams';
import { applyGoalConversionRules, calculateGoals } from '@/lib/scoring-engine';
import {
  parseTabellino,
  reconcileTabellino,
  matchesFmsName, mergeAutonews, minimalDeltas, parseAutonews, parseMiglioriPeggiori, parseTopFlop, parseUltimoTurno,
  reconcileRound, type OurMatch,
} from '@/lib/fms-reconciliation';

const names = teams.map((t) => t.name);
const score = (h: number, a: number): [number, number] => {
  const g = applyGoalConversionRules(h, a, calculateGoals(h), calculateGoals(a));
  return [g.homeGoals, g.awayGoals];
};
const pairings: [string, string][] = [
  ['Yellow Mustard', 'Little Eagles'], ['Salen Team', 'Dinamo Cecchignola 1927'], ['Amatori ProSecco', 'Real Pedrotte'],
  ['Parisso San Gennaro', 'Atletico Magari'], ['Sfortonia', 'Football And City'],
];

describe('parser FMS', () => {
  it('ultimo turno: casa-trasferta', () => {
    const d = parseUltimoTurno('<b>Ultimo turno</b> 7a di Serie A Little Eagles 2 - 1 Salen Team Dinamo Cecchignola 1927 5 - 0 Amatori ProSecco', names);
    expect(d.serieAMatchday).toBe(7);
    expect(d.results).toEqual([
      { home: 'Little Eagles', away: 'Salen Team', homeGoals: 2, awayGoals: 1, ordered: true },
      { home: 'Dinamo Cecchignola 1927', away: 'Amatori ProSecco', homeGoals: 5, awayGoals: 0, ordered: true },
    ]);
  });

  it('migliore e peggiore', () => {
    const t = parseMiglioriPeggiori('Christian P. Dinamo Cecchignola 1927 Campionato 84.497 Voti Mod 68.997 15.5 Vincenzo A. Parisso San Gennaro Campionato 57.163 Voti Mod 61.663 -4.5', names);
    expect(t).toEqual([
      { team: 'Dinamo Cecchignola 1927', total: 84.497, votes: 68.997, modifiers: 15.5 },
      { team: 'Parisso San Gennaro', total: 57.163, votes: 61.663, modifiers: -4.5 },
    ]);
  });

  it('top & flop: salta intestazioni', () => {
    const p = parseTopFlop('Top &amp; Flop 7a di Serie A Top Flop voto mod TOT P Carnesecchi M. ATA - Salen Team 7.166 0 7.166 voto mod TOT P Muric A. A. SAS - Parisso San Gennaro 4 -4 0', names);
    expect(p.map((x) => [x.role, x.name, x.fantaTeam, x.fantavoto])).toEqual([
      ['P', 'Carnesecchi M.', 'Salen Team', 7.166],
      ['P', 'Muric A. A.', 'Parisso San Gennaro', 0],
    ]);
  });

  it('autonews: solo frasi con punteggio e squadra, attribuite alle coppie', () => {
    const html = readFileSync(join(__dirname, 'fixtures/fms-home-autonews.html'), 'utf8');
    const d = parseAutonews(html, pairings);
    expect(d.fantaRound).toBe(2);
    const found = Object.fromEntries(d.results.map((r) => [r.home, [r.homeGoals, r.awayGoals].sort().join('-')]));
    expect(found['Yellow Mustard']).toBe('0-0');
    expect(found['Amatori ProSecco']).toBe('1-4');
    // la frase "2 a 3" nomina solo i manager: non va attribuita a Parisso–Atletico
    expect(found['Parisso San Gennaro']).toBeUndefined();
  });

  it('autonews: letture in conflitto scartate', () => {
    const r = (h: number, a: number) => ({ results: [{ home: 'A', away: 'B', homeGoals: h, awayGoals: a, ordered: false }], teamTotals: [], players: [], sources: [] });
    expect(mergeAutonews([r(2, 1), r(1, 2)]).results).toHaveLength(1);
    expect(mergeAutonews([r(2, 1), r(3, 1)]).results).toHaveLength(0);
  });

  it('nomi FMS abbreviati', () => {
    expect(matchesFmsName('Varela G. M.', 'VARELA Guillermo Maximiliano')).toBe(true);
    expect(matchesFmsName("Calo' G.", "CALO' Giacomo")).toBe(true);
    expect(matchesFmsName('Bremer G. S. N.', 'BARTESAGHI Davide')).toBe(false);
  });
});

describe('confronto', () => {
  const mods = { def: 0, mid: 0, att: 0, home: 2, total: 2 };
  const base: OurMatch = {
    home: 'Salen Team', away: 'Dinamo Cecchignola 1927', homeTotal: 70.663, awayTotal: 65.663, homeGoals: 1, awayGoals: 0,
    homeMods: mods, awayMods: mods,
    homePlayers: [{ name: 'CARNESECCHI Marco', role: 'P', vote: 6.5, fantavoto: 2.5, status: 'played', counted: true }],
    awayPlayers: [],
  };

  it('delta minima per tornare al risultato FMS', () => {
    expect(minimalDeltas(70.663, 65.663, [2, 1], score)).toContainEqual({ team: 'away', delta: 0.5 });
  });

  it('segnala risultato e voto diversi', () => {
    const rep = reconcileRound(2, [base], {
      results: [{ home: 'Salen Team', away: 'Dinamo Cecchignola 1927', homeGoals: 2, awayGoals: 1, ordered: true }],
      teamTotals: [],
      players: [{ role: 'P', name: 'Carnesecchi M.', serieATeam: 'ATA', fantaTeam: 'Salen Team', vote: 6, bonus: -4, fantavoto: 2 }],
      sources: [],
    }, score);
    expect(rep.discrepancies.map((d) => d.field)).toEqual(['risultato', 'voto']);
    expect(rep.discrepancies[0].cause).toContain('Dinamo Cecchignola 1927 +0.5');
  });

  it('tutto ok', () => {
    const rep = reconcileRound(2, [base], { results: [{ home: 'Salen Team', away: 'Dinamo Cecchignola 1927', homeGoals: 1, awayGoals: 0, ordered: true }], teamTotals: [{ team: 'Salen Team', total: 70.663, votes: 0, modifiers: 0 }], players: [], sources: [] }, score);
    expect(rep.discrepancies).toEqual([]);
    expect(rep.checked.every((c) => c.ok)).toBe(true);
  });
});

describe('parseTabellino / reconcileTabellino', () => {
  const html = readFileSync(join(__dirname, 'fixtures', 'fms-tabellino-mini.html'), 'utf8');
  const tab = parseTabellino(html, ['Salen Team', 'Dinamo Cecchignola 1927']);

  it('legge squadre, risultati e colonna casa speculare', () => {
    expect(tab.fantaRound).toBe(2);
    expect(tab.home.team).toBe('Salen Team');
    expect(tab.away.team).toBe('Dinamo Cecchignola 1927');
    expect(tab.home).toMatchObject({ partial: 68.663, homeFactor: 2, modDef: 0, modMid: -0.5, modAtt: 0.5, total: 70.663, goals: 2 });
    expect(tab.away).toMatchObject({ partial: 66.83, modDef: -1, modMid: 0.5, total: 66.33, goals: 1 });
    expect(tab.home.starters).toEqual([
      { role: 'D', name: 'Gallo A.', vote: 6.5, bonus: 0, fantavoto: 6.5, enteredFromBench: false },
      { role: 'A', name: 'Adams A. J.', vote: 6, bonus: 3, fantavoto: 9, enteredFromBench: true },
    ]);
    expect(tab.home.bench[0]).toMatchObject({ role: null, name: 'Couto Y. B.', vote: null });
    expect(tab.home.tribuna.map((p) => p.name)).toEqual(['Sportiello M.']);
    expect(tab.away.starters[0]).toMatchObject({ name: 'Hermoso M.', vote: 5.5, bonus: 0 });
  });

  it('segnala bonus, voti e s.v. diversi', () => {
    const p = (name: string, vote: number, fantavoto: number) => ({ name, role: 'D', vote, fantavoto, status: 'played', counted: true });
    const ds = reconcileTabellino(2, tab, {
      home: { team: 'Salen Team', total: 70.663, goals: 2, mods: { def: 0, mid: -0.5, att: 0.5, home: 2, total: 2 }, counted: [p('GALLO Antonino', 6.5, 6.5), p('ADAMS Akor Jerome', 6, 9)], replaced: [], bench: [p('COLPANI Andrea', 6.5, 6.5)] },
      away: { team: 'Dinamo Cecchignola 1927', total: 65.663, goals: 0, mods: { def: -1, mid: 0.5, att: 0, home: 0, total: -0.5 }, counted: [p('HERMOSO Mario', 5.5, 5)], replaced: [], bench: [p('BRACAGLIA Gabriele', 0, 0)] },
    } as never);
    const keys = ds.map((d) => `${d.subject}|${d.field}|${d.blame}`);
    expect(keys).toContain('Hermoso M. (Dinamo Cecchignola 1927)|bonus/malus|da verificare');
    expect(keys).toContain('Bracaglia G. (Dinamo Cecchignola 1927, panchina)|voto|noi');
    expect(keys.some((k) => k.startsWith('Dinamo Cecchignola 1927') && k.includes('totale'))).toBe(true);
    expect(keys.some((k) => k.startsWith('Salen Team'))).toBe(false);
  });
});
