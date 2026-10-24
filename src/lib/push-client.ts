'use client';

/**
 * Web Push lato browser: iscrizione al push service, sincronizzazione con il server
 * e flag "push attivo" che spegne le notifiche locali (niente doppioni).
 */
import { getNotifyRegistration, notificationsSupported } from '@/lib/notify-client';
import type { NotifySettings } from '@/lib/notify-settings';

const ACTIVE_KEY = 'fantalive_push_active';
export const PUSH_STATE_EVENT = 'fantalive-push-change';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    notificationsSupported() &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  );
}

/** True se il server sta inviando le notifiche a questo dispositivo: le locali vanno spente. */
export function isPushActive(): boolean {
  try { return !!localStorage.getItem(ACTIVE_KEY); } catch { return false; }
}

function setPushActive(endpoint: string | null) {
  try {
    if (endpoint) localStorage.setItem(ACTIVE_KEY, endpoint);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* storage bloccato */ }
  window.dispatchEvent(new Event(PUSH_STATE_EVENT));
}

export function pushEndpoint(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

function vapidKey(): Uint8Array<ArrayBuffer> {
  const b64 = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const prefsOf = ({ teamId: _t, ...prefs }: NotifySettings) => { void _t; return prefs; };

/**
 * Allinea il server alle impostazioni: iscrive/aggiorna se almeno una notifica è attiva
 * e il permesso c'è, altrimenti disiscrive. Non lancia mai; restituisce lo stato finale.
 */
export async function syncPush(settings: NotifySettings): Promise<'active' | 'off' | 'unsupported' | 'error'> {
  if (!pushSupported()) { setPushActive(null); return 'unsupported'; }
  const wanted = (settings.enabled || settings.liveEnabled) && !!settings.teamId && Notification.permission === 'granted';
  try {
    const reg = await getNotifyRegistration();
    if (!reg) { setPushActive(null); return 'unsupported'; }
    let sub = await reg.pushManager.getSubscription();
    if (!wanted) {
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setPushActive(null);
      return 'off';
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey() });
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), teamId: settings.teamId, prefs: prefsOf(settings) }),
    });
    if (!res.ok) throw new Error(`subscribe ${res.status}`);
    setPushActive(sub.endpoint);
    return 'active';
  } catch {
    // Push non disponibile (rete, server, browser): restano le notifiche locali.
    setPushActive(null);
    return 'error';
  }
}

/** Push di prova inviato dal server a questo dispositivo. */
export async function sendServerTestPush(): Promise<boolean> {
  const endpoint = pushEndpoint();
  if (!endpoint) return false;
  const res = await fetch('/api/push/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint }) }).catch(() => null);
  return !!res?.ok;
}
