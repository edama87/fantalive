/**
 * Lettura (sola lettura) dei report mercato FMS Revo: login + report delle
 * sessioni concluse + crediti della squadra loggata. Nessun altro form.
 */
import { loginFMSRevoReadOnly } from '@/lib/fmsrevo-client';
import {
  parseMarketReportTable,
  parseMarketSessions,
  parseSignedUserCredits,
  type MarketOperation,
} from '@/lib/fms-market-report';

const BASE = 'https://bundlesliga.fmsrevo.it';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TTL_MS = 10 * 60 * 1000;

export interface FmsMarketData {
  sessions: string[];
  operations: MarketOperation[];
  signedUser: { teamName: string; credits: number } | null;
  fetchedAt: string;
}

let cache: { at: number; data: FmsMarketData } | null = null;

async function report(cookies: string, body: string): Promise<{ tabella?: string; contenutoSelect?: string } | null> {
  const res = await fetch(`${BASE}/template/controller/ctrlMercato.php`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Cookie: cookies,
      Referer: `${BASE}/mercato.php`,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = JSON.parse(await res.text()) as { esito?: string; tabella?: string; contenutoSelect?: string };
  return json.esito === 'OK' ? json : null;
}

export async function fetchFmsMarketData(): Promise<FmsMarketData> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const login = await loginFMSRevoReadOnly();
  if (!login.success) throw new Error(login.error ?? 'Login FMS Revo non riuscito');

  // Elenco sessioni concluse (stessa chiamata del pulsante "Info sessioni precedenti").
  const first = await report(login.cookies, 'azione=MODALREPORTRISULTATI');
  if (!first) throw new Error('Report mercato FMS non disponibile');
  const sessions = parseMarketSessions(first.contenutoSelect ?? '');
  const operations: MarketOperation[] = [];
  for (const s of sessions) {
    const r = await report(login.cookies, `azione=REPORTRISULTATI&sessione=${s.value}`);
    operations.push(...parseMarketReportTable(r?.tabella ?? ''));
  }

  const page = await fetch(`${BASE}/mercato.php`, {
    headers: { 'User-Agent': UA, Cookie: login.cookies, Referer: `${BASE}/` },
    cache: 'no-store',
  });
  const signedUser = page.ok ? parseSignedUserCredits(await page.text()) : null;

  const data = { sessions: sessions.map((s) => s.label), operations, signedUser, fetchedAt: new Date().toISOString() };
  cache = { at: Date.now(), data };
  return data;
}
