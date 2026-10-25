/**
 * Voti ufficiali pianetafanta (export Excel "Esporta Excel" da
 * pianetafanta.it/voti-fantacalcio): Gazzetta (G), Corriere (CS),
 * Tuttosport (TS) e bonus/malus. Sono i voti consolidati della giornata.
 *
 * Colonne (legenda pianetafanta): per ogni testata voto, GF (gol fatti),
 * GS (gol subiti), Aut (autogol), Ass (assist), AdF (assist da fermo); poi
 * M2/M3 (medie), Amm, Esp, Gdv/Gdp (gol decisivo vittoria/pareggio),
 * RigS (rigore sbagliato), RigP (rigore parato), Rt (rigore trasformato),
 * Rs (rigore subito), T (titolare 1/0), VG/VC/VTS (fantavoti per testata).
 * Min = minuto del cambio (uscita se titolare, ingresso se subentrato),
 * MinU = minuto di uscita di un subentrato poi sostituito.
 */

import {
  canonicalTeamCode,
  matchFantacalcioPlayer,
  normalizePlayerName,
  type FantacalcioAlias,
  type FantacalcioBonus,
  type FantacalcioBonusType,
  type FantacalcioCatalogPlayer,
} from '@/lib/fantacalcio-it';
import type { PlayerRole } from '@/types';

import { averageOfVotes } from '@/lib/vote-precision';

export const PIANETAFANTA_SOURCE = 'pianetafanta';

export { pianetafantaVotesUrl } from '@/lib/pianetafanta-url';

export type PianetafantaOutlet = 'gazzetta' | 'corriere' | 'tuttosport';

export interface PianetafantaPlayer {
  sourceId: string;
  name: string;
  role: PlayerRole | null;
  team: string;
  teamCode: string | null;
  starter: boolean;
  votes: Record<PianetafantaOutlet, number | null>;
  /** Media dei voti presenti (null se tutte le testate danno s.v.). */
  average: number | null;
  /** Quante testate hanno dato un voto (0-3). */
  voteCount: number;
  bonuses: FantacalcioBonus[];
  subIn: number | null;
  subOut: number | null;
  minutesPlayed: number;
}

export interface PianetafantaFile {
  /** Giornata di Serie A letta dall'intestazione ("Giornata: 7 · ..."). */
  serieAMatchday: number | null;
  players: PianetafantaPlayer[];
}

const BONUS_LABELS: Record<FantacalcioBonusType, string> = {
  goal: 'Gol segnato',
  penalty_scored: 'Rigore segnato',
  penalty_missed: 'Rigore sbagliato',
  penalty_saved: 'Rigore parato',
  assist: 'Assist',
  own_goal: 'Autogol',
  yellow_card: 'Ammonizione',
  red_card: 'Espulsione',
  goal_conceded: 'Gol subito',
};

const OUTLET_HEADERS: Record<PianetafantaOutlet, string> = { gazzetta: 'G', corriere: 'CS', tuttosport: 'TS' };
const BLOCK_FIELDS = ['GF', 'GS', 'Aut', 'Ass', 'AdF'] as const;
type BlockField = (typeof BLOCK_FIELDS)[number];

/** '6.5', '6,5', 6 -> numero; 's.v.', '' -> null. */
export function parseCellNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const text = value.trim().replace(',', '.');
  if (!text || /^s\.?v\.?$/i.test(text) || text === '-') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Media dei voti disponibili, a 3 decimali come FMS (vedi vote-precision). */
export function averageOfAvailable(votes: readonly (number | null)[]): number | null {
  return averageOfVotes(votes);
}

function normalizeRole(value: string): PlayerRole | null {
  const role = value.trim().toUpperCase();
  return role === 'P' || role === 'D' || role === 'C' || role === 'A' ? role : null;
}

interface ColumnMap {
  id: number;
  name: number;
  role: number;
  team: number;
  min: number;
  minU: number;
  starter: number;
  outlets: Record<PianetafantaOutlet, { vote: number; fields: Record<BlockField, number> }>;
  single: Record<'Amm' | 'Esp' | 'RigS' | 'RigP' | 'Rt', number>;
}

function buildColumnMap(header: string[]): ColumnMap {
  const find = (name: string, from = 0) => header.findIndex((cell, index) => index >= from && cell === name);
  const required = (name: string, from = 0) => {
    const index = find(name, from);
    if (index < 0) throw new Error(`Colonna "${name}" non trovata: non sembra un export voti pianetafanta`);
    return index;
  };

  const outlets = {} as ColumnMap['outlets'];
  for (const outlet of Object.keys(OUTLET_HEADERS) as PianetafantaOutlet[]) {
    const vote = required(OUTLET_HEADERS[outlet]);
    const fields = {} as Record<BlockField, number>;
    BLOCK_FIELDS.forEach((field, offset) => {
      fields[field] = header[vote + 1 + offset] === field ? vote + 1 + offset : -1;
    });
    outlets[outlet] = { vote, fields };
  }
  const afterBlocks = outlets.tuttosport.vote + 1;
  return {
    id: find('ID'),
    name: required('Giocatore'),
    role: find('Ruolo'),
    team: required('Squadra'),
    min: find('Min'),
    minU: find('MinU'),
    starter: find('T', afterBlocks),
    outlets,
    single: {
      Amm: find('Amm', afterBlocks),
      Esp: find('Esp', afterBlocks),
      RigS: find('RigS', afterBlocks),
      RigP: find('RigP', afterBlocks),
      Rt: find('Rt', afterBlocks),
    },
  };
}

function cell(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? '') : '';
}

function count(row: string[], index: number): number {
  return Math.max(0, Math.trunc(parseCellNumber(cell(row, index)) ?? 0));
}

function bonusesFor(row: string[], map: ColumnMap, votes: Record<PianetafantaOutlet, number | null>): FantacalcioBonus[] {
  // Eventi della prima testata che ha dato il voto (di norma coincidono);
  // se tutte danno s.v., la prima testata con eventi.
  const outlets = Object.keys(OUTLET_HEADERS) as PianetafantaOutlet[];
  const hasEvents = (outlet: PianetafantaOutlet) =>
    BLOCK_FIELDS.some((field) => count(row, map.outlets[outlet].fields[field]) > 0);
  const outlet =
    outlets.find((o) => votes[o] != null) ?? outlets.find(hasEvents) ?? 'gazzetta';
  const fields = map.outlets[outlet].fields;

  const penaltiesScored = count(row, map.single.Rt);
  // GF comprende i rigori trasformati (Rt): il bonus rigore è separato.
  const totals: Partial<Record<FantacalcioBonusType, number>> = {
    goal: Math.max(0, count(row, fields.GF) - penaltiesScored),
    penalty_scored: penaltiesScored,
    goal_conceded: count(row, fields.GS),
    own_goal: count(row, fields.Aut),
    assist: count(row, fields.Ass),
    yellow_card: count(row, map.single.Amm),
    red_card: count(row, map.single.Esp),
    penalty_missed: count(row, map.single.RigS),
    penalty_saved: count(row, map.single.RigP),
  };
  return (Object.entries(totals) as [FantacalcioBonusType, number][])
    .filter(([, n]) => n > 0)
    .map(([type, n]) => ({ type, label: BONUS_LABELS[type], count: n, minute: null }));
}

/** Righe del foglio (vedi readFirstSheet) -> giocatori. Salta allenatori ("ALL."). */
export function parsePianetafantaRows(rows: string[][]): PianetafantaFile {
  const headerIndex = rows.findIndex((row) => row.includes('Giocatore') && row.includes('Squadra'));
  if (headerIndex < 0) throw new Error('Intestazione non trovata: non sembra un export voti pianetafanta');
  const map = buildColumnMap(rows[headerIndex]);

  const title = rows.slice(0, headerIndex).flat().join(' ');
  const matchdayMatch = title.match(/Giornata:?\s*(\d+)/i);

  const players: PianetafantaPlayer[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const name = cell(row, map.name);
    const team = cell(row, map.team);
    if (!name || !team) continue;
    const sourceId = cell(row, map.id);
    if (/^all\.?$/i.test(sourceId)) continue; // allenatore

    const votes = {
      gazzetta: parseCellNumber(cell(row, map.outlets.gazzetta.vote)),
      corriere: parseCellNumber(cell(row, map.outlets.corriere.vote)),
      tuttosport: parseCellNumber(cell(row, map.outlets.tuttosport.vote)),
    };
    const starter = parseCellNumber(cell(row, map.starter)) === 1;
    const min = parseCellNumber(cell(row, map.min));
    const minU = parseCellNumber(cell(row, map.minU));
    const subIn = !starter ? min : null;
    const subOut = starter ? (min ?? minU) : minU;
    const start = starter ? 0 : (subIn ?? 90);
    const end = subOut ?? 90;

    players.push({
      sourceId,
      name,
      role: normalizeRole(cell(row, map.role)),
      team,
      teamCode: canonicalTeamCode(team),
      starter,
      votes,
      average: averageOfAvailable(Object.values(votes)),
      voteCount: Object.values(votes).filter((vote) => vote != null).length,
      bonuses: bonusesFor(row, map, votes),
      subIn,
      subOut,
      minutesPlayed: Math.max(0, end - start),
    });
  }

  return { serieAMatchday: matchdayMatch ? Number(matchdayMatch[1]) : null, players };
}

export interface PianetafantaMatchedPlayer extends PianetafantaPlayer {
  playerId: string | null;
  matchedName: string | null;
}

export interface PianetafantaMatchGroup {
  /** "FRO-SAS" (codici squadra), o il codice singolo se la partita non è nel calendario. */
  key: string;
  homeTeam: string;
  awayTeam: string | null;
  players: PianetafantaMatchedPlayer[];
  matched: number;
  unmatched: PianetafantaMatchedPlayer[];
}

export function matchPianetafantaPlayers(
  players: readonly PianetafantaPlayer[],
  catalog: { players: readonly FantacalcioCatalogPlayer[]; aliases: readonly FantacalcioAlias[] }
): PianetafantaMatchedPlayer[] {
  return players.map((player) => {
    const hit = matchFantacalcioPlayer(player.name, catalog.players, catalog.aliases, {
      role: player.role ?? undefined,
      realTeam: player.team,
    });
    return { ...player, playerId: hit?.playerId ?? null, matchedName: hit?.playerName ?? null };
  });
}

/**
 * Suggerimento (non abbinamento automatico) per i non abbinati, utile se il club
 * in anagrafica non è aggiornato: "COGNOME I." in qualsiasi club solo se il cognome in anagrafica è identico, l'iniziale è quella
 * del primo nome, il ruolo coincide e il candidato è unico. KOUADIO E. (Monza)
 * non diventa KONE' Kouadio (Roma), CARLOS D. non diventa CARLOS AUGUSTO.
 */
export function suggestRosterPlayer(
  player: Pick<PianetafantaPlayer, 'name' | 'role'>,
  players: readonly FantacalcioCatalogPlayer[]
): { playerId: string; playerName: string } | null {
  const parts = player.name.trim().match(/^(.+?)\s+([A-Za-zÀ-ÿ]{1,3})\.$/);
  if (!parts) return null;
  const surname = normalizePlayerName(parts[1]);
  const initial = normalizePlayerName(parts[2]);
  if (surname.length < 3 || !initial) return null;
  const candidates = players.filter((entry) => {
    if (player.role && entry.role && entry.role !== player.role) return false;
    const words = normalizePlayerName(entry.name).split(' ');
    const surnameWords = surname.split(' ').length;
    if (words.slice(0, surnameWords).join(' ') !== surname) return false;
    const given = words[surnameWords];
    return Boolean(given && given.startsWith(initial));
  });
  if (candidates.length !== 1) return null;
  return { playerId: candidates[0].id, playerName: candidates[0].name };
}

/** Raggruppa per partita usando il calendario della giornata (casa/trasferta). */
export function groupPianetafantaMatches(
  players: readonly PianetafantaMatchedPlayer[],
  fixtures: readonly { homeTeam: string; awayTeam: string }[]
): PianetafantaMatchGroup[] {
  const groups = new Map<string, PianetafantaMatchGroup>();
  for (const player of players) {
    const code = player.teamCode ?? player.team.toUpperCase();
    const fixture = fixtures.find(
      (f) => canonicalTeamCode(f.homeTeam) === code || canonicalTeamCode(f.awayTeam) === code
    );
    const homeCode = fixture ? (canonicalTeamCode(fixture.homeTeam) ?? fixture.homeTeam) : code;
    const awayCode = fixture ? (canonicalTeamCode(fixture.awayTeam) ?? fixture.awayTeam) : null;
    const key = awayCode ? `${homeCode}-${awayCode}` : homeCode;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        homeTeam: fixture?.homeTeam ?? player.team,
        awayTeam: fixture?.awayTeam ?? null,
        players: [],
        matched: 0,
        unmatched: [],
      };
      groups.set(key, group);
    }
    group.players.push(player);
    if (player.playerId) group.matched += 1;
    else group.unmatched.push(player);
  }
  return [...groups.values()];
}
