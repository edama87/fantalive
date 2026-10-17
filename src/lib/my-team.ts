/**
 * "La mia squadra": preferenza di visualizzazione per dispositivo (non dati
 * della lega). Salvata in un cookie leggibile anche lato server.
 */

export const MY_TEAM_COOKIE = 'fantalive_team';
/** Valore del cookie per "Salta" (vista neutra). */
export const MY_TEAM_NONE = 'none';
export const MY_TEAM_MAX_AGE = 60 * 60 * 24 * 365;
export const MY_TEAM_EVENT = 'fantalive-team-change';

/** teamId scelto, null per "Salta" o valore non valido/assente. */
export function parseMyTeam(value: string | null | undefined, validTeamIds?: readonly string[]): string | null {
  if (!value || value === MY_TEAM_NONE) return null;
  if (!/^[a-z0-9_-]{1,20}$/i.test(value)) return null;
  if (validTeamIds && !validTeamIds.includes(value)) return null;
  return value;
}

/** true se sul dispositivo è già stata fatta una scelta (squadra o "Salta"). */
export function hasMyTeamChoice(value: string | null | undefined): boolean {
  return value === MY_TEAM_NONE || parseMyTeam(value) !== null;
}

export function readCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** Percorso di ritorno sicuro dopo la scelta (solo percorsi interni). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/benvenuto')) return '/';
  return next;
}

/** Solo browser: salva la scelta e avvisa i componenti aperti. */
export function saveMyTeamChoice(teamId: string | null): void {
  const value = teamId ?? MY_TEAM_NONE;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${MY_TEAM_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${MY_TEAM_MAX_AGE}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(MY_TEAM_EVENT));
}
