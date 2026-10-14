/**
 * FMS Revo Lineup Parser
 * 
 * Parses the lineup print page from FMS Revo platform.
 * Format: HTML table with teams, their formations, and player lists.
 * 
 * Player name format: "SURNAME First names" (e.g., "MURIC Arijanet Anan")
 * Role format: POR/DIF/CEN/ATT
 */

import { Player, PlayerRole } from '@/types';

export interface ParsedLineupPlayer {
  rawName: string;
  role: PlayerRole | null;
  roleRaw: string;
  serieAClub: string;
  position: number;
  isStarter: boolean;
  
  matchedPlayerId: string | null;
  matchedPlayerConfidence: number;
  matchedPlayerName: string | null;
}

export interface ParsedTeamLineup {
  rawTeamName: string;
  matchedTeamId: string | null;
  matchedTeamName: string | null;
  matchedTeamConfidence: number;
  
  formation: string | null;
  starters: ParsedLineupPlayer[];
  bench: ParsedLineupPlayer[];
  
  errors: string[];
  warnings: string[];
  
  hasLineup: boolean;
}

export interface LineupParseResult {
  success: boolean;
  teams: ParsedTeamLineup[];
  serieAMatchday: number | null;
  parseErrors: string[];
  source: 'html' | 'text';
}

const ROLE_MAP: Record<string, PlayerRole> = {
  'POR': 'P',
  'P': 'P',
  'DIF': 'D',
  'D': 'D',
  'CEN': 'C',
  'C': 'C',
  'ATT': 'A',
  'A': 'A',
};

const FMS_CLUB_CODE_TO_REAL_TEAM: Record<string, string> = {
  'ATA': 'Atalanta',
  'BOL': 'Bologna',
  'CAG': 'Cagliari',
  'COM': 'Como',
  'EMP': 'Empoli',
  'FIO': 'Fiorentina',
  'GEN': 'Genoa',
  'INT': 'Inter',
  'JUV': 'Juventus',
  'LAZ': 'Lazio',
  'LEC': 'Lecce',
  'MIL': 'Milan',
  'MON': 'Monza',
  'NAP': 'Napoli',
  'PAR': 'Parma',
  'ROM': 'Roma',
  'SAL': 'Salernitana',
  'SAM': 'Sampdoria',
  'SAS': 'Sassuolo',
  'SPE': 'Spezia',
  'TOR': 'Torino',
  'UDI': 'Udinese',
  'VEN': 'Venezia',
  'VER': 'Verona',
};

export function getFMSClubRealTeam(clubCode: string): string | null {
  return FMS_CLUB_CODE_TO_REAL_TEAM[clubCode.toUpperCase()] || null;
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

/**
 * Extract surname from PDF player name.
 * PDF names can be:
 * - "Frendrup M. W." (surname + initials) -> "Frendrup"
 * - "MURIC Arijanet Anan" (SURNAME First Middle) -> "MURIC"
 * - "De Ketelaere C." (multi-word surname + initial) -> "De Ketelaere"
 */
export function extractSurnameFromPDFName(pdfName: string): string {
  const parts = pdfName.trim().split(/\s+/);
  if (parts.length === 0) return pdfName;
  if (parts.length === 1) return parts[0];
  
  const firstPart = parts[0];
  const isFirstAllCaps = firstPart === firstPart.toUpperCase() && firstPart.length > 1;
  
  if (isFirstAllCaps) {
    const surnameWords: string[] = [firstPart];
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part === part.toUpperCase() && part.length > 1 && !/^[A-Z]\.?$/.test(part)) {
        surnameWords.push(part);
      } else {
        break;
      }
    }
    return surnameWords.join(' ');
  }
  
  const surnamePartIndices: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isInitial = /^[A-Z]\.?$/.test(part) || /^[A-Z]\.[A-Z]\.?$/.test(part);
    if (!isInitial) {
      surnamePartIndices.push(i);
    }
  }
  
  if (surnamePartIndices.length === 0) {
    return parts[0];
  }
  
  return surnamePartIndices.map(i => parts[i]).join(' ');
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

/**
 * Match a player name from PDF to our player database.
 * PDF names are like "Frendrup M. W." - surname + initials.
 * DB names may be just "Frendrup" or "Luka Modric".
 * 
 * Matching strategy:
 * 1. Extract surname from PDF name (strip initials)
 * 2. Match by normalized surname + role + club (real team)
 * 3. Use initials only to disambiguate (e.g., Martinez L. vs Martinez J.)
 */
export function fuzzyMatchPlayer(
  rawName: string,
  allPlayers: Player[],
  preferredRole?: PlayerRole | null,
  fmsClubCode?: string | null
): { playerId: string | null; confidence: number; playerName: string | null } {
  if (!rawName || rawName === '-' || rawName.trim() === '') {
    return { playerId: null, confidence: 0, playerName: null };
  }

  const pdfSurname = extractSurnameFromPDFName(rawName);
  const normalizedPdfSurname = normalizeString(pdfSurname);
  const normalizedFullName = normalizeString(rawName);
  
  const pdfParts = rawName.trim().split(/\s+/);
  const initials = pdfParts
    .filter(p => /^[A-Z]\.?$/.test(p))
    .map(p => p.replace('.', '').toUpperCase());
  
  const expectedRealTeam = fmsClubCode ? getFMSClubRealTeam(fmsClubCode) : null;

  interface MatchCandidate {
    player: Player;
    score: number;
    matchType: 'exact_surname' | 'surname_similarity' | 'full_similarity';
  }

  const candidates: MatchCandidate[] = [];

  for (const player of allPlayers) {
    const playerNorm = normalizeString(player.name);
    const playerParts = playerNorm.split(' ');
    
    const playerSurname = playerParts.length > 1 
      ? playerParts[playerParts.length - 1]
      : playerParts[0];
    const playerFirstName = playerParts.length > 1 
      ? playerParts.slice(0, -1).join(' ')
      : '';
    
    const playerFirstAsSurname = playerParts[0];
    
    const pdfSurnameParts = normalizedPdfSurname.split(' ');
    const pdfLastSurnamePart = pdfSurnameParts[pdfSurnameParts.length - 1];

    const surnameMatches = 
      normalizedPdfSurname === playerSurname || 
      normalizedPdfSurname === playerNorm ||
      normalizedPdfSurname === playerFirstAsSurname ||
      pdfLastSurnamePart === playerSurname ||
      (pdfSurnameParts.length > 1 && pdfSurnameParts.join('') === playerSurname);

    if (surnameMatches) {
      let score = 0.92;
      
      if (preferredRole && player.role === preferredRole) {
        score += 0.05;
      }
      
      if (expectedRealTeam && player.realTeam) {
        const playerRealTeam = normalizeString(player.realTeam);
        const expectedNorm = normalizeString(expectedRealTeam);
        if (playerRealTeam === expectedNorm || playerRealTeam.includes(expectedNorm) || expectedNorm.includes(playerRealTeam)) {
          score += 0.05;
        }
      }
      
      if (initials.length > 0 && playerFirstName) {
        const playerInitials = playerFirstName.split(' ')
          .map(p => p[0]?.toUpperCase())
          .filter(Boolean);
        const initialsMatch = initials.some(i => playerInitials.includes(i));
        if (initialsMatch) {
          score = Math.min(1.0, score + 0.02);
        }
      }

      candidates.push({ player, score, matchType: 'exact_surname' });
      continue;
    }

    const surnameScore = similarityScore(normalizedPdfSurname, playerSurname);
    if (surnameScore >= 0.85) {
      let score = surnameScore * 0.9;
      
      if (preferredRole && player.role === preferredRole) {
        score += 0.05;
      }
      
      if (expectedRealTeam && player.realTeam) {
        const playerRealTeam = normalizeString(player.realTeam);
        const expectedNorm = normalizeString(expectedRealTeam);
        if (playerRealTeam === expectedNorm || playerRealTeam.includes(expectedNorm)) {
          score += 0.05;
        }
      }

      candidates.push({ player, score, matchType: 'surname_similarity' });
      continue;
    }

    const directScore = similarityScore(normalizedFullName, playerNorm);
    const reversedName = `${playerSurname} ${playerFirstName}`.trim();
    const reversedScore = similarityScore(normalizedFullName, reversedName);
    const fullScore = Math.max(directScore, reversedScore);
    
    if (fullScore >= 0.7) {
      let score = fullScore * 0.8;
      
      if (preferredRole && player.role === preferredRole) {
        score += 0.05;
      }

      candidates.push({ player, score, matchType: 'full_similarity' });
    }
  }

  if (candidates.length === 0) {
    return { playerId: null, confidence: 0, playerName: null };
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 1 && candidates[0].score - candidates[1].score < 0.05) {
    const topCandidates = candidates.filter(c => candidates[0].score - c.score < 0.05);
    
    if (preferredRole) {
      const roleMatches = topCandidates.filter(c => c.player.role === preferredRole);
      if (roleMatches.length === 1) {
        return {
          playerId: roleMatches[0].player.id,
          confidence: roleMatches[0].score,
          playerName: roleMatches[0].player.name,
        };
      }
    }
    
    if (expectedRealTeam) {
      const teamMatches = topCandidates.filter(c => {
        if (!c.player.realTeam) return false;
        return normalizeString(c.player.realTeam).includes(normalizeString(expectedRealTeam));
      });
      if (teamMatches.length === 1) {
        return {
          playerId: teamMatches[0].player.id,
          confidence: teamMatches[0].score,
          playerName: teamMatches[0].player.name,
        };
      }
    }
    
    if (initials.length > 0) {
      const initialMatches = topCandidates.filter(c => {
        const playerNorm = normalizeString(c.player.name);
        const playerParts = playerNorm.split(' ');
        const playerFirstName = playerParts.length > 1 ? playerParts.slice(0, -1).join(' ') : '';
        const playerInitials = playerFirstName.split(' ')
          .map(p => p[0]?.toUpperCase())
          .filter(Boolean);
        return initials.some(i => playerInitials.includes(i));
      });
      if (initialMatches.length === 1) {
        return {
          playerId: initialMatches[0].player.id,
          confidence: initialMatches[0].score,
          playerName: initialMatches[0].player.name,
        };
      }
    }
  }

  const best = candidates[0];
  if (best.score >= 0.6) {
    return {
      playerId: best.player.id,
      confidence: best.score,
      playerName: best.player.name,
    };
  }

  return { playerId: null, confidence: 0, playerName: null };
}

/**
 * Match a team name to our fantasy team database
 */
export function fuzzyMatchTeam(
  rawName: string,
  fantasyTeams: Array<{ id: string; name: string }>
): { teamId: string | null; confidence: number; teamName: string | null } {
  if (!rawName || rawName.trim() === '') {
    return { teamId: null, confidence: 0, teamName: null };
  }

  const normalized = normalizeString(rawName);

  for (const team of fantasyTeams) {
    const teamNorm = normalizeString(team.name);
    if (teamNorm === normalized) {
      return { teamId: team.id, confidence: 1, teamName: team.name };
    }
  }

  let bestMatch: { team: typeof fantasyTeams[0]; score: number } | null = null;

  for (const team of fantasyTeams) {
    const score = similarityScore(normalized, team.name);
    
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { team, score };
    }
  }

  if (bestMatch && bestMatch.score >= 0.7) {
    return {
      teamId: bestMatch.team.id,
      confidence: bestMatch.score,
      teamName: bestMatch.team.name,
    };
  }

  return { teamId: null, confidence: 0, teamName: null };
}

function parseRole(roleStr: string): PlayerRole | null {
  const upper = roleStr.toUpperCase().trim();
  return ROLE_MAP[upper] || null;
}

/**
 * Parse player line from the FMS Revo format
 * Expected formats:
 * - "1. MURIC Arijanet Anan (POR) - ATA"
 * - "MURIC Arijanet Anan - POR - ATA"
 * - Table row with columns
 */
function parsePlayerLine(
  line: string,
  allPlayers: Player[],
  isStarter: boolean,
  position: number
): ParsedLineupPlayer | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '-') return null;

  let roleRaw = '';
  let role: PlayerRole | null = null;
  let serieAClub = '';
  let rawName = trimmed;

  const roleParenMatch = trimmed.match(/\(([A-Z]{1,3})\)/);
  if (roleParenMatch) {
    roleRaw = roleParenMatch[1];
    role = parseRole(roleRaw);
    rawName = trimmed.replace(roleParenMatch[0], '').trim();
  }

  const dashParts = rawName.split(/\s*[-–]\s*/);
  if (dashParts.length >= 2) {
    const lastPart = dashParts[dashParts.length - 1].trim();
    if (lastPart.length <= 4 && /^[A-Z]+$/.test(lastPart)) {
      serieAClub = lastPart;
      dashParts.pop();
    }
    
    if (!role && dashParts.length >= 2) {
      const secondLast = dashParts[dashParts.length - 1].trim();
      if (ROLE_MAP[secondLast.toUpperCase()]) {
        roleRaw = secondLast;
        role = parseRole(secondLast);
        dashParts.pop();
      }
    }
    
    rawName = dashParts.join(' ').trim();
  }

  const numPrefix = rawName.match(/^\d+[\.\)]\s*/);
  if (numPrefix) {
    rawName = rawName.slice(numPrefix[0].length).trim();
  }

  if (!rawName) return null;

  const match = fuzzyMatchPlayer(rawName, allPlayers, role);

  return {
    rawName,
    role,
    roleRaw,
    serieAClub,
    position,
    isStarter,
    matchedPlayerId: match.playerId,
    matchedPlayerConfidence: match.confidence,
    matchedPlayerName: match.playerName,
  };
}

/**
 * Extract text content from HTML, preserving structure
 */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<\/th>/gi, '\t')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/\t+/g, '\t')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * Parse a team's lineup section
 */
function parseTeamSection(
  section: string,
  allPlayers: Player[],
  fantasyTeams: Array<{ id: string; name: string }>
): ParsedTeamLineup | null {
  const lines = section.split('\n').map(l => l.trim()).filter(l => l);
  
  if (lines.length < 2) return null;

  let rawTeamName = '';
  let formation: string | null = null;
  const starters: ParsedLineupPlayer[] = [];
  const bench: ParsedLineupPlayer[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const teamNameLine = lines.find(l => 
    !l.match(/^\d+[\.\)]/) && 
    !l.match(/^(POR|DIF|CEN|ATT|PANCHINA|TITOLARI|MODULO)/i) &&
    l.length > 2
  );
  
  if (teamNameLine) {
    rawTeamName = teamNameLine.replace(/[:：]/g, '').trim();
  }

  const formationLine = lines.find(l => l.match(/^\d+-\d+-\d+$/));
  if (formationLine) {
    formation = formationLine;
  }

  let inBench = false;
  let starterPosition = 0;
  let benchPosition = 0;

  for (const line of lines) {
    if (line.match(/PANCHINA/i) || line.match(/RISERVE/i)) {
      inBench = true;
      continue;
    }
    
    if (line.match(/TITOLARI/i) || line.match(/MODULO/i) || line === rawTeamName) {
      continue;
    }

    if (line.match(/^\d+-\d+-\d+$/)) {
      continue;
    }

    const player = parsePlayerLine(
      line,
      allPlayers,
      !inBench,
      inBench ? benchPosition++ : starterPosition++
    );

    if (player) {
      if (inBench) {
        bench.push(player);
      } else {
        starters.push(player);
      }
    }
  }

  if (starters.length === 0 && bench.length === 0) {
    return null;
  }

  if (starters.length !== 11) {
    if (starters.length > 0) {
      warnings.push(`Expected 11 starters, found ${starters.length}`);
    }
  }

  const unmatchedStarters = starters.filter(p => !p.matchedPlayerId);
  const unmatchedBench = bench.filter(p => !p.matchedPlayerId);
  
  if (unmatchedStarters.length > 0) {
    errors.push(`${unmatchedStarters.length} starter(s) not matched: ${unmatchedStarters.map(p => p.rawName).join(', ')}`);
  }
  if (unmatchedBench.length > 0) {
    warnings.push(`${unmatchedBench.length} bench player(s) not matched: ${unmatchedBench.map(p => p.rawName).join(', ')}`);
  }

  const teamMatch = fuzzyMatchTeam(rawTeamName, fantasyTeams);

  return {
    rawTeamName,
    matchedTeamId: teamMatch.teamId,
    matchedTeamName: teamMatch.teamName,
    matchedTeamConfidence: teamMatch.confidence,
    formation,
    starters,
    bench,
    errors,
    warnings,
    hasLineup: starters.length > 0,
  };
}

/**
 * Parse the full FMS Revo lineup page content
 */
export function parseLineupsContent(
  content: string,
  allPlayers: Player[],
  fantasyTeams: Array<{ id: string; name: string }>
): LineupParseResult {
  const isHtml = content.includes('<') && content.includes('>');
  const text = isHtml ? htmlToText(content) : content;
  
  const parseErrors: string[] = [];
  const teams: ParsedTeamLineup[] = [];

  if (content.includes('Questa pagina è accessibile solo da utenti autenticati')) {
    return {
      success: false,
      teams: [],
      serieAMatchday: null,
      parseErrors: ['Login required: page is only accessible to authenticated users'],
      source: isHtml ? 'html' : 'text',
    };
  }

  let serieAMatchday: number | null = null;
  const matchdayMatch = content.match(/giornata\s*(\d+)|cGio=(\d+)|matchday\s*(\d+)/i);
  if (matchdayMatch) {
    serieAMatchday = parseInt(matchdayMatch[1] || matchdayMatch[2] || matchdayMatch[3]);
  }

  const teamDelimiters = [
    /={3,}/g,
    /-{5,}/g,
    /\n\s*\n\s*\n/g,
  ];

  let sections: string[] = [];
  
  for (const delimiter of teamDelimiters) {
    const parts = text.split(delimiter).filter(s => s.trim().length > 20);
    if (parts.length >= 2) {
      sections = parts;
      break;
    }
  }

  if (sections.length === 0) {
    const lines = text.split('\n');
    let currentSection: string[] = [];
    
    for (const line of lines) {
      const isTeamHeader = fantasyTeams.some(t => 
        normalizeString(line).includes(normalizeString(t.name))
      );
      
      if (isTeamHeader && currentSection.length > 3) {
        sections.push(currentSection.join('\n'));
        currentSection = [line];
      } else {
        currentSection.push(line);
      }
    }
    
    if (currentSection.length > 3) {
      sections.push(currentSection.join('\n'));
    }
  }

  for (const section of sections) {
    const parsed = parseTeamSection(section, allPlayers, fantasyTeams);
    if (parsed) {
      teams.push(parsed);
    }
  }

  if (teams.length === 0) {
    parseErrors.push('No valid team lineups found in content');
  }

  const matchedTeamIds = new Set(teams.filter(t => t.matchedTeamId).map(t => t.matchedTeamId));
  const missingTeams = fantasyTeams.filter(t => !matchedTeamIds.has(t.id));
  
  if (missingTeams.length > 0 && teams.length > 0) {
    parseErrors.push(`Missing lineups for: ${missingTeams.map(t => t.name).join(', ')}`);
  }

  return {
    success: teams.length > 0,
    teams,
    serieAMatchday,
    parseErrors,
    source: isHtml ? 'html' : 'text',
  };
}

/**
 * Validate that lineup players belong to the team's roster for the round
 */
export function validateLineupAgainstRoster(
  lineup: ParsedTeamLineup,
  rosterPlayerIds: Set<string>
): { valid: boolean; notInRoster: ParsedLineupPlayer[] } {
  const notInRoster: ParsedLineupPlayer[] = [];
  
  for (const player of [...lineup.starters, ...lineup.bench]) {
    if (player.matchedPlayerId && !rosterPlayerIds.has(player.matchedPlayerId)) {
      notInRoster.push(player);
    }
  }
  
  return {
    valid: notInRoster.length === 0,
    notInRoster,
  };
}
