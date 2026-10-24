import type { PlayerScore } from '@/types';

/**
 * Lista panchina: i non entrati più chi è entrato al posto di un titolare,
 * nell'ordine originale della panchina (chi è entrato resta al suo posto).
 */
export function benchList(playerScores: PlayerScore[]): PlayerScore[] {
  return playerScores
    .filter((ps) => ps.isUnusedBench || (!ps.isStarter && (ps.status === 'to_play' || ps.substitutedFor != null)))
    .map((ps, index) => ({ ps, index }))
    .sort((a, b) => (a.ps.benchPosition ?? Infinity) - (b.ps.benchPosition ?? Infinity) || a.index - b.index)
    .map(({ ps }) => ps);
}
