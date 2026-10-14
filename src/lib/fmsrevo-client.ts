/**
 * FMS Revo Client
 * 
 * Handles authentication and data fetching from the FMS Revo platform.
 * Uses server-only credentials FMSREVO_USERNAME and FMSREVO_PASSWORD.
 */

const FMSREVO_BASE_URL = 'https://bundlesliga.fmsrevo.it';
const FMSREVO_LOGIN_ENDPOINT = `${FMSREVO_BASE_URL}/core_main/controller/ctrlLogin.php`;
const FMSREVO_LINEUPS_ENDPOINT = `${FMSREVO_BASE_URL}/home/statoformazioni/all_formaz.php`;

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
}

export interface FMSRevoAllRostersResult {
  success: boolean;
  teams: FMSRevoTeamRoster[];
  error?: string;
  rawHtmlSample?: string;
}

/**
 * Fetch a single team's roster page and parse players
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
        'Accept': 'text/html,*/*;q=0.8',
        'Cookie': sessionCookies,
        'Referer': `${FMSREVO_BASE_URL}/`,
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    
    const teamNameMatch = html.match(/param=idFsq\d+">([^<]+)<\/a>/);
    const menuMatch = html.match(new RegExp(`param=idFsq${fmsTeamId}">([^<]+)<`));
    const teamName = menuMatch?.[1] || teamNameMatch?.[1] || null;

    return { success: true, html, teamName: teamName || undefined };
  } catch (error) {
    console.error(`[FMSRevo] Error fetching team ${fmsTeamId}:`, error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Parse roster from HTML - discovers structure automatically
 */
function parseRosterFromHtml(html: string): Array<{
  name: string;
  role: 'P' | 'D' | 'C' | 'A';
  realTeam: string;
  price?: number;
}> {
  const players: Array<{
    name: string;
    role: 'P' | 'D' | 'C' | 'A';
    realTeam: string;
    price?: number;
  }> = [];

  const roleMap: Record<string, 'P' | 'D' | 'C' | 'A'> = {
    'P': 'P', 'POR': 'P',
    'D': 'D', 'DIF': 'D',
    'C': 'C', 'CEN': 'C',
    'A': 'A', 'ATT': 'A',
  };

  const playerRowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([PDCA]|POR|DIF|CEN|ATT)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?(?:<td[^>]*>(\d+(?:[.,]\d+)?)<\/td>)?[\s\S]*?<\/tr>/gi;
  
  let match;
  while ((match = playerRowRegex.exec(html)) !== null) {
    const roleRaw = match[1].trim().toUpperCase();
    const name = match[2].trim();
    const realTeam = match[3].trim();
    const priceStr = match[4];
    
    const role = roleMap[roleRaw];
    if (role && name && realTeam) {
      players.push({
        name,
        role,
        realTeam,
        price: priceStr ? parseFloat(priceStr.replace(',', '.')) : undefined,
      });
    }
  }

  if (players.length === 0) {
    const simpleRegex = /([PDCA])\s*[-|]\s*([^-|<]+)\s*[-|]\s*([A-Za-z]+)/gi;
    while ((match = simpleRegex.exec(html)) !== null) {
      const roleRaw = match[1].toUpperCase();
      const name = match[2].trim();
      const realTeam = match[3].trim();
      
      const role = roleMap[roleRaw];
      if (role && name.length > 2) {
        players.push({ name, role, realTeam });
      }
    }
  }

  return players;
}

/**
 * Fetch all team rosters from FMS Revo
 */
export async function fetchAllFMSRevoRosters(): Promise<FMSRevoAllRostersResult> {
  const username = process.env.FMSREVO_USERNAME;
  const password = process.env.FMSREVO_PASSWORD;

  if (!username || !password) {
    return { success: false, teams: [], error: 'Credenziali FMS Revo non configurate' };
  }

  const initialSession = await getInitialSession();
  if (initialSession.error) {
    return { success: false, teams: [], error: initialSession.error };
  }

  const loginResult = await performLogin(username, password, initialSession.cookies);
  if (!loginResult.success) {
    return { success: false, teams: [], error: loginResult.error };
  }

  const teams: FMSRevoTeamRoster[] = [];
  let rawHtmlSample: string | undefined;

  for (let fmsTeamId = 1; fmsTeamId <= 12; fmsTeamId++) {
    const result = await fetchTeamRosterPage(loginResult.cookies, fmsTeamId);
    
    if (!result.success || !result.html) {
      console.log(`[FMSRevo] Team ${fmsTeamId}: ${result.error || 'no data'}`);
      if (fmsTeamId > 10) break;
      continue;
    }

    if (!rawHtmlSample && fmsTeamId === 1) {
      rawHtmlSample = result.html.substring(0, 5000);
    }

    const players = parseRosterFromHtml(result.html);
    
    if (result.teamName) {
      teams.push({
        fmsTeamId,
        teamName: result.teamName,
        players,
      });
      console.log(`[FMSRevo] Team ${fmsTeamId} (${result.teamName}): ${players.length} players`);
    }
  }

  return {
    success: teams.length > 0,
    teams,
    rawHtmlSample,
    error: teams.length === 0 ? 'Nessuna rosa trovata' : undefined,
  };
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
