/**
 * Precisione dei calcoli come FMS Revo: medie voto e totali a 3 decimali
 * (7,5 + 7 + 7,5 = 22 / 3 = 7,333). La visualizzazione resta a 2 decimali
 * (formatVote); soglie gol e modificatori usano questi valori pieni.
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

/** Media dei voti di testata disponibili (Gazzetta, Corriere, Tuttosport), troncata a 3 decimali. */
export function averageOfVotes(votes: readonly (number | null | undefined)[]): number | null {
  const present = votes.filter((vote): vote is number => typeof vote === 'number' && Number.isFinite(vote));
  if (present.length === 0) return null;
  return truncateScore(present.reduce((sum, vote) => sum + vote, 0) / present.length);
}
