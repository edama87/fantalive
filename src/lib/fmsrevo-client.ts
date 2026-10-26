/**
 * FMS Revo Client
 * 
 * Handles authentication and data fetching from the FMS Revo platform.
 * Uses server-only credentials FMSREVO_USERNAME and FMSREVO_PASSWORD.
 */

import {
  parseRosterFromHtml as parseRosterHtml,
  validateTeamRoster,
  countRoles,
  type ParsedTeamRoster,
  type RosterValidationResult,
} from '@/lib/fmsrevo-roster-parser';

const FMSREVO_BASE_URL = 'https://bundlesliga.fmsrevo.it';
const FMSREVO_LOGIN_ENDPOINT = `${FMSREVO_BASE_URL}/core_main/controller/ctrlLogin.php`;
const FMSREVO_LINEUPS_ENDPOINT = `${FMSREVO_BASE_URL}/home/statoformazioni/all_formaz.php`;
const FMSREVO_WIDGET_ENDPOINT = `${FMSREVO_BASE_URL}/template/controller/ctrlWidget.php`;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface FMSRevoLoginResult {
  success: boolean;
  cookies: string;
  error?: string;
}

export interface FMSRevoLineupsResult {
  success: boolean;
  data?: Uint8Array;
  contentType?: string;
  error?: string;
}

function parseCookies(setCookieHeaders: string[]): Map<string, string> {
  const cookies = new Map<string, string>();
  
  for (const header of setCookieHeaders) {
    const cookiePart = header.split(';')[0];
    if (cookiePart) {
      const eqIdx = cookiePart.indexOf('=');
      if (eqIdx > 0) {
        const name = cookiePart.substring(0, eqIdx).trim();
        const value = cookiePart.substring(eqIdx + 1).trim();
        cookies.set(name, value);
      }
    }
  }
  
  return cookies;
}

function mergeCookieMaps(base: Map<string, string>, additional: Map<string, string>): Map<string, string> {
  const merged = new Map(base);
  for (const [name, value] of additional) {
    merged.set(name, value);
  }
  return merged;
}

function cookieMapToString(cookies: Map<string, string>): string {
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * Step 1: Get initial PHPSESSID cookie from homepage
 */
async function getInitialSession(): Promise<{ cookies: Map<string, string>; error?: string }> {
  try {
    const response = await fetch(FMSREVO_BASE_URL, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
    });

    console.log('[FMSRevo] Initial GET status:', response.status);

    if (!response.ok) {
      return { 
        cookies: new Map(), 
        error: `Sito FMS Revo non raggiungibile (HTTP ${response.status})` 
      };
    }

    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    const cookies = parseCookies(setCookieHeaders);
    
    console.log('[FMSRevo] Initial cookies received:', cookies.size);
    
    return { cookies };
  } catch (error) {
    console.error('[FMSRevo] Network error on initial request:', error);
    return { 
      cookies: new Map(), 
      error: 'Sito FMS Revo non raggiungibile (errore di rete)' 
    };
  }
}

/**
 * Step 2: Login with credentials
 */
async function performLogin(
  username: string, 
  password: string, 
  sessionCookies: Map<string, string>
): Promise<FMSRevoLoginResult> {
  try {
    const body = new URLSearchParams();
    body.append('loginuser', username);
    body.append('loginpwd', password);
    body.append('RememberMe', 'on');

    const response = await fetch(FMSREVO_LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${FMSREVO_BASE_URL}/`,
        'Cookie': cookieMapToString(sessionCookies),
      },
      body: body.toString(),
    });

    console.log('[FMSRevo] Login POST status:', response.status);

    if (!response.ok) {
      return { 
        success: false, 
        cookies: '', 
        error: `Sito FMS Revo non raggiungibile (HTTP ${response.status})` 
      };
    }

    const responseText = await response.text();
    console.log('[FMSRevo] Login response:', responseText.substring(0, 100));

    let loginResult: { esito?: string } = {};
    try {
      loginResult = JSON.parse(responseText);
    } catch {
      return { 
        success: false, 
        cookies: '', 
        error: 'Risposta login non valida dal sito FMS Revo' 
      };
    }

    if (loginResult.esito !== 'OK') {
      return { 
        success: false, 
        cookies: '', 
        error: 'Credenziali FMS Revo errate' 
      };
    }

    const newSetCookieHeaders = response.headers.getSetCookie?.() || [];
    const newCookies = parseCookies(newSetCookieHeaders);
    const mergedCookies = mergeCookieMaps(sessionCookies, newCookies);
    
    console.log('[FMSRevo] Login successful, total cookies:', mergedCookies.size);

    return { 
      success: true, 
      cookies: cookieMapToString(mergedCookies) 
    };
  } catch (error) {
    console.error('[FMSRevo] Network error on login:', error);
    return { 
      success: false, 
      cookies: '', 
      error: 'Sito FMS Revo non raggiungibile (errore di rete)' 
    };
  }
}

/**
 * Step 3: Fetch lineups page (returns raw bytes - may be PDF or HTML)
 */
async function fetchLineupsPageInternal(
  sessionCookies: string, 
  serieAMatchday: number
): Promise<FMSRevoLineupsResult> {
  try {
    const url = `${FMSREVO_LINEUPS_ENDPOINT}?cGio=${serieAMatchday}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/pdf,text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
        'Cookie': sessionCookies,
        'Referer': `${FMSREVO_BASE_URL}/`,
      },
    });

    console.log('[FMSRevo] Lineups GET status:', response.status);

    if (!response.ok) {
      return { 
        success: false, 
        error: `Pagina formazioni non raggiungibile (HTTP ${response.status})` 
      };
    }

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    console.log('[FMSRevo] Lineups response content-type:', contentType, 'size:', data.length);

    if (contentType.includes('text/html') || (!contentType.includes('pdf') && data.length < 1000)) {
      const text = new TextDecoder().decode(data);
      if (text.includes('Questa pagina è accessibile solo da utenti autenticati') ||
          text.includes('accessibile solo') ||
          text.includes('autenticat')) {
        return { 
          success: false, 
          error: 'Login riuscito ma pagina formazioni non accessibile' 
        };
      }
    }

    return { success: true, data, contentType };
  } catch (error) {
    console.error('[FMSRevo] Network error fetching lineups:', error);
    return { 
      success: false, 
      error: 'Pagina formazioni non raggiungibile (errore di rete)' 
    };
  }
}

/**
 * Main function: Login to FMS Revo and fetch lineups
 */
export async function fetchFMSRevoLineups(serieAMatchday: number): Promise<FMSRevoLineupsResult> {
  const username = process.env.FMSREVO_USERNAME;
  const password = process.env.FMSREVO_PASSWORD;

  if (!username || !password) {
    return { 
      success: false, 
      error: 'Credenziali FMS Revo non configurate sul server' 
    };
  }

  const initialSession = await getInitialSession();
  if (initialSession.error) {
    return { success: false, error: initialSession.error };
  }

  const loginResult = await performLogin(username, password, initialSession.cookies);
  if (!loginResult.success) {
    return { success: false, error: loginResult.error };
  }

  const lineupsResult = await fetchLineupsPageInternal(loginResult.cookies, serieAMatchday);
  return lineupsResult;
}

export interface FMSRevoRostersResult {
  success: boolean;
  data?: Uint8Array;
  contentType?: string;
  candidateLinks?: Array<{ href: string; text: string }>;
  error?: string;
}

/**
 * Discover rosters page by exploring the logged-in homepage for links
 */
async function discoverRostersPage(sessionCookies: string): Promise<{
  rostersUrl: string | null;
  candidateLinks: Array<{ href: string; text: string }>;
  error?: string;
}> {
  try {
    const homeResponse = await fetch(`${FMSREVO_BASE_URL}/home/`, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,*/*;q=0.8',
        'Cookie': sessionCookies,
        'Referer': `${FMSREVO_BASE_URL}/`,
      },
    });

    if (!homeResponse.ok) {
      return { rostersUrl: null, candidateLinks: [], error: `Home page non raggiungibile (HTTP ${homeResponse.status})` };
    }

    const html = await homeResponse.text();
    
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    const allLinks: Array<{ href: string; text: string }> = [];
    
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].trim();
      if (href && text) {
        allLinks.push({ href, text: text.toLowerCase() });
      }
    }

    const rostersKeywords = ['rose', 'squadre', 'roster', 'elenco', 'giocator'];
    const candidates = allLinks.filter(link => 
      rostersKeywords.some(kw => 
        link.text.includes(kw) || link.href.toLowerCase().includes(kw)
      )
    );

    console.log('[FMSRevo] Found candidate roster links:', candidates.length);
    candidates.forEach(c => console.log(`  - ${c.href}: "${c.text}"`));

    const priorityPatterns = [
      /rose/i,
      /squadre/i,
      /roster/i,
      /all_rose/i,
      /elenco.*giocator/i,
    ];

    for (const pattern of priorityPatterns) {
      const match = candidates.find(c => pattern.test(c.href) || pattern.test(c.text));
      if (match) {
        const url = match.href.startsWith('http') 
          ? match.href 
          : `${FMSREVO_BASE_URL}${match.href.startsWith('/') ? '' : '/'}${match.href}`;
        return { rostersUrl: url, candidateLinks: candidates };
      }
    }

    return { rostersUrl: null, candidateLinks: candidates };
  } catch (error) {
    console.error('[FMSRevo] Error discovering rosters page:', error);
    return { rostersUrl: null, candidateLinks: [], error: 'Errore nella ricerca della pagina rose' };
  }
}

/**
 * Fetch rosters page content
 */
async function fetchRostersPage(sessionCookies: string, url: string): Promise<FMSRevoRostersResult> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/pdf,text/html,*/*;q=0.8',
        'Cookie': sessionCookies,
        'Referer': `${FMSREVO_BASE_URL}/home/`,
      },
    });

    console.log('[FMSRevo] Rosters GET status:', response.status);

    if (!response.ok) {
      return { success: false, error: `Pagina rose non raggiungibile (HTTP ${response.status})` };
    }

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    console.log('[FMSRevo] Rosters response content-type:', contentType, 'size:', data.length);

    return { success: true, data, contentType };
  } catch (error) {
    console.error('[FMSRevo] Error fetching rosters:', error);
    return { success: false, error: 'Errore nel download delle rose' };
  }
}

/**
 * Main function: Login to FMS Revo and fetch rosters
 */
export async function fetchFMSRevoRosters(): Promise<FMSRevoRostersResult> {
  const username = process.env.FMSREVO_USERNAME;
  const password = process.env.FMSREVO_PASSWORD;

  if (!username || !password) {
    return { success: false, error: 'Credenziali FMS Revo non configurate sul server' };
  }

  const initialSession = await getInitialSession();
  if (initialSession.error) {
    return { success: false, error: initialSession.error };
  }

  const loginResult = await performLogin(username, password, initialSession.cookies);
  if (!loginResult.success) {
    return { success: false, error: loginResult.error };
  }

  const discovery = await discoverRostersPage(loginResult.cookies);
  
  if (!discovery.rostersUrl) {
    return {
      success: false,
      candidateLinks: discovery.candidateLinks,
      error: discovery.error || 'Pagina rose non trovata automaticamente. Link candidati disponibili.',
    };
  }

  const rostersResult = await fetchRostersPage(loginResult.cookies, discovery.rostersUrl);
  rostersResult.candidateLinks = discovery.candidateLinks;
  return rostersResult;
}

export interface FMSRevoTeamRoster {
  fmsTeamId: number;
  teamName: string;
  players: Array<{
    name: string;
    role: 'P' | 'D' | 'C' | 'A';
    realTeam: string;
    price?: number;
  }>;
  validation?: RosterValidationResult;
}

export interface FMSRevoAllRostersResult {
  success: boolean;
  teams: FMSRevoTeamRoster[];
  allValid: boolean;
  error?: string;
  rawHtmlSample?: string;
}

function extractConfigLayout(html: string): Array<{ id?: string }> {
  // Site uses value='[...json with double quotes...]'
  const single = html.match(
    /name=["']configLayout["'][^>]*value='([^']*)'/i
  );
  const dbl = html.match(
    /name=["']configLayout["'][^>]*value="([^"]*)"/i
  );
  const raw = (single?.[1] || dbl?.[1] || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function widgetNameFromId(widgetId: string): string {
  const first = widgetId.split('-')[0]?.split('_')[0] || 'Widget';
  return first.charAt(0).toUpperCase() + first.slice(1);
}

async function fetchWidgetHtml(
  sessionCookies: string,
  widgetId: string,
  param: string
): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      azione: 'CREALAYOUTWID',
      dati: widgetId,
      nomeWidget: widgetNameFromId(widgetId),
      reqPaginazione: 'false',
      param,
    });

    const response = await fetch(FMSREVO_WIDGET_ENDPOINT, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: sessionCookies,
        Referer: `${FMSREVO_BASE_URL}/index.php?param=${param}`,
      },
      body: body.toString(),
    });

    if (!response.ok) return null;
    const parsed = JSON.parse(await response.text()) as {
      esito?: string;
      contenuto?: string;
    };
    if (parsed.esito === 'OK' && parsed.contenuto) return parsed.contenuto;
    return null;
  } catch {
    return null;
  }
}

async function hydratePageWidgets(
  sessionCookies: string,
  html: string,
  fmsTeamId: number
): Promise<string> {
  const param = `idFsq${fmsTeamId}`;
  const layout = extractConfigLayout(html);
  if (layout.length === 0) return html;

  // Team roster HTML lives in the ultime_notizie widget when param=idFsqN
  const prioritized = [
    ...layout.filter((item) => item.id?.startsWith('ultime_notizie')),
    ...layout.filter((item) => !item.id?.startsWith('ultime_notizie')),
  ];

  let composed = html;
  for (const item of prioritized) {
    if (!item.id) continue;
    const contenuto = await fetchWidgetHtml(sessionCookies, item.id, param);
    if (!contenuto) continue;

    const safeId = item.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `(<[^>]+\\bid=["']${safeId}["'][^>]*>)([\\s\\S]*?)(</div>)`,
      'i'
    );
    if (re.test(composed)) {
      composed = composed.replace(re, `$1${contenuto}$3`);
    } else {
      composed += `\n<div id="${item.id}">${contenuto}</div>\n`;
    }

    // Fast path: once we have a roster table, stop fetching other widgets
    if (
      item.id.startsWith('ultime_notizie') &&
      /squadra__player-name|squadra__role/.test(contenuto)
    ) {
      break;
    }
  }
  return composed;
}

/**
 * Fetch a single team's roster page (shell + hydrated widgets)
 */
async function fetchTeamRosterPage(sessionCookies: string, fmsTeamId: number): Promise<{
  success: boolean;
  html?: string;
  teamName?: string;
  error?: string;
}> {
  try {
    const url = `${FMSREVO_BASE_URL}/index.php?param=idFsq${fmsTeamId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,*/*;q=0.8',
        Cookie: sessionCookies,
        Referer: `${FMSREVO_BASE_URL}/`,
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const rawHtml = await response.text();
    const html = await hydratePageWidgets(sessionCookies, rawHtml, fmsTeamId);
    const parsed = parseRosterHtml(html, fmsTeamId);

    return {
      success: true,
      html,
      teamName: parsed.teamName,
    };
  } catch (error) {
    console.error(`[FMSRevo] Error fetching team ${fmsTeamId}:`, error);
    return { success: false, error: 'Network error' };
  }
}

function parseRosterFromHtml(
  html: string,
  fmsTeamId = 1
): ParsedTeamRoster {
  return parseRosterHtml(html, fmsTeamId);
}

/**
 * Fetch all team rosters from FMS Revo.
 * Stops at the first page with zero players.
 */
export async function fetchAllFMSRevoRosters(): Promise<FMSRevoAllRostersResult> {
  const username = process.env.FMSREVO_USERNAME;
  const password = process.env.FMSREVO_PASSWORD;

  if (!username || !password) {
    return {
      success: false,
      teams: [],
      allValid: false,
      error: 'Credenziali FMS Revo non configurate',
    };
  }

  const initialSession = await getInitialSession();
  if (initialSession.error) {
    return {
      success: false,
      teams: [],
      allValid: false,
      error: initialSession.error,
    };
  }

  const loginResult = await performLogin(
    username,
    password,
    initialSession.cookies
  );
  if (!loginResult.success) {
    return {
      success: false,
      teams: [],
      allValid: false,
      error: loginResult.error,
    };
  }

  const teams: FMSRevoTeamRoster[] = [];
  let debugSnippet: string | undefined;

  for (let fmsTeamId = 1; fmsTeamId <= 12; fmsTeamId++) {
    const result = await fetchTeamRosterPage(loginResult.cookies, fmsTeamId);

    if (!result.success || !result.html) {
      console.log(`[FMSRevo] Team ${fmsTeamId}: ${result.error || 'no data'}`);
      // Missing page after we already have teams → stop
      if (teams.length > 0) break;
      if (fmsTeamId > 10) break;
      continue;
    }

    if (fmsTeamId === 1) {
      debugSnippet = extractSanitizedDebugSnippet(result.html);
    }

    const parsed = parseRosterFromHtml(result.html, fmsTeamId);

    // Stop at first page without players (end of league list)
    if (parsed.players.length === 0) {
      console.log(
        `[FMSRevo] Team ${fmsTeamId}: nessun giocatore — stop`
      );
      if (teams.length === 0 && !debugSnippet) {
        debugSnippet = extractSanitizedDebugSnippet(result.html);
      }
      break;
    }

    const validation = validateTeamRoster(parsed);
    teams.push({
      fmsTeamId,
      teamName: parsed.teamName,
      players: parsed.players,
      validation,
    });

    console.log(
      `[FMSRevo] Team ${fmsTeamId} (${parsed.teamName}): ${parsed.players.length} players`,
      countRoles(parsed.players),
      validation.ok ? 'OK' : 'INVALID'
    );
  }

  const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);
  const allValid =
    teams.length > 0 && teams.every((t) => t.validation?.ok === true);

  let error: string | undefined;
  if (teams.length === 0) {
    error = 'Nessuna rosa trovata';
  } else if (totalPlayers === 0) {
    error =
      'Pagine squadre trovate ma nessun giocatore parsato. Vedi debug snippet.';
  } else if (!allValid) {
    const issues = teams
      .flatMap((t) => t.validation?.issues.map((i) => i.message) || [])
      .slice(0, 8);
    error = `Rose incomplete o non valide: ${issues.join('; ')}`;
  }

  return {
    success: teams.length > 0 && totalPlayers > 0,
    teams,
    allValid,
    rawHtmlSample: totalPlayers === 0 ? debugSnippet : undefined,
    error,
  };
}

/**
 * Extract sanitized debug snippet from HTML (title + table headers, no credentials)
 */
function extractSanitizedDebugSnippet(html: string): string {
  const lines: string[] = [];
  
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (titleMatch) {
    lines.push(`Title: ${titleMatch[1]}`);
  }
  
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  const h2Match = html.match(/<h2[^>]*>([^<]*)<\/h2>/i);
  if (h1Match) lines.push(`H1: ${h1Match[1]}`);
  if (h2Match) lines.push(`H2: ${h2Match[1]}`);
  
  const tableHeaders: string[] = [];
  const thRegex = /<th[^>]*>([^<]*)<\/th>/gi;
  let thMatch;
  while ((thMatch = thRegex.exec(html)) !== null && tableHeaders.length < 20) {
    const text = thMatch[1].trim();
    if (text && text.length < 50) {
      tableHeaders.push(text);
    }
  }
  if (tableHeaders.length > 0) {
    lines.push(`Table headers: ${tableHeaders.join(' | ')}`);
  }
  
  const tableCount = (html.match(/<table/gi) || []).length;
  const trCount = (html.match(/<tr/gi) || []).length;
  const tdCount = (html.match(/<td/gi) || []).length;
  lines.push(`Tables: ${tableCount}, Rows: ${trCount}, Cells: ${tdCount}`);
  
  const roleMatches = html.match(/\b(POR|DIF|CEN|ATT|[PDCA])\b/gi) || [];
  const uniqueRoles = [...new Set(roleMatches.map(r => r.toUpperCase()))];
  if (uniqueRoles.length > 0) {
    lines.push(`Role-like patterns found: ${uniqueRoles.join(', ')}`);
  }
  
  const sampleTd: string[] = [];
  const tdRegex = /<td[^>]*>([^<]{2,50})<\/td>/gi;
  let tdMatch;
  while ((tdMatch = tdRegex.exec(html)) !== null && sampleTd.length < 10) {
    const text = tdMatch[1].trim();
    if (text && !text.includes('password') && !text.includes('Password')) {
      sampleTd.push(text);
    }
  }
  if (sampleTd.length > 0) {
    lines.push(`Sample TD content: ${sampleTd.join(' | ')}`);
  }
  
  return lines.join('\n');
}

/**
 * Quadratura (solo lettura): login e lettura del tabellino di una sfida dalla
 * modale TABELLINI. Nessun altro form viene inviato.
 */
export async function loginFMSRevoReadOnly(): Promise<{ success: boolean; cookies: string; error?: string }> {
  const username = process.env.FMSREVO_USERNAME;
  const password = process.env.FMSREVO_PASSWORD;
  if (!username || !password) return { success: false, cookies: '', error: 'Credenziali FMS Revo non configurate sul server' };
  const initial = await getInitialSession();
  if (initial.error) return { success: false, cookies: '', error: initial.error };
  return performLogin(username, password, initial.cookies);
}

export async function fetchFMSRevoTabellino(sessionCookies: string, idIncontro: number): Promise<string | null> {
  const body = new URLSearchParams({ azione: 'TABELLINI', idIncontro: String(idIncontro), Storico: '' });
  const res = await fetch(`${FMSREVO_BASE_URL}/template/controller/ctrlModal.php`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${FMSREVO_BASE_URL}/`,
      'Cookie': sessionCookies,
    },
    body: body.toString(),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  try {
    const json = (await res.json()) as { esito?: string; tabellino?: string };
    return typeof json.tabellino === 'string' && json.tabellino.length > 0 ? json.tabellino : null;
  } catch {
    return null;
  }
}

export const _testExports = {
  parseCookies,
  mergeCookieMaps,
  cookieMapToString,
  getInitialSession,
  performLogin,
  fetchLineupsPageInternal,
  discoverRostersPage,
  fetchRostersPage,
  fetchTeamRosterPage,
  parseRosterFromHtml,
};
