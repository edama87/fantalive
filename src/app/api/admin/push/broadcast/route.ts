/**
 * POST /api/admin/push/broadcast
 * { title, body|text, url, key|eventKey } — notifica a tutte le iscrizioni, con deduplica.
 * Solo sessione admin. La risposta contiene esclusivamente i conteggi.
 */
import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { deliverBroadcast, parseBroadcastPayload } from '@/lib/push/broadcast';
import {
  claimKeys,
  deleteSubscription,
  listSubscriptions,
  markDelivered,
  markFailure,
  releaseKey,
} from '@/lib/push/store';
import { isWebPushConfigured, sendPush } from '@/lib/push/web-push';

export const maxDuration = 30;

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  }
  if (!isSupabaseServerConfigured() || !isWebPushConfigured()) {
    return NextResponse.json({ success: false, error: 'Push non configurato' }, { status: 503 });
  }

  const parsed = parseBroadcastPayload(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  }

  try {
    const db = getServerClient();
    const subs = await listSubscriptions(db);
    const counts = await deliverBroadcast(subs, parsed.value, {
      claimKeys: (id, keys) => claimKeys(db, id, keys),
      sendPush,
      deleteSubscription: (endpoint) => deleteSubscription(db, endpoint),
      markDelivered: (id) => markDelivered(db, id),
      markFailure: (id, message) => markFailure(db, id, message),
      releaseKey: (id, key) => releaseKey(db, id, key),
    });
    return NextResponse.json({ success: true, ...counts });
  } catch (error) {
    console.error('[Admin Push Broadcast]', error instanceof Error ? error.message : 'errore');
    return NextResponse.json({ success: false, error: 'Errore del server' }, { status: 500 });
  }
}
