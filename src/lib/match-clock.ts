/**
 * Minuto partita per le liste: "83′", "45′+2", "Intervallo", "Finale".
 * Fonte: displayClock ESPN (fantacalcio.it non pubblica il minuto nel calendario).
 */

export type ClockStatus = 'scheduled' | 'live' | 'halftime' | 'finished';

/** displayClock ESPN ("83'", "45'+2'", "90'+5'") -> "83′", "45′+2", "90′+5"; null se assente. */
export function espnClockLabel(display: string | undefined | null): string | null {
  const m = display?.match(/(\d+)\s*'?\s*(?:\+\s*(\d+))?/);
  if (!m || (m[1] === '0' && !m[2])) return null;
  return `${Number(m[1])}′${m[2] ? `+${Number(m[2])}` : ''}`;
}

export function matchClockText(match: { status: ClockStatus; minute?: number | null; clock?: string | null }): string | null {
  switch (match.status) {
    case 'halftime':
      return 'Intervallo';
    case 'finished':
      return 'Finale';
    case 'live':
      return match.clock ?? (match.minute ? `${match.minute}′` : 'In corso');
    default:
      return null;
  }
}
