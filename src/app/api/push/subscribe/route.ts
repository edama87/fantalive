/**
 * POST   /api/push/subscribe  { subscription, teamId, prefs }  iscrive o aggiorna
 * DELETE /api/push/subscribe  { endpoint }                     disiscrive
 * Le preferenze arrivano da /impostazioni a ogni modifica e a ogni apertura dell'app.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { getTeamById } from '@/data/teams';
import { getCurrentRound } from '@/data/calendar';
import { isAllowedEndpoint } from '@/lib/push/web-push';
import { claimKeys, deleteSubscription, upsertSubscription } from '@/lib/push/store';
import { liveMessages, parsePushPrefs } from '@/lib/push/plan';
import { loadRoundSnapshot } from '@/lib/push/snapshot';

const isKey = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200 && /^[A-Za-z0-9_=-]+$/.test(v);

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 503 });
  const body = (await request.json().catch(() => null)) as {
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    teamId?: unknown;
    prefs?: unknown;
  } | null;
  const endpoint = body?.subscription?.endpoint;
  const p256dh = body?.subscription?.keys?.p256dh;
  const auth = body?.subscription?.keys?.auth;
  const teamId = typeof body?.teamId === 'string' && getTeamById(body.teamId) ? body.teamId : null;
  if (!isAllowedEndpoint(endpoint) || !isKey(p256dh) || !isKey(auth) || !teamId) {
    return NextResponse.json({ error: 'Iscrizione non valida' }, { status: 400 });
  }
  const prefs = parsePushPrefs(body?.prefs);
  const db = getServerClient();
  try {
    const { data: before } = await db.from('push_subscriptions').select('team_id, prefs').eq('endpoint', endpoint).maybeSingle();
    const id = await upsertSubscription(db, { endpoint, p256dh, auth }, teamId, prefs, request.headers.get('user-agent')?.slice(0, 300) ?? null);
    // Nuova iscrizione o preferenze cambiate: gli eventi già successi non vanno notificati.
    if (!before || before.team_id !== teamId || JSON.stringify(before.prefs) !== JSON.stringify(prefs)) {
      try {
        const snapshot = await loadRoundSnapshot(getCurrentRound().number);
        await claimKeys(db, id, liveMessages(snapshot, teamId, null, true).map((m) => m.key));
      } catch (error) {
        console.warn('[Push] seed:', error instanceof Error ? error.message : error);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Push] subscribe:', error);
    return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!isAllowedEndpoint(body?.endpoint)) return NextResponse.json({ error: 'Endpoint non valido' }, { status: 400 });
  try {
    await deleteSubscription(getServerClient(), body.endpoint);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Push] unsubscribe:', error);
    return NextResponse.json({ error: 'Errore del server' }, { status: 500 });
  }
}
