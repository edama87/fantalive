/** Il job push lavora solo se serve: partite in corso, appena finite o in arrivo. */
export interface MatchTiming {
  status: string;
  kickoff_time: string | null;
}

const REMINDER_LOOKAHEAD = 61 * 60_000; // promemoria fino a 60 minuti prima
const AFTER_KICKOFF = 4 * 60 * 60_000; // eventi tardivi (assist e voti da fantacalcio.it)

export function pushWindowActive(matches: readonly MatchTiming[], now: number): boolean {
  return matches.some((m) => {
    if (m.status === 'live' || m.status === 'halftime') return true;
    const kickoff = m.kickoff_time ? Date.parse(m.kickoff_time) : NaN;
    if (!Number.isFinite(kickoff)) return false;
    return kickoff - now <= REMINDER_LOOKAHEAD && now - kickoff <= AFTER_KICKOFF;
  });
}
