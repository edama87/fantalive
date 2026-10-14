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
import { fuzzyMatchTeam } from './fmsrevo-lineup-parser';

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

const FOOTER_KEYWORDS = [
  'parziale squadra',
  'mod. portiere',
  'mod. difesa',
  'mod. centrocampo',
  'mod. attacco',
  'fattore campo',
  'riserva d\'ufficio',
  'totale squadra',
  'gol',
  'fmsrevo',
  'pagina',
];

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

/**
 * Check if a row of items is a player row (has role like P/D/C/A, club abbreviation, and player name)
 */
function parsePlayerFromRow(rowItems: PDFTextItem[]): { role: PlayerRole | null; club: string; name: string } | null {
  if (rowItems.length < 2) return null;
  
  const sortedItems = [...rowItems].sort((a, b) => a.x - b.x);
  const texts = sortedItems.map(item => item.text.trim()).filter(t => t.length > 0);
  
  if (texts.length < 2) return null;
  
  const combined = texts.join(' ').toLowerCase();
  
  for (const keyword of FOOTER_KEYWORDS) {
    if (combined.includes(keyword)) return null;
  }
  for (const keyword of HEADER_KEYWORDS) {
    if (combined.includes(keyword)) return null;
  }
  
  if (combined === 'panchina' || combined === 'r' || combined === 'sq.' || combined === 'r sq.') {
    return null;
  }
  
  const firstText = texts[0].toUpperCase();
  if (!ROLE_MAP[firstText]) return null;
  
  if (texts.length < 3) return null;
  
  const clubCandidate = texts[1].toUpperCase();
  if (clubCandidate.length < 2 || clubCandidate.length > 4) return null;
  if (!/^[A-Z]+$/.test(clubCandidate)) return null;
  
  const nameParts = texts.slice(2);
  const name = nameParts.join(' ');
  
  if (!name || name.match(/^\d/) || name.toLowerCase().includes('voto')) return null;
  
  return {
    role: ROLE_MAP[firstText],
    club: clubCandidate,
    name: name,
  };
}

/**
 * Extract team name from column items
 */
function extractTeamName(rows: PDFTextItem[][], fantasyTeams: Array<{ id: string; name: string }>): string | null {
  for (const row of rows.slice(0, 10)) {
    const rowText = row.map(item => item.text).join(' ').trim();
    
    if (rowText.toLowerCase().includes('fantamister')) continue;
    if (rowText.toLowerCase().includes('posizione')) continue;
    if (rowText.toLowerCase().includes('punti')) continue;
    if (rowText.toLowerCase().includes('formazioni')) continue;
    if (rowText.toLowerCase().includes('bundlesliga')) continue;
    if (rowText.toLowerCase().includes('giornata')) continue;
    if (rowText.match(/^r\s+sq/i)) continue;
    
    for (const team of fantasyTeams) {
      const teamLower = team.name.toLowerCase();
      const rowLower = rowText.toLowerCase();
      if (rowLower === teamLower || rowLower.includes(teamLower)) {
        return team.name;
      }
    }
    
    if (rowText.length > 3 && rowText.length < 50 && !rowText.match(/^\d/) && !rowText.includes(':')) {
      const match = fuzzyMatchTeam(rowText, fantasyTeams);
      if (match.confidence >= 0.8) {
        return rowText;
      }
    }
  }
  
  return null;
}

/**
 * Parse a single column (left or right team) from a page
 */
function parseTeamColumn(
  items: PDFTextItem[],
  fantasyTeams: Array<{ id: string; name: string }>
): ParsedPDFTeamLineup | null {
  const rows = groupByRows(items);
  
  if (rows.length < 5) return null;
  
  const rawTeamName = extractTeamName(rows, fantasyTeams);
  if (!rawTeamName) return null;
  
  const teamMatch = fuzzyMatchTeam(rawTeamName, fantasyTeams);
  
  const starters: ParsedPDFPlayer[] = [];
  const bench: ParsedPDFPlayer[] = [];
  let inBench = false;
  let starterPosition = 0;
  let benchPosition = 0;
  
  for (const row of rows) {
    const rowText = row.map(item => item.text).join(' ').trim().toLowerCase();
    
    if (rowText === 'panchina') {
      inBench = true;
      continue;
    }
    
    const playerInfo = parsePlayerFromRow(row);
    if (playerInfo) {
      const player: ParsedPDFPlayer = {
        rawName: playerInfo.name,
        role: playerInfo.role,
        serieAClub: playerInfo.club,
        position: inBench ? benchPosition++ : starterPosition++,
        isStarter: !inBench,
      };
      
      if (inBench) {
        bench.push(player);
      } else {
        starters.push(player);
      }
    }
  }
  
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
  fantasyTeams: Array<{ id: string; name: string }>
): import('./fmsrevo-lineup-parser').LineupParseResult {
  const { fuzzyMatchPlayer } = require('./fmsrevo-lineup-parser');
  
  const teams: import('./fmsrevo-lineup-parser').ParsedTeamLineup[] = pdfResult.teams.map(pdfTeam => {
    const starters = pdfTeam.starters.map(p => {
      const match = fuzzyMatchPlayer(p.rawName, allPlayers, p.role);
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
      const match = fuzzyMatchPlayer(p.rawName, allPlayers, p.role);
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
        warnings.push(`Panchina non riconosciuta: ${msg.substring(0, 80)}`);
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
