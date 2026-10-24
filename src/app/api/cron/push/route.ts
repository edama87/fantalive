/**
 * Push Cron Route — GET/POST /api/cron/push (Authorization: Bearer CRON_SECRET)
 *
 * Chiamata ogni minuto da Supabase pg_cron + pg_net (job 'fantalive-push').
 * Per la giornata corrente calcola, per ogni iscritto, gli eventi live nuovi della sua
 * sfida e i promemoria dovuti, li deduplica in sent_notifications e li invia via Web Push.
 * Uscita immediata (2 query leggere) se non ci sono iscritti o partite attive.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { getCurrentRound } from '@/data/calendar';
import { isWebPushConfigured, sendPush } from '@/lib/push/web-push';
import { claimKeys, deleteSubscription, listSubscriptions, markDelivered, markFailure, releaseKey } from '@/lib/push/store';
import { messagesFor, parsePushPrefs } from '@/lib/push/plan';
import { loadRoundSnapshot } from '@/lib/push/snapshot';
import { pushWindowActive, type MatchTiming } from '@/lib/push/window';

export const maxDuration = 30;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSupabaseServerConfigured() || !isWebPushConfigured()) return NextResponse.json({ error: 'Push non configurato' }, { status: 503 });

  const db = getServerClient();
  const round = getCurrentRound();
  try {
    const subs = await listSubscriptions(db);
    if (subs.length === 0) return NextResponse.json({ success: true, skipped: 'no_subscriptions' });
    const { data: matches, error } = await db.from('serie_a_matches').select('status, kickoff_time').eq('round_number', round.number);
    if (error) throw new Error(`serie_a_matches: ${error.message}`);
    const now = Date.now();
    const force = new URL(request.url).searchParams.get('force') === '1';
    if (!force && !pushWindowActive((matches ?? []) as MatchTiming[], now)) {
      return NextResponse.json({ success: true, skipped: 'no_active_matches', round: round.number, subscriptions: subs.length });
    }

    const snapshot = await loadRoundSnapshot(round.number);
    let sent = 0;
    let removed = 0;
    let failed = 0;
    await Promise.all(
      subs.map(async (sub) => {
        const messages = messagesFor(snapshot, sub.team_id, parsePushPrefs(sub.prefs), now);
        const fresh = await claimKeys(db, sub.id, messages.map((m) => m.key));
        for (const m of messages) {
          if (!fresh.has(m.key)) continue;
          const result = await sendPush(sub, { title: m.title, body: m.body, tag: m.key, url: m.url });
          if (result.ok) {
            sent++;
            await markDelivered(db, sub.id);
          } else if (result.gone) {
            removed++;
            await deleteSubscription(db, sub.endpoint);
            return;
          } else {
            failed++;
            await markFailure(db, sub.id, `${result.status} ${result.error}`);
            await releaseKey(db, sub.id, m.key);
          }
        }
      })
    );
    return NextResponse.json({ success: true, round: round.number, subscriptions: subs.length, sent, removed, failed, durationMs: Date.now() - started });
  } catch (error) {
    console.error('[Cron Push]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
