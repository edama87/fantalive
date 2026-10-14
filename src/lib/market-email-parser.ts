/**
 * Market Email Parser
 * 
 * Parses the weekly market results email from FMS Revo platform.
 * Format: tab-separated table between ===== delimiter lines.
 * 
 * Columns:
 * - Player full name (SURNAME First)
 * - Role (P/D/C/A)
 * - Serie A club code (3 letters)
 * - Fantasy team name
 * - Released player (short name 'Surname I.')
 * - Inf (injury flag: yes/no)
 * - Pre (loan/prestito flag: yes/no)
 * - Price (credits)
 * - Timestamp
 */

import { teams } from '@/data/teams';
import { Player } from '@/types';

export interface ParsedMarketRow {
  rawLine: string;
  lineNumber: number;
  
  playerFullName: string;
  role: 'P' | 'D' | 'C' | 'A' | null;
  serieAClub: string;
  fantasyTeamName: string;
  releasedPlayerName: string;
  isInjured: boolean;
  isLoan: boolean;
  price: number;
  timestamp: string;
  
  matchedPlayerId: string | null;
  matchedPlayerConfidence: number;
  matchedReleasedId: string | null;
  matchedReleasedConfidence: number;
  matchedTeamId: string | null;
  matchedTeamConfidence: number;
  
  errors: string[];
  warnings: string[];
}

export interface MarketEmailParseResult {
  success: boolean;
  rows: ParsedMarketRow[];
  unmatchedCount: number;
  totalRows: number;
  parseErrors: string[];
}

function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function similarityScore(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  
  if (normA === normB) return 1;
  
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(normA, normB);
  return 1 - distance / maxLen;
}

function parsePlayerName(fullName: string): { surname: string; firstName: string } {
  const parts = fullName.trim().split(/\s+/);
  
  let surnameEndIndex = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === parts[i].toUpperCase() && parts[i].length > 1) {
      surnameEndIndex = i + 1;
    } else {
      break;
    }
  }
  
  if (surnameEndIndex === 0) surnameEndIndex = 1;
  
  const surname = parts.slice(0, surnameEndIndex).join(' ');
  const firstName = parts.slice(surnameEndIndex).join(' ');
  
  return { surname, firstName };
}

function parseShortName(shortName: string): { surname: string; initial: string } {
  const match = shortName.match(/^(.+?)\s+([A-Z])\.?$/);
  if (match) {
    return { surname: match[1], initial: match[2] };
  }
  return { surname: shortName, initial: '' };
}

export function fuzzyMatchPlayer(
  searchName: string,
  players: Player[],
  isShortFormat: boolean = false
): { player: Player | null; confidence: number } {
  if (!searchName || searchName.trim() === '' || searchName === '-') {
    return { player: null, confidence: 1 };
  }

  let bestMatch: Player | null = null;
  let bestScore = 0;

  const searchNorm = normalizeString(searchName);
  
  for (const player of players) {
    const playerNorm = normalizeString(player.name);
    
    let score = similarityScore(searchNorm, playerNorm);
    
    if (isShortFormat) {
      const { surname, initial } = parseShortName(searchName);
      const surnameScore = similarityScore(surname, player.name.split(' ')[0]);
      
      if (initial && player.name.includes(' ')) {
        const playerFirstChar = player.name.split(' ').slice(-1)[0][0];
        if (playerFirstChar?.toUpperCase() === initial.toUpperCase()) {
          surnameScore * 1.1;
        }
      }
      
      score = Math.max(score, surnameScore);
    } else {
      const { surname } = parsePlayerName(searchName);
      const surnameScore = similarityScore(surname, player.name);
      score = Math.max(score, surnameScore);
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = player;
    }
  }

  return { player: bestMatch, confidence: bestScore };
}

export function fuzzyMatchTeam(
  teamName: string
): { teamId: string | null; confidence: number } {
  if (!teamName || teamName.trim() === '') {
    return { teamId: null, confidence: 0 };
  }

  let bestMatch: string | null = null;
  let bestScore = 0;

  const searchNorm = normalizeString(teamName);

  for (const team of teams) {
    const teamNorm = normalizeString(team.name);
    const score = similarityScore(searchNorm, teamNorm);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = team.id;
    }
  }

  return { teamId: bestMatch, confidence: bestScore };
}

export function parseMarketEmail(
  emailContent: string,
  allPlayers: Player[]
): MarketEmailParseResult {
  const result: MarketEmailParseResult = {
    success: true,
    rows: [],
    unmatchedCount: 0,
    totalRows: 0,
    parseErrors: [],
  };

  const lines = emailContent.split('\n');
  
  let inTable = false;
  let delimiterCount = 0;
  let lineNumber = 0;

  for (const rawLine of lines) {
    lineNumber++;
    const trimmed = rawLine.trim();
    
    if (trimmed.match(/^=+$/)) {
      delimiterCount++;
      if (delimiterCount === 1) {
        inTable = true;
      } else if (delimiterCount === 2) {
        inTable = false;
      }
      continue;
    }
    
    if (trimmed.toLowerCase().includes('giocatore') && 
        trimmed.toLowerCase().includes('fantasquadra')) {
      continue;
    }
    
    if (!inTable || !trimmed) continue;
    
    const row = parseMarketRow(rawLine, lineNumber, allPlayers);
    result.rows.push(row);
    result.totalRows++;
    
    if (row.errors.length > 0 || 
        row.matchedPlayerConfidence < 0.7 ||
        row.matchedTeamConfidence < 0.7 ||
        (row.releasedPlayerName && row.releasedPlayerName !== '-' && row.matchedReleasedConfidence < 0.7)) {
      result.unmatchedCount++;
    }
  }

  if (result.totalRows === 0 && delimiterCount < 2) {
    result.parseErrors.push('Formato email non riconosciuto: delimitatori ===== non trovati');
    result.success = false;
  }

  return result;
}

function parseMarketRow(
  rawLine: string,
  lineNumber: number,
  allPlayers: Player[]
): ParsedMarketRow {
  const row: ParsedMarketRow = {
    rawLine,
    lineNumber,
    playerFullName: '',
    role: null,
    serieAClub: '',
    fantasyTeamName: '',
    releasedPlayerName: '',
    isInjured: false,
    isLoan: false,
    price: 0,
    timestamp: '',
    matchedPlayerId: null,
    matchedPlayerConfidence: 0,
    matchedReleasedId: null,
    matchedReleasedConfidence: 0,
    matchedTeamId: null,
    matchedTeamConfidence: 0,
    errors: [],
    warnings: [],
  };

  const columns = rawLine.split(/\t+/).map(c => c.trim()).filter(c => c);
  
  if (columns.length < 8) {
    const altColumns = rawLine.split(/\s{2,}/).map(c => c.trim()).filter(c => c);
    if (altColumns.length >= 8) {
      columns.length = 0;
      columns.push(...altColumns);
    }
  }

  if (columns.length < 8) {
    row.errors.push(`Numero colonne insufficiente: ${columns.length}, attese almeno 8`);
    return row;
  }

  row.playerFullName = columns[0];
  
  const roleStr = columns[1].toUpperCase();
  if (['P', 'D', 'C', 'A'].includes(roleStr)) {
    row.role = roleStr as 'P' | 'D' | 'C' | 'A';
  } else {
    row.warnings.push(`Ruolo non riconosciuto: ${columns[1]}`);
  }
  
  row.serieAClub = columns[2];
  row.fantasyTeamName = columns[3];
  row.releasedPlayerName = columns[4];
  
  row.isInjured = columns[5]?.toLowerCase() === 'yes' || columns[5]?.toLowerCase() === 'si';
  row.isLoan = columns[6]?.toLowerCase() === 'yes' || columns[6]?.toLowerCase() === 'si';
  
  const priceStr = columns[7];
  const priceNum = parseInt(priceStr, 10);
  if (!isNaN(priceNum)) {
    row.price = priceNum;
  } else {
    row.errors.push(`Prezzo non valido: ${priceStr}`);
  }
  
  if (columns[8]) {
    row.timestamp = columns[8];
  }

  const playerMatch = fuzzyMatchPlayer(row.playerFullName, allPlayers, false);
  row.matchedPlayerId = playerMatch.player?.id || null;
  row.matchedPlayerConfidence = playerMatch.confidence;
  
  if (playerMatch.confidence < 0.7) {
    row.warnings.push(`Giocatore "${row.playerFullName}" non trovato con certezza (${Math.round(playerMatch.confidence * 100)}%)`);
  }

  const teamMatch = fuzzyMatchTeam(row.fantasyTeamName);
  row.matchedTeamId = teamMatch.teamId;
  row.matchedTeamConfidence = teamMatch.confidence;
  
  if (teamMatch.confidence < 0.7) {
    row.warnings.push(`Squadra "${row.fantasyTeamName}" non trovata con certezza (${Math.round(teamMatch.confidence * 100)}%)`);
  }

  if (row.releasedPlayerName && row.releasedPlayerName !== '-') {
    const teamPlayers = row.matchedTeamId 
      ? allPlayers.filter(p => p.teamId === row.matchedTeamId)
      : allPlayers;
    
    const releasedMatch = fuzzyMatchPlayer(row.releasedPlayerName, teamPlayers, true);
    row.matchedReleasedId = releasedMatch.player?.id || null;
    row.matchedReleasedConfidence = releasedMatch.confidence;
    
    if (releasedMatch.confidence < 0.7) {
      row.warnings.push(`Giocatore ceduto "${row.releasedPlayerName}" non trovato con certezza (${Math.round(releasedMatch.confidence * 100)}%)`);
    }
  } else {
    row.matchedReleasedConfidence = 1;
  }

  return row;
}

export interface ValidatedMarketImport {
  teamId: string;
  playerInId: string;
  playerOutId: string | null;
  price: number;
  isLoan: boolean;
  isInjured: boolean;
  rawData: ParsedMarketRow;
}

export function validateParsedRows(
  rows: ParsedMarketRow[]
): { valid: ValidatedMarketImport[]; invalid: ParsedMarketRow[] } {
  const valid: ValidatedMarketImport[] = [];
  const invalid: ParsedMarketRow[] = [];

  for (const row of rows) {
    if (row.errors.length > 0) {
      invalid.push(row);
      continue;
    }

    if (!row.matchedTeamId || row.matchedTeamConfidence < 0.7) {
      invalid.push(row);
      continue;
    }

    if (!row.matchedPlayerId || row.matchedPlayerConfidence < 0.7) {
      invalid.push(row);
      continue;
    }

    if (row.releasedPlayerName && row.releasedPlayerName !== '-') {
      if (!row.matchedReleasedId || row.matchedReleasedConfidence < 0.7) {
        invalid.push(row);
        continue;
      }
    }

    valid.push({
      teamId: row.matchedTeamId,
      playerInId: row.matchedPlayerId,
      playerOutId: row.matchedReleasedId,
      price: row.price,
      isLoan: row.isLoan,
      isInjured: row.isInjured,
      rawData: row,
    });
  }

  return { valid, invalid };
}
