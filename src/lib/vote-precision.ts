/**
 * Precisione dei calcoli come FMS Revo: medie voto e totali a 3 decimali
 * (7,5 + 7 + 7,5 = 22 / 3 = 7,333), mostrati così da formatVote; soglie gol e modificatori usano questi valori pieni.
 */

export const VOTE_DECIMALS = 3;

export function roundScore(value: number): number {
  const factor = 10 ** VOTE_DECIMALS;
  // + EPSILON: 6,6665 non deve diventare 6,666 per l'errore dei float.
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Troncamento a 3 decimali (6,6666 -> 6,666): FMS Revo tronca le medie voto,
 * verificato sulla giornata 1 (DC-AP 84,497-57,496 = 3 e 4 medie in "terzi").
 */
export function truncateScore(value: number): number {
  const factor = 10 ** VOTE_DECIMALS;
  // Margine per l'errore dei float: 6,5 * 1000 = 6499,9999... non deve scendere.
  return Math.floor(value * factor + 1e-6) / factor;
}

/**
 * Voto di testata reale o null: 0, negativo, oltre 10 o non numerico = senza voto
 * (pianetafanta esporta 0 quando una testata non ha votato).
 */
export function paperVote(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10 ? value : null;
}

/**
 * Voto consolidato con Gazzetta master (regola di lega, come FMS): se la
 * Gazzetta ha pubblicato i voti della partita ma il giocatore è s.v. per la
 * Gazzetta, è senza voto (non ha giocato: scatta la sostituzione), anche se
 * Corriere/Tuttosport lo votano. Se la Gazzetta manca per tutta la partita si
 * usa la media delle testate disponibili.
 */
export function masterVote(
  votes: { gazzetta?: number | null; corriere?: number | null; tuttosport?: number | null },
  gazzettaPublished: boolean
): number | null {
  if (gazzettaPublished && paperVote(votes.gazzetta) == null) return null;
  return averageOfVotes([votes.gazzetta, votes.corriere, votes.tuttosport]);
}

/** Media dei voti di testata disponibili (Gazzetta, Corriere, Tuttosport), troncata a 3 decimali. */
export function averageOfVotes(votes: readonly (number | null | undefined)[]): number | null {
  const present = votes.map(paperVote).filter((vote): vote is number => vote != null);
  if (present.length === 0) return null;
  return truncateScore(present.reduce((sum, vote) => sum + vote, 0) / present.length);
}
