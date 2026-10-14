/**
 * FMS Revo roster HTML parser (cheerio).
 *
 * Real team pages use card layout with:
 * - team name: `.squadra__user-info > strong` (fallback: menu link idFsqN)
 * - players: `.squadre__left table tr` with `.squadra__role` + `.squadra__player-name`
 * - Serie A club: `td.text-center small` (or neighboring text cell)
 *
 * Also supports `#elenco_giocatori table.infoSquadra` / `#contenutoSquadra` variants.
 */

import * as cheerio from 'cheerio';

export type RosterRole = 'P' | 'D' | 'C' | 'A';

export interface ParsedRosterPlayer {
  name: string;
  role: RosterRole;
  realTeam: string;
  price?: number;
}

export interface ParsedTeamRoster {
  fmsTeamId: number;
  teamName: string;
  players: ParsedRosterPlayer[];
}

export interface RosterValidationIssue {
  code:
    | 'wrong_total'
    | 'wrong_roles'
    | 'missing_name'
    | 'missing_real_team'
    | 'duplicate_name';
  message: string;
}

export interface RosterValidationResult {
  ok: boolean;
  expectedTotal: number;
  expectedRoles: Record<RosterRole, number>;
  actualTotal: number;
  actualRoles: Record<RosterRole, number>;
  issues: RosterValidationIssue[];
}

export const EXPECTED_ROSTER_TOTAL = 25;
export const EXPECTED_ROSTER_ROLES: Record<RosterRole, number> = {
  P: 3,
  D: 8,
  C: 8,
  A: 6,
};

const ROLE_FROM_CLASS: Array<{ needle: string; role: RosterRole }> = [
  { needle: 'keeper', role: 'P' },
  { needle: 'defense', role: 'D' },
  { needle: 'pivot', role: 'C' },
  { needle: 'striker', role: 'A' },
];

const ROLE_TEXT_MAP: Record<string, RosterRole> = {
  P: 'P',
  POR: 'P',
  D: 'D',
  DIF: 'D',
  C: 'C',
  CEN: 'C',
  A: 'A',
  ATT: 'A',
};

function cleanText(value: string | undefined | null): string {
  return (value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roleFromClassList(className: string): RosterRole | null {
  const lower = className.toLowerCase();
  for (const { needle, role } of ROLE_FROM_CLASS) {
    if (lower.includes(needle)) return role;
  }
  return null;
}

function roleFromText(text: string): RosterRole | null {
  const key = cleanText(text).toUpperCase();
  return ROLE_TEXT_MAP[key] ?? null;
}

function extractTeamName($: cheerio.CheerioAPI, fmsTeamId?: number): string | undefined {
  const header = cleanText($('.squadra__user-info > strong').first().text());
  if (header) return header;

  const cardStrong = cleanText(
    $('.card__body--main .squadra__user-info strong').first().text()
  );
  if (cardStrong) return cardStrong;

  if (fmsTeamId != null) {
    const fromMenu = cleanText(
      $(`a[href*="param=idFsq${fmsTeamId}"]`).first().text()
    );
    if (fromMenu) return fromMenu;
  }

  const anyMenu = cleanText($('a[href*="param=idFsq"]').first().text());
  return anyMenu || undefined;
}

function extractRealTeamFromRow($: cheerio.CheerioAPI, row: cheerio.Cheerio<any>): string {
  const smallCenter = cleanText(row.find('td.text-center small').first().text());
  if (smallCenter && smallCenter.length <= 12) return smallCenter;

  const anySmall = cleanText(row.find('small').first().text());
  if (anySmall && anySmall.length <= 12 && !/\d/.test(anySmall)) return anySmall;

  const cells = row.find('td').toArray();
  for (const cell of cells) {
    const $cell = $(cell);
    if ($cell.find('.squadra__role, .squadra__player-name, a').length) continue;
    if (
      $cell.find('div[style*="background-image"], img').length &&
      !cleanText($cell.text())
    ) {
      continue;
    }
    const text = cleanText($cell.text());
    if (!text) continue;
    if (/^[A-Z]{2,4}$/i.test(text)) return text.toUpperCase();
    if (text.length <= 12 && !/^[PDCA]$/i.test(text)) return text;
  }

  return '';
}

function extractPlayerNameFromRow($: cheerio.CheerioAPI, row: cheerio.Cheerio<any>): string {
  const named = cleanText(row.find('.squadra__player-name').first().text());
  if (named) return named;

  const formazioni = cleanText(row.find('.formazioni__name').first().text());
  if (formazioni) return formazioni;

  const topFlop = cleanText(row.find('.top-flop__name').first().text());
  if (topFlop) return topFlop;

  const giocatoreCell = row.find('td.giocatore div').first();
  if (giocatoreCell.length) {
    const clone = giocatoreCell.clone();
    clone.find('small').remove();
    const giocatore = cleanText(clone.text());
    if (giocatore) return giocatore;
  }

  const link = cleanText(row.find('a').first().text());
  if (link && link.length > 1) return link;

  return '';
}

function extractRoleFromRow($: cheerio.CheerioAPI, row: cheerio.Cheerio<any>): RosterRole | null {
  const roleCell = row
    .find(
      '.squadra__role, .top-flop__role, .bacheca__role, td[class*="invio_formazioni--"], td[class*="role--"]'
    )
    .first();

  if (roleCell.length) {
    const fromClass = roleFromClassList(roleCell.attr('class') || '');
    if (fromClass) return fromClass;
    const fromText = roleFromText(roleCell.text());
    if (fromText) return fromText;
  }

  const classHit = roleFromClassList(row.attr('class') || '');
  if (classHit) return classHit;

  for (const cell of row.find('td').toArray()) {
    const $cell = $(cell);
    const fromClass = roleFromClassList($cell.attr('class') || '');
    if (fromClass) return fromClass;
    const fromText = roleFromText($cell.text());
    if (fromText) return fromText;
  }

  return null;
}

function parsePlayersFromRows(
  $: cheerio.CheerioAPI,
  rows: cheerio.Cheerio<any>
): ParsedRosterPlayer[] {
  const players: ParsedRosterPlayer[] = [];
  const seen = new Set<string>();

  rows.each((_, el) => {
    const row = $(el);
    const role = extractRoleFromRow($, row);
    const name = extractPlayerNameFromRow($, row);
    const realTeam = extractRealTeamFromRow($, row);

    if (!role || !name) return;
    // Skip modal / demo junk (e.g. "Cristiano Ronaldo - Real Madrid")
    if (name.includes(' - ') && name.length > 40) return;

    const key = `${role}|${name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    players.push({ name, role, realTeam });
  });

  return players;
}

/**
 * Parse a single team roster page HTML.
 */
export function parseRosterFromHtml(
  html: string,
  fmsTeamId = 1
): ParsedTeamRoster {
  const $ = cheerio.load(html);

  const teamName = extractTeamName($, fmsTeamId) || `Squadra ${fmsTeamId}`;

  // Preferred: dedicated roster table on team card
  let rows = $('.squadre__left table tbody tr, .squadre__left table tr');
  let players = parsePlayersFromRows($, rows);

  // Variant: elenco giocatori / contenuto squadra tables
  if (players.length === 0) {
    rows = $(
      '#elenco_giocatori table.infoSquadra tbody tr, #contenutoSquadra table tbody tr, table.infoSquadra tbody tr, table.infoAvversario tbody tr'
    );
    players = parsePlayersFromRows($, rows);
  }

  // Last resort: only squadra__ roster rows (never formazioni/top-flop demo tables)
  if (players.length === 0) {
    rows = $('tr').filter((_, el) => {
      const row = $(el);
      return row.find('.squadra__role, .squadra__player-name').length > 0;
    });
    players = parsePlayersFromRows($, rows);
  }

  return { fmsTeamId, teamName, players };
}

export function countRoles(
  players: ParsedRosterPlayer[]
): Record<RosterRole, number> {
  return {
    P: players.filter((p) => p.role === 'P').length,
    D: players.filter((p) => p.role === 'D').length,
    C: players.filter((p) => p.role === 'C').length,
    A: players.filter((p) => p.role === 'A').length,
  };
}

export function validateTeamRoster(
  roster: ParsedTeamRoster
): RosterValidationResult {
  const actualRoles = countRoles(roster.players);
  const issues: RosterValidationIssue[] = [];

  if (roster.players.length !== EXPECTED_ROSTER_TOTAL) {
    issues.push({
      code: 'wrong_total',
      message: `${roster.teamName}: ${roster.players.length} giocatori (attesi ${EXPECTED_ROSTER_TOTAL})`,
    });
  }

  (Object.keys(EXPECTED_ROSTER_ROLES) as RosterRole[]).forEach((role) => {
    if (actualRoles[role] !== EXPECTED_ROSTER_ROLES[role]) {
      issues.push({
        code: 'wrong_roles',
        message: `${roster.teamName}: ruolo ${role} = ${actualRoles[role]} (attesi ${EXPECTED_ROSTER_ROLES[role]})`,
      });
    }
  });

  for (const player of roster.players) {
    if (!player.name) {
      issues.push({
        code: 'missing_name',
        message: `${roster.teamName}: giocatore senza nome`,
      });
    }
    if (!player.realTeam) {
      issues.push({
        code: 'missing_real_team',
        message: `${roster.teamName}: ${player.name || '?'} senza squadra di Serie A`,
      });
    }
  }

  const nameCounts = new Map<string, number>();
  for (const player of roster.players) {
    const key = player.name.toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }
  for (const [name, count] of nameCounts) {
    if (count > 1) {
      issues.push({
        code: 'duplicate_name',
        message: `${roster.teamName}: nome duplicato "${name}"`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    expectedTotal: EXPECTED_ROSTER_TOTAL,
    expectedRoles: { ...EXPECTED_ROSTER_ROLES },
    actualTotal: roster.players.length,
    actualRoles,
    issues,
  };
}

export function isRosterComplete(roster: ParsedTeamRoster): boolean {
  return validateTeamRoster(roster).ok;
}
