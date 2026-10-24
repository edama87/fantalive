/** Iscrizioni push e notifiche già inviate (tabelle push_subscriptions / sent_notifications, solo service role). */
import { getServerClient } from '@/lib/db/supabase';
import type { StoredSubscription } from './web-push';

export interface SubscriptionRow extends StoredSubscription {
  team_id: string;
  prefs: unknown;
}

type Db = ReturnType<typeof getServerClient>;

export async function upsertSubscription(
  db: Db,
  sub: { endpoint: string; p256dh: string; auth: string },
  teamId: string,
  prefs: unknown,
  userAgent: string | null
): Promise<string> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('push_subscriptions')
    .upsert(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, team_id: teamId, prefs, user_agent: userAgent, updated_at: now, last_seen_at: now },
      { onConflict: 'endpoint' }
    )
    .select('id')
    .single();
  if (error) throw new Error(`push_subscriptions: ${error.message}`);
  return data.id as string;
}

export async function deleteSubscription(db: Db, endpoint: string): Promise<void> {
  const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw new Error(`push_subscriptions: ${error.message}`);
}

export async function listSubscriptions(db: Db): Promise<SubscriptionRow[]> {
  const { data, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, team_id, prefs');
  if (error) throw new Error(`push_subscriptions: ${error.message}`);
  return (data ?? []) as SubscriptionRow[];
}

/**
 * Prenota le chiavi (insert ... on conflict do nothing) e restituisce solo quelle nuove:
 * due giri sovrapposti del job non possono inviare due volte la stessa notifica.
 */
export async function claimKeys(db: Db, subscriptionId: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data, error } = await db
    .from('sent_notifications')
    .upsert(keys.map((event_key) => ({ subscription_id: subscriptionId, event_key })), { onConflict: 'subscription_id,event_key', ignoreDuplicates: true })
    .select('event_key');
  if (error) throw new Error(`sent_notifications: ${error.message}`);
  return new Set((data ?? []).map((r) => r.event_key as string));
}

export async function markDelivered(db: Db, subscriptionId: string): Promise<void> {
  await db.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq('id', subscriptionId);
}

export async function markFailure(db: Db, subscriptionId: string, message: string): Promise<void> {
  const { data } = await db.from('push_subscriptions').select('failure_count').eq('id', subscriptionId).maybeSingle();
  await db
    .from('push_subscriptions')
    .update({ failure_count: ((data?.failure_count as number | undefined) ?? 0) + 1, last_error: message.slice(0, 300) })
    .eq('id', subscriptionId);
}

/** Invio fallito (non 404/410): libera la chiave così il prossimo giro riprova. */
export async function releaseKey(db: Db, subscriptionId: string, key: string): Promise<void> {
  await db.from('sent_notifications').delete().eq('subscription_id', subscriptionId).eq('event_key', key);
}
