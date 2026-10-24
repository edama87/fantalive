/** Invio Web Push (server). Chiavi VAPID dalle env: la privata non lascia mai il server. */
import webpush from 'web-push';

export interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

let configured = false;

export function isWebPushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'https://fantalive-mu.vercel.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

export type SendResult = { ok: true; status: number } | { ok: false; status: number; gone: boolean; error: string };

/** Invia una notifica. `gone` = 404/410: l'iscrizione non esiste più e va cancellata. */
export async function sendPush(sub: StoredSubscription, payload: PushPayload): Promise<SendResult> {
  configure();
  try {
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60, urgency: 'high', topic: undefined }
    );
    return { ok: true, status: res.statusCode };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode ?? 0;
    return { ok: false, status, gone: status === 404 || status === 410, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Solo endpoint https dei push service noti (niente URL arbitrari verso cui far fare richieste al server). */
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.push\.apple\.com$/, /\.mozilla\.com$/, /\.mozaws\.net$/, /\.notify\.windows\.com$/];

export function isAllowedEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}
