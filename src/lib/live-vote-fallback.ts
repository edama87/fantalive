/**
 * Fallback per il dettaglio voti Serie A: durante la partita fantacalcio.it
 * non pubblica voti (pagina /voti vuota), mentre i voti live stimati (ESPN)
 * sono già in live_votes. Qui li si converte nel formato della pagina.
 */
import type { PlayerRole } from '@/types';
import { canonicalTeamCode, type FantacalcioVotePlayer } from '@/lib/fantacalcio-it';

export interface LiveVoteRow {
  name: string;
  role: string | null;
  realTeam: string | null;
  vote: number | null;
  isSubbedOut: boolean;
}

export function hasAnyVote(players: readonly FantacalcioVotePlayer[]): boolean {
  return players.some((p) => p.vote != null || p.fantaVote != null);
}

/** Righe live_votes -> giocatori della partita (solo le due squadre, solo con voto). */
export function liveVotesToMatchPlayers(rows: readonly LiveVoteRow[], homeTeam: string, awayTeam: string): FantacalcioVotePlayer[] {
  const byCode = new Map<string, string>();
  for (const team of [homeTeam, awayTeam]) {
    const code = canonicalTeamCode(team);
    if (code) byCode.set(code, team);
  }
  return rows
    .filter((r) => r.vote != null && r.realTeam && byCode.has(canonicalTeamCode(r.realTeam) ?? r.realTeam.toUpperCase()))
    .map((r) => ({
      name: r.name,
      role: (r.role as PlayerRole) ?? null,
      team: byCode.get(canonicalTeamCode(r.realTeam!) ?? r.realTeam!.toUpperCase())!,
      vote: r.vote,
      hiddenGrade: null,
      fantaVote: r.vote,
      bonuses: [],
      substitutedOut: r.isSubbedOut,
      sourcePlayerId: null,
    }));
}
