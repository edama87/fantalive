/**
 * Login to FMS Revo, download index.php?param=idFsq1 (and optionally all teams),
 * hydrate widget HTML via ctrlWidget AJAX, and save to uploads/fmsrevo/.
 *
 * Usage:
 *   npx tsx scripts/download-fmsrevo-roster.ts
 *   npx tsx scripts/download-fmsrevo-roster.ts --all
 *
 * Requires FMSREVO_USERNAME / FMSREVO_PASSWORD in env or .env.local.
 * Never prints credentials.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://bundlesliga.fmsrevo.it';
const LOGIN_URL = `${BASE_URL}/core_main/controller/ctrlLogin.php`;
const WIDGET_URL = `${BASE_URL}/template/controller/ctrlWidget.php`;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const OUT_DIR = path.join(process.cwd(), 'uploads', 'fmsrevo');

function assertNoCredentialLeak(text: string, username: string, password: string) {
  if (username && text.includes(username)) {
    throw new Error('Refusing to write output that contains the username');
  }
  if (password && text.includes(password)) {
    throw new Error('Refusing to write output that contains the password');
  }
}

async function loadEnvLocal() {
  try {
    const raw = await readFile(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local optional
  }
}

function parseCookies(setCookieHeaders: string[]): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const header of setCookieHeaders) {
    const cookiePart = header.split(';')[0];
    if (!cookiePart) continue;
    const eqIdx = cookiePart.indexOf('=');
    if (eqIdx > 0) {
      cookies.set(
        cookiePart.slice(0, eqIdx).trim(),
        cookiePart.slice(eqIdx + 1).trim()
      );
    }
  }
  return cookies;
}

function mergeCookies(
  base: Map<string, string>,
  extra: Map<string, string>
): Map<string, string> {
  const merged = new Map(base);
  for (const [k, v] of extra) merged.set(k, v);
  return merged;
}

function cookieHeader(cookies: Map<string, string>): string {
  return Array.from(cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function getInitialSession(): Promise<Map<string, string>> {
  const res = await fetch(BASE_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,*/*;q=0.8',
    },
  });
  if (!res.ok) {
    throw new Error(`Homepage non raggiungibile (HTTP ${res.status})`);
  }
  return parseCookies(res.headers.getSetCookie?.() || []);
}

async function login(
  username: string,
  password: string,
  session: Map<string, string>
): Promise<Map<string, string>> {
  const body = new URLSearchParams({
    loginuser: username,
    loginpwd: password,
    RememberMe: 'on',
  });

  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${BASE_URL}/`,
      Cookie: cookieHeader(session),
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Login HTTP ${res.status}`);
  }

  const text = await res.text();
  let parsed: { esito?: string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Risposta login non valida');
  }
  if (parsed.esito !== 'OK') {
    throw new Error('Credenziali FMS Revo errate');
  }

  const newCookies = parseCookies(res.headers.getSetCookie?.() || []);
  return mergeCookies(session, newCookies);
}

async function fetchPage(
  cookies: Map<string, string>,
  fmsTeamId: number
): Promise<string> {
  const url = `${BASE_URL}/index.php?param=idFsq${fmsTeamId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,*/*;q=0.8',
      Cookie: cookieHeader(cookies),
      Referer: `${BASE_URL}/`,
    },
  });
  if (!res.ok) {
    throw new Error(`idFsq${fmsTeamId} HTTP ${res.status}`);
  }
  return res.text();
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

async function fetchWidget(
  cookies: Map<string, string>,
  widgetId: string,
  param: string
): Promise<{ esito?: string; contenuto?: string } | null> {
  const body = new URLSearchParams({
    azione: 'CREALAYOUTWID',
    dati: widgetId,
    nomeWidget: widgetNameFromId(widgetId),
    reqPaginazione: 'false',
    param,
  });

  const res = await fetch(WIDGET_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: cookieHeader(cookies),
      Referer: `${BASE_URL}/index.php?param=${param}`,
    },
    body: body.toString(),
  });

  if (!res.ok) return null;
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hydrateWidgets(
  html: string,
  widgets: Array<{ id: string; contenuto: string }>
): string {
  let out = html;
  for (const w of widgets) {
    const safeId = w.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `(<[^>]+\\bid=["']${safeId}["'][^>]*>)([\\s\\S]*?)(</div>)`,
      'i'
    );
    if (re.test(out)) {
      out = out.replace(re, `$1${w.contenuto}$3`);
    } else {
      out += `\n<!-- widget:${w.id} -->\n<div id="${w.id}">${w.contenuto}</div>\n`;
    }
  }
  return out;
}

async function downloadTeam(
  cookies: Map<string, string>,
  fmsTeamId: number,
  username: string,
  password: string
) {
  const param = `idFsq${fmsTeamId}`;
  console.log(`[download] Fetching ${param}...`);
  const rawHtml = await fetchPage(cookies, fmsTeamId);
  assertNoCredentialLeak(rawHtml, username, password);

  const rawPath = path.join(OUT_DIR, `${param}.raw.html`);
  await writeFile(rawPath, rawHtml, 'utf8');
  console.log(`[download] Saved ${rawPath} (${rawHtml.length} bytes)`);

  const layout = extractConfigLayout(rawHtml);
  console.log(`[download] configLayout widgets: ${layout.length}`);

  // Roster is in ultime_notizie when param=idFsqN — fetch that first
  const prioritized = [
    ...layout.filter((item) => item.id?.startsWith('ultime_notizie')),
    ...layout.filter((item) => !item.id?.startsWith('ultime_notizie')),
  ];

  const hydratedParts: Array<{ id: string; contenuto: string }> = [];
  for (const item of prioritized) {
    if (!item.id) continue;
    const result = await fetchWidget(cookies, item.id, param);
    if (result?.esito === 'OK' && result.contenuto) {
      hydratedParts.push({ id: item.id, contenuto: result.contenuto });
      const widgetPath = path.join(OUT_DIR, `${param}.widget.${item.id}.html`);
      assertNoCredentialLeak(result.contenuto, username, password);
      await writeFile(widgetPath, result.contenuto, 'utf8');
      if (
        item.id.startsWith('ultime_notizie') &&
        /squadra__player-name|squadra__role/.test(result.contenuto)
      ) {
        console.log(`[download] Roster found in ${item.id}`);
        break;
      }
    }
  }

  const composed = hydrateWidgets(rawHtml, hydratedParts);
  assertNoCredentialLeak(composed, username, password);
  const composedPath = path.join(OUT_DIR, `${param}.html`);
  await writeFile(composedPath, composed, 'utf8');
  console.log(
    `[download] Saved ${composedPath} (${composed.length} bytes, ${hydratedParts.length} widgets)`
  );

  const hasRosterMarkers =
    /squadra__player-name|squadra__role|elenco_giocatori|contenutoSquadra/.test(
      composed
    );
  console.log(`[download] Roster markers present: ${hasRosterMarkers}`);

  return { composedPath, hasRosterMarkers, size: composed.length };
}

async function main() {
  await loadEnvLocal();

  const username = process.env.FMSREVO_USERNAME?.trim();
  const password = process.env.FMSREVO_PASSWORD?.trim();
  if (!username || !password) {
    console.error(
      'Credenziali mancanti. Imposta FMSREVO_USERNAME e FMSREVO_PASSWORD in .env.local (non verranno stampate).'
    );
    process.exit(1);
  }

  const all = process.argv.includes('--all');
  await mkdir(OUT_DIR, { recursive: true });

  console.log('[download] Getting session...');
  const session = await getInitialSession();
  console.log('[download] Logging in...');
  const cookies = await login(username, password, session);
  console.log('[download] Login OK');

  const ids = all ? Array.from({ length: 12 }, (_, i) => i + 1) : [1];
  for (const id of ids) {
    const result = await downloadTeam(cookies, id, username, password);
    if (all && !result.hasRosterMarkers && result.size > 0) {
      // Stop early when scanning beyond known teams if page has no roster
      if (id > 10) {
        console.log(`[download] Stopping at idFsq${id} (no roster markers)`);
        break;
      }
    }
  }

  console.log('[download] Done. Files in uploads/fmsrevo/');
}

main().catch((err) => {
  console.error('[download] Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
