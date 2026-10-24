/** POST /api/push/test { endpoint }: push di prova dal server verso un'iscrizione esistente (max 1 al minuto). */
import { NextRequest, NextResponse } from 'next/server';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { getTeamById } from '@/data/teams';
import { isAllowedEndpoint, isWebPushConfigured, sendPush } from '@/lib/push/web-push';
import { claimKeys, deleteSubscription, markDelivered } from '@/lib/push/store';

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured() || !isWebPushConfigured()) return NextResponse.json({ error: 'Push non configurato' }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!isAllowedEndpoint(body?.endpoint)) return NextResponse.json({ error: 'Endpoint non valido' }, { status: 400 });
  const db = getServerClient();
  const { data: sub } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, team_id').eq('endpoint', body.endpoint).maybeSingle();
  if (!sub) return NextResponse.json({ error: 'Iscrizione non trovata' }, { status: 404 });
  const minuteKey = `test:${new Date().toISOString().slice(0, 16)}`;
  if ((await claimKeys(db, sub.id, [minuteKey])).size === 0) return NextResponse.json({ error: 'Una prova al minuto' }, { status: 429 });
  const team = getTeamById(sub.team_id as string)?.name ?? 'FantaLive';
  const result = await sendPush(sub, { title: `👟 ${team}`, body: 'Assist di Caqueret (Como) 23′ (prova dal server)', tag: 'test-push', url: '/impostazioni' });
  if (!result.ok && result.gone) await deleteSubscription(db, sub.endpoint);
  if (result.ok) await markDelivered(db, sub.id);
  return NextResponse.json(result.ok ? { success: true, status: result.status } : { success: false, status: result.status, gone: result.gone }, { status: result.ok ? 200 : 502 });
}
