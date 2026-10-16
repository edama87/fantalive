/**
 * FMS Revo PDF Parser
 * 
 * Parses lineup PDFs from FMS Revo platform.
 * The PDF contains one page per matchup with two teams side by side (left/right columns).
 * 
 * Format per team:
 * - Team name
 * - FantaMister: name
 * - Posizione in classifica: N
 * - Punti: N
 * - Table header: R | Sq. | Giocatore | Voto 1 | Voto 2 | Voto 3 | Media | MOD | ToT
 * - Player rows (role, club abbreviation, player name)
 * - "panchina" label
 * - Bench player rows
 * - Footer rows (Parziale squadra, Mod. Portiere, etc.)
 */

import { extractTextItems } from 'unpdf';
import { Player, PlayerRole } from '@/types';
import type { FmsPlayerAlias } from '@/lib/lineup-matching';
import { fuzzyMatchPlayer, fuzzyMatchTeam } from './fmsrevo-lineup-parser';

export interface PDFTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PDFPageContent {
  pageNumber: number;
  width: number;
  height: number;
  items: PDFTextItem[];
}

export interface ParsedPDFPlayer {
  rawName: string;
  role: PlayerRole | null;
  serieAClub: string;
  position: number;
  isStarter: boolean;
}

export interface ParsedPDFTeamLineup {
  rawTeamName: string;
  matchedTeamId: string | null;
  matchedTeamName: string | null;
  matchedTeamConfidence: number;
  starters: ParsedPDFPlayer[];
  bench: ParsedPDFPlayer[];
  hasLineup: boolean;
  notSubmitted: boolean;
}

export interface PDFParseResult {
  success: boolean;
  teams: ParsedPDFTeamLineup[];
  serieAMatchday: number | null;
  fantasyMatchday: number | null;
  message: string | null;
  isPDF: boolean;
}

const ROLE_MAP: Record<string, PlayerRole> = {
  'P': 'P',
  'D': 'D',
  'C': 'C',
  'A': 'A',
};

const HEADER_KEYWORDS = [
  'fantamister',
  'posizione in classifica',
  'punti:',
  'voto 1',
  'voto 2',
  'voto 3',
  'giocatore',
];

/**
 * Check if content is a PDF by magic bytes or content-type
 */
export function isPDFContent(data: ArrayBuffer | Uint8Array | string): boolean {
  if (typeof data === 'string') {
    return data.trimStart().startsWith('%PDF');
  }
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  if (bytes.length < 5) return false;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/**
 * Extract text with positions from PDF using unpdf (serverless-compatible)
 */
export async function extractPDFTextWithPositions(pdfData: Uint8Array): Promise<PDFPageContent[]> {
  const result = await extractTextItems(pdfData);
  
  const pages: PDFPageContent[] = [];
  const pageWidth = 595;
  const pageHeight = 842;
  
  for (let pageIdx = 0; pageIdx < result.items.length; pageIdx++) {
    const pageItems = result.items[pageIdx];
    const items: PDFTextItem[] = [];
    
    for (const item of pageItems) {
      if (item.str && item.str.trim()) {
        items.push({
          text: item.str,
          x: item.x,
          y: pageHeight - item.y,
          width: item.width || 0,
          height: item.height || 0,
        });
      }
    }
    
    pages.push({
      pageNumber: pageIdx + 1,
      width: pageWidth,
      height: pageHeight,
      items,
    });
  }
  
  return pages;
}

/**
 * Group text items by row (similar y coordinate)
 */
function groupByRows(items: PDFTextItem[], tolerance: number = 5): PDFTextItem[][] {
  if (items.length === 0) return [];
  
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: PDFTextItem[][] = [];
  let currentRow: PDFTextItem[] = [sorted[0]];
  let currentY = sorted[0].y;
  
  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) <= tolerance) {
      currentRow.push(item);
    } else {
      rows.push(currentRow.sort((a, b) => a.x - b.x));
      currentRow = [item];
      currentY = item.y;
    }
  }
  
  if (currentRow.length > 0) {
    rows.push(currentRow.sort((a, b) => a.x - b.x));
  }
  
  return rows;
}

/**
 * Split page content into left and right columns based on x position
 */
function splitLeftRight(page: PDFPageContent): { left: PDFTextItem[]; right: PDFTextItem[] } {
  const midX = page.width / 2;
  const left: PDFTextItem[] = [];
  const right: PDFTextItem[] = [];
  
  for (const item of page.items) {
    if (item.x < midX) {
      left.push(item);
    } else {
      right.push({ ...item, x: item.x - midX });
    }
  }
  
  return { left, right };
}

function cleanPdfTokens(texts: string[]): string[] {
  return texts
    .map((text) => text.trim())
    .filter((text) => text.length > 0 && text !== '*');
}

/** P/D/C/A, including the captain mark used by FMS ("C*"). */
export function pdfRoleFromToken(token: string): PlayerRole | null {
  const cleaned = token.toUpperCase().replace(/\*/g, '').trim();
  return ROLE_MAP[cleaned] || null;
}

function pdfClubFromToken(token: string): string | null {
  const club = token.toUpperCase().replace(/\./g, '');
  if (club.length < 2 || club.length > 4) return null;
  if (!/^[A-Z]+$/.test(club)) return null;
  return club;
}

/**
 * Glue an apostrophe that PDF extraction split into its own glyph
 * ("Toure" + "'" + "E. B." → "Toure' E. B.").
 */
export function joinPdfNameParts(parts: string[]): string {
  let name = '';
  for (const part of parts) {
    const piece = part.trim();
    if (!piece || piece === '*') continue;
    if (!name) {
      name = piece;
      continue;
    }
    if (piece === "'" || piece === '’' || piece === '`') {
      name += piece;
      continue;
    }
    if (/^['’`]/.test(piece)) {
      name += piece;
      continue;
    }
    name += ` ${piece}`;
  }
  return name.replace(/\s+/g, ' ').trim();
}

export function appendPlayerName(base: string, extra: string): string {
  return joinPdfNameParts([base, extra]);
}

const FOOTER_LINE =
  /^(parziale squadra|mod\.?\s*portiere|mod\.?\s*difesa|mod\.?\s*centrocampo|mod\.?\s*attacco|fattore campo|riserva d'ufficio|totale squadra|gol|pagina\b|fmsrevo\b)/i;

/**
 * A player row is role + club + name. Footer words are matched as whole lines,
 * so a surname like "Gollini" is not discarded because it contains "gol".
 * Numeric vote cells after the name are ignored.
 */
export function parsePdfPlayerTexts(
  texts: string[]
): { role: PlayerRole; club: string; name: string } | null {
  const cleaned = cleanPdfTokens(texts);
  if (cleaned.length < 3) return null;

  const role = pdfRoleFromToken(cleaned[0]);
  if (!role) return null;
  const club = pdfClubFromToken(cleaned[1]);
  if (!club) return null;

  const nameParts: string[] = [];
  for (const part of cleaned.slice(2)) {
    if (/^\d+([.,]\d+)?$/.test(part)) break;
    nameParts.push(part);
  }
  const name = joinPdfNameParts(nameParts);
  if (!name || /^\d/.test(name) || name.toLowerCase().includes('voto')) return null;

  return { role, club, name };
}

/** Role and club on their own row, when the name wraps onto the next line. */
export function parsePdfRoleClubOnly(
  texts: string[]
): { role: PlayerRole; club: string } | null {
  const cleaned = cleanPdfTokens(texts);
  if (cleaned.length !== 2) return null;
  const role = pdfRoleFromToken(cleaned[0]);
  const club = pdfClubFromToken(cleaned[1]);
  if (!role || !club) return null;
  return { role, club };
}

/** Second line of a wrapped name (initials, or a surname split on the apostrophe). */
export function parsePdfNameContinuation(texts: string[]): string | null {
  const cleaned = cleanPdfTokens(texts);
  if (cleaned.length === 0 || cleaned.length > 6) return null;
  const joined = cleaned.join(' ').replace(/\s+/g, ' ').trim();
  const lower = joined.toLowerCase();
  if (!joined || joined.includes(':')) return null;
  if (isPanchinaRowText(lower) || FOOTER_LINE.test(lower)) return null;
  if (HEADER_KEYWORDS.some((keyword) => lower.includes(keyword))) return null;
  if (cleaned.length === 1 && pdfRoleFromToken(cleaned[0])) return null;
  if (parsePdfPlayerTexts(cleaned) || parsePdfRoleClubOnly(cleaned)) return null;
  if (!/^[\p{L}0-9.'’`\- ]+$/u.test(joined)) return null;
  if (!/\p{L}/u.test(joined)) return null;
  return joinPdfNameParts(cleaned);
}

export function rowTextsFromItems(rowItems: PDFTextItem[]): string[] {
  return cleanPdfTokens(
    [...rowItems].sort((a, b) => a.x - b.x).map((item) => item.text)
  );
}

/**
 * Read starters and bench from already-grouped column rows.
 * Joins names split by an apostrophe glyph or wrapped onto the next line.
 */
export function readPdfColumnPlayers(rows: string[][]): {
  starters: ParsedPDFPlayer[];
  bench: ParsedPDFPlayer[];
} {
  const starters: ParsedPDFPlayer[] = [];
  const bench: ParsedPDFPlayer[] = [];
  let inBench = false;
  let pending: { role: PlayerRole; club: string } | null = null;

  const pushPlayer = (info: { role: PlayerRole; club: string; name: string }) => {
    const list = inBench ? bench : starters;
    list.push({
      rawName: info.name,
      role: info.role,
      serieAClub: info.club,
      position: list.length,
      isStarter: !inBench,
    });
  };

  for (const texts of rows) {
    const rowText = texts.join(' ').trim().toLowerCase();
    if (isPanchinaRowText(rowText)) {
      inBench = true;
      pending = null;
      continue;
    }

    const playerInfo = parsePdfPlayerTexts(texts);
    if (playerInfo) {
      pending = null;
      pushPlayer(playerInfo);
      continue;
    }

    const partial = parsePdfRoleClubOnly(texts);
    if (partial) {
      pending = partial;
      continue;
    }

    const continuation = parsePdfNameContinuation(texts);
    if (!continuation) {
      pending = null;
      continue;
    }

    if (pending) {
      pushPlayer({ role: pending.role, club: pending.club, name: continuation });
      pending = null;
      continue;
    }

    const list = inBench ? bench : starters;
    const last = list[list.length - 1];
    if (last) {
      last.rawName = appendPlayerName(last.rawName, continuation);
    }
  }

  return { starters, bench };
}

/**
 * Check if a row text is a metadata/header row (not a team name)
 */
function isMetadataRow(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('fantamister') ||
    lower.includes('posizione') ||
    lower.includes('punti:') ||
    lower.includes('formazioni') ||
    lower.includes('bundlesliga') ||
    lower.includes('giornata') ||
    lower.includes('voto 1') ||
    lower.includes('voto 2') ||
    lower.includes('media') ||
    lower.includes('giocatore') ||
    /^r\s+sq/i.test(text) ||
    text.length <= 3 ||
    text.length > 60 ||
    /^\d/.test(text) ||
    text.includes(':') ||
    text === ''
  );
}

/**
 * Extract team name from column items.
 * The team name is the first non-metadata row in the column.
 */
function extractTeamName(rows: PDFTextItem[][]): string | null {
  for (const row of rows.slice(0, 15)) {
    const rowText = row.map(item => item.text).join(' ').trim();
    
    if (isMetadataRow(rowText)) continue;
    
    return rowText;
  }
  
  return null;
}

/**
 * Detect the "panchina" separator row in a PDF column.
 * FMS sometimes emits extra spaces / punctuation around the label.
 */
export function isPanchinaRowText(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  if (normalized === 'panchina') return true;
  if (/^panchina[:.\s]*$/.test(normalized)) return true;
  // Split glyphs like "pan china" or trailing junk without player data
  if (/^pan\s*china[:.\s]*$/.test(normalized)) return true;
  return false;
}

/**
 * Parse a single column (left or right team) from a page
 */
function parseTeamColumn(
  items: PDFTextItem[],
  fantasyTeams: Array<{ id: string; name: string }>
): ParsedPDFTeamLineup | null {
  const rows = groupByRows(items);
  
  if (rows.length < 3) return null;
  
  const rawTeamName = extractTeamName(rows);
  if (!rawTeamName) return null;
  
  const teamMatch = fuzzyMatchTeam(rawTeamName, fantasyTeams);
  
  const { starters, bench } = readPdfColumnPlayers(rows.map(rowTextsFromItems));
  
  const hasLineup = starters.length > 0;
  const notSubmitted = starters.length === 0;
  
  return {
    rawTeamName,
    matchedTeamId: teamMatch.teamId,
    matchedTeamName: teamMatch.teamName,
    matchedTeamConfidence: teamMatch.confidence,
    starters,
    bench,
    hasLineup,
    notSubmitted,
  };
}

/**
 * Extract matchday info from PDF content
 */
function extractMatchdayInfo(pages: PDFPageContent[]): { serieA: number | null; fantasy: number | null } {
  for (const page of pages) {
    const allText = page.items.map(i => i.text).join(' ');
    
    const serieAMatch = allText.match(/(\d+)a?\s*giornata\s*di\s*Serie\s*A/i) ||
                        allText.match(/\[(\d+)a?\s*giornata/i);
    const fantasyMatch = allText.match(/Formazioni\s*Campionato:\s*(\d+)a?/i);
    
    if (serieAMatch || fantasyMatch) {
      return {
        serieA: serieAMatch ? parseInt(serieAMatch[1]) : null,
        fantasy: fantasyMatch ? parseInt(fantasyMatch[1]) : null,
      };
    }
  }
  
  return { serieA: null, fantasy: null };
}

/**
 * Main function: Parse FMS Revo lineup PDF
 */
export async function parseFMSRevoPDF(
  pdfData: Uint8Array,
  fantasyTeams: Array<{ id: string; name: string }>
): Promise<PDFParseResult> {
  try {
    const pages = await extractPDFTextWithPositions(pdfData);
    
    if (pages.length === 0) {
      return {
        success: false,
        teams: [],
        serieAMatchday: null,
        fantasyMatchday: null,
        message: 'PDF vuoto o non leggibile',
        isPDF: true,
      };
    }
    
    const matchdayInfo = extractMatchdayInfo(pages);
    const teams: ParsedPDFTeamLineup[] = [];
    
    for (const page of pages) {
      const { left, right } = splitLeftRight(page);
      
      const leftTeam = parseTeamColumn(left, fantasyTeams);
      const rightTeam = parseTeamColumn(right, fantasyTeams);
      
      if (leftTeam) teams.push(leftTeam);
      if (rightTeam) teams.push(rightTeam);
    }
    
    const teamsWithLineups = teams.filter(t => t.hasLineup);
    const teamsWithoutLineups = teams.filter(t => !t.hasLineup);
    
    let message: string | null = null;
    if (teamsWithLineups.length === 0) {
      message = 'Formazioni non ancora pubblicate per questa giornata';
    } else if (teamsWithoutLineups.length > 0) {
      const notSubmitted = teamsWithoutLineups
        .map(t => t.matchedTeamName || t.rawTeamName)
        .filter(Boolean);
      if (notSubmitted.length > 0) {
        message = `${notSubmitted.length} formazioni non ancora inserite`;
      }
    }
    
    return {
      success: true,
      teams,
      serieAMatchday: matchdayInfo.serieA,
      fantasyMatchday: matchdayInfo.fantasy,
      message,
      isPDF: true,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Errore sconosciuto';
    return {
      success: false,
      teams: [],
      serieAMatchday: null,
      fantasyMatchday: null,
      message: `Errore lettura PDF: ${errorMsg.substring(0, 100)}`,
      isPDF: true,
    };
  }
}

/**
 * Convert PDF parse result to the standard LineupParseResult format
 */
export function convertPDFResultToLineupResult(
  pdfResult: PDFParseResult,
  allPlayers: Player[],
  fantasyTeams: Array<{ id: string; name: string }>,
  playersByTeamId?: Record<string, Player[]>,
  aliases?: readonly FmsPlayerAlias[] | null
): import('./fmsrevo-lineup-parser').LineupParseResult {
  const teams: import('./fmsrevo-lineup-parser').ParsedTeamLineup[] = pdfResult.teams.map(pdfTeam => {
    const preferred =
      pdfTeam.matchedTeamId && playersByTeamId
        ? (playersByTeamId[pdfTeam.matchedTeamId] ?? [])
        : null;

    const starters = pdfTeam.starters.map(p => {
      const match = fuzzyMatchPlayer(
        p.rawName,
        allPlayers,
        p.role,
        p.serieAClub,
        preferred,
        aliases
      );
      return {
        rawName: p.rawName,
        role: p.role,
        roleRaw: p.role || '',
        serieAClub: p.serieAClub,
        position: p.position,
        isStarter: true,
        matchedPlayerId: match.playerId,
        matchedPlayerConfidence: match.confidence,
        matchedPlayerName: match.playerName,
      };
    });
    
    const bench = pdfTeam.bench.map(p => {
      const match = fuzzyMatchPlayer(
        p.rawName,
        allPlayers,
        p.role,
        p.serieAClub,
        preferred,
        aliases
      );
      return {
        rawName: p.rawName,
        role: p.role,
        roleRaw: p.role || '',
        serieAClub: p.serieAClub,
        position: p.position,
        isStarter: false,
        matchedPlayerId: match.playerId,
        matchedPlayerConfidence: match.confidence,
        matchedPlayerName: match.playerName,
      };
    });
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (pdfTeam.notSubmitted) {
      warnings.push('Formazione non ancora inserita');
    } else {
      // A short XI is a warning. It must not block import when the PDF
      // really lists fewer than 11 starters (lost rows are fixed upstream).
      if (starters.length !== 11 && starters.length > 0) {
        warnings.push(`Titolari: ${starters.length} invece di 11`);
      }
      
      const unmatchedStarters = starters.filter(p => !p.matchedPlayerId);
      if (unmatchedStarters.length > 0) {
        const names = unmatchedStarters.slice(0, 3).map(p => p.rawName).join(', ');
        const msg = unmatchedStarters.length > 3 
          ? `${names} e altri ${unmatchedStarters.length - 3}`
          : names;
        errors.push(`Titolari non riconosciuti: ${msg.substring(0, 80)}`);
      }
      
      const unmatchedBench = bench.filter(p => !p.matchedPlayerId);
      if (unmatchedBench.length > 0) {
        const names = unmatchedBench.slice(0, 3).map(p => p.rawName).join(', ');
        const msg = unmatchedBench.length > 3
          ? `${names} e altri ${unmatchedBench.length - 3}`
          : names;
        errors.push(`Panchina non riconosciuta: ${msg.substring(0, 80)}`);
      }

      if (pdfTeam.hasLineup && bench.length === 0) {
        errors.push('Panchina vuota: nessun giocatore letto dopo il separatore panchina');
      }
    }
    
    return {
      rawTeamName: pdfTeam.rawTeamName,
      matchedTeamId: pdfTeam.matchedTeamId,
      matchedTeamName: pdfTeam.matchedTeamName,
      matchedTeamConfidence: pdfTeam.matchedTeamConfidence,
      formation: null,
      starters,
      bench,
      errors,
      warnings,
      hasLineup: pdfTeam.hasLineup,
    };
  });
  
  return {
    success: pdfResult.success,
    teams,
    serieAMatchday: pdfResult.serieAMatchday,
    parseErrors: pdfResult.message ? [pdfResult.message] : [],
    source: 'text',
  };
}
