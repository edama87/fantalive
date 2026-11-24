/** Payload e invio di un broadcast Web Push (nessuna dipendenza server: usabile anche in admin client). */
import { z } from 'zod';

export const BROADCAST_TITLE_MAX = 120;
export const BROADCAST_BODY_MAX = 300;
export const BROADCAST_URL_MAX = 200;

export interface BroadcastPayload {
  title: string;
  body: string;
  url: string;
  key: string;
}

export interface BroadcastCounts {
  subscriptions: number;
  sent: number;
  skipped: number;
  removed: number;
  failed: number;
}

export interface BroadcastTarget {
  id: string;
  endpoint: string;
}

export type BroadcastSendResult =
  | { ok: true }
  | { ok: false; gone: boolean; status: number; error: string };

export interface BroadcastDeps<T extends BroadcastTarget = BroadcastTarget> {
  claimKeys: (subscriptionId: string, keys: string[]) => Promise<Set<string>>;
  sendPush: (
    sub: T,
    payload: { title: string; body: string; tag: string; url: string },
  ) => Promise<BroadcastSendResult>;
  deleteSubscription: (endpoint: string) => Promise<void>;
  markDelivered: (subscriptionId: string) => Promise<void>;
  markFailure: (subscriptionId: string, message: string) => Promise<void>;
  releaseKey: (subscriptionId: string, key: string) => Promise<void>;
}

/** Solo percorsi interni dell'app (`/giornale/6`), niente URL assoluti o protocol-relative. */
export function isSafeAppPath(url: string): boolean {
  if (url.length < 1 || url.length > BROADCAST_URL_MAX) return false;
  if (!url.startsWith('/') || url.startsWith('//')) return false;
  if (url.includes('\\') || url.includes('://')) return false;
  if (/\s/.test(url) || /[\u0000-\u001F\u007F]/.test(url)) return false;
  return true;
}

const broadcastPayloadSchema = z.object({
  title: z.string().trim().min(1).max(BROADCAST_TITLE_MAX),
  body: z.string().trim().min(1).max(BROADCAST_BODY_MAX),
  url: z.string().trim().min(1).max(BROADCAST_URL_MAX).refine(isSafeAppPath),
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9:_-]{1,79}$/i),
});

export function parseBroadcastPayload(
  input: unknown,
): { ok: true; value: BroadcastPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Payload non valido' };
  const raw = input as Record<string, unknown>;
  const parsed = broadcastPayloadSchema.safeParse({
    title: raw.title,
    body: raw.body ?? raw.text,
    url: raw.url,
    key: raw.key ?? raw.eventKey ?? raw.event_key,
  });
  if (!parsed.success) return { ok: false, error: 'Payload non valido' };
  return { ok: true, value: parsed.data };
}

export function articleBroadcastDefaults(round: number): BroadcastPayload {
  if (!Number.isInteger(round) || round <= 0 || round > 60) {
    throw new Error('Giornata non valida');
  }
  return {
    title: `Il Bundle Quotidiano — Giornata ${round}`,
    body: 'È uscito il pezzo della giornata: commenti, classifica e vignette. Il pianto, come sempre, paga.',
    url: `/giornale/${round}`,
    key: `article:r${round}`,
  };
}

/**
 * Invia il messaggio a ogni iscrizione, una sola volta per chiave (`sent_notifications`).
 * Iscrizioni 404/410 vengono rimosse; un errore transitorio rilascia la chiave per un ritentativo.
 */
export async function deliverBroadcast<T extends BroadcastTarget>(
  subs: readonly T[],
  payload: BroadcastPayload,
  deps: BroadcastDeps<T>,
): Promise<BroadcastCounts> {
  const counts: BroadcastCounts = {
    subscriptions: subs.length,
    sent: 0,
    skipped: 0,
    removed: 0,
    failed: 0,
  };
  const pushPayload = { title: payload.title, body: payload.body, tag: payload.key, url: payload.url };
  for (const sub of subs) {
    const fresh = await deps.claimKeys(sub.id, [payload.key]);
    if (!fresh.has(payload.key)) {
      counts.skipped += 1;
      continue;
    }
    const result = await deps.sendPush(sub, pushPayload);
    if (result.ok) {
      counts.sent += 1;
      await deps.markDelivered(sub.id);
    } else if (result.gone) {
      counts.removed += 1;
      await deps.deleteSubscription(sub.endpoint);
    } else {
      counts.failed += 1;
      await deps.markFailure(sub.id, `${result.status} ${result.error}`.slice(0, 300));
      await deps.releaseKey(sub.id, payload.key);
    }
  }
  return counts;
}
