/** Preferenze notifiche, salvate nel localStorage del dispositivo. */
export const NOTIFY_SETTINGS_KEY = 'fantalive_notify';
export const NOTIFY_SETTINGS_EVENT = 'fantalive-notify-change';
export const REMINDER_OPTIONS = [15, 30, 60] as const;
export type ReminderMinutes = (typeof REMINDER_OPTIONS)[number];

export interface NotifySettings {
  enabled: boolean;
  minutesBefore: ReminderMinutes;
  /** Squadra per cui ricordare le partite (rispecchia il cookie della squadra). */
  teamId: string | null;
}

export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = { enabled: false, minutesBefore: 30, teamId: null };

export function parseNotifySettings(raw: string | null | undefined): NotifySettings {
  if (!raw) return { ...DEFAULT_NOTIFY_SETTINGS };
  try {
    const v = JSON.parse(raw) as Partial<NotifySettings>;
    const minutes = REMINDER_OPTIONS.includes(v.minutesBefore as ReminderMinutes) ? (v.minutesBefore as ReminderMinutes) : 30;
    const teamId = typeof v.teamId === 'string' && /^[a-z0-9_-]{1,20}$/i.test(v.teamId) ? v.teamId : null;
    return { enabled: v.enabled === true, minutesBefore: minutes, teamId };
  } catch {
    return { ...DEFAULT_NOTIFY_SETTINGS };
  }
}

export function loadNotifySettings(): NotifySettings {
  return parseNotifySettings(window.localStorage.getItem(NOTIFY_SETTINGS_KEY));
}

export function saveNotifySettings(settings: NotifySettings): void {
  window.localStorage.setItem(NOTIFY_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(NOTIFY_SETTINGS_EVENT));
}

export interface PlannedReminder {
  tag: string;
  at: number;
  title: string;
  body: string;
}

/**
 * Promemoria futuri: uno per partita con i miei giocatori, `minutesBefore` prima del via.
 * Le partite già iniziate o col promemoria già passato vengono saltate.
 */
export function planReminders(
  entries: ReadonlyArray<{ fixture: { matchId: string; homeCode: string; awayCode: string; kickoffTime: string | null; status: string }; players: readonly { name: string; starter: boolean }[] }>,
  minutesBefore: number,
  now: number
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const { fixture, players } of entries) {
    if (!fixture.kickoffTime || fixture.status !== 'scheduled' || players.length === 0) continue;
    const kickoff = Date.parse(fixture.kickoffTime);
    const at = kickoff - minutesBefore * 60_000;
    if (!Number.isFinite(at) || at <= now) continue;
    const starters = players.filter((p) => p.starter).map((p) => p.name);
    const bench = players.length - starters.length;
    const who = starters.length ? starters.join(', ') : 'solo panchinari';
    out.push({
      tag: `kickoff-${fixture.matchId}-${minutesBefore}`,
      at,
      title: `${fixture.homeCode}-${fixture.awayCode} tra ${minutesBefore}′`,
      body: `In campo: ${who}${bench && starters.length ? ` (+${bench} in panchina)` : ''}`,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** iPhone/iPad: le notifiche web funzionano solo dall'app aggiunta alla schermata Home (iOS 16.4+). */
export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}
