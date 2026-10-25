import type { PlayerScore } from '@/types';
import { isPlayerMuted } from '@/lib/bonus-summary';

/** Voto definitivo (pianetafanta: Gazzetta/Corriere/Tuttosport). */
export function isConsolidatedVote(score: Pick<PlayerScore, 'voteSource'>): boolean {
  return score.voteSource === 'consolidated';
}

/** Ha un voto da mostrare ma non ancora consolidato (stima live o fantacalcio.it). */
export function isEstimatedVote(score: Pick<PlayerScore, 'voteSource' | 'baseVote'>): boolean {
  return score.baseVote > 0 && score.voteSource !== 'consolidated';
}

/** Voti che contano nel totale, divisi tra consolidati e stimati. */
export function voteSourceCounts(scores: readonly PlayerScore[]): {
  consolidated: number;
  /** Consolidati con tutte e 3 le testate. */
  consolidatedFull: number;
  estimated: number;
} {
  let consolidated = 0;
  let consolidatedFull = 0;
  let estimated = 0;
  for (const score of scores) {
    if (score.isUnusedBench || isPlayerMuted(score) || score.status === 'to_play') continue;
    if (isConsolidatedVote(score)) {
      consolidated += 1;
      if (score.paperCount === 3) consolidatedFull += 1;
    }
    else if (score.baseVote > 0) estimated += 1;
  }
  return { consolidated, consolidatedFull, estimated };
}
