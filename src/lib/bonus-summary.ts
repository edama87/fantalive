import type { BonusBreakdown, PlayerScore } from '@/types';

/**
 * In grigio: s.v. (titolare senza voto a partita finita, riserva d'ufficio) e
 * panchinari che di sicuro non possono più entrare. "Da giocare" resta normale.
 */
export function isPlayerMuted(playerScore: PlayerScore): boolean {
  return playerScore.status === 'sv' || playerScore.isCertainlyOut === true;
}

export function emptyBonuses(): BonusBreakdown {
  return {
    goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
    assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0,
  };
}

export function sumBonuses(scores: ReadonlyArray<{ bonuses: BonusBreakdown }>): BonusBreakdown {
  const acc = emptyBonuses();
  for (const { bonuses } of scores) {
    for (const key of Object.keys(acc) as Array<keyof BonusBreakdown>) acc[key] += bonuses[key] ?? 0;
  }
  return acc;
}

/**
 * Riepilogo eventi di una squadra: quelli che contano (giocatori in campo non
 * in grigio) e quelli che non contano (giocatori in grigio e panchinari non
 * entrati), mostrati dopo tra parentesi.
 */
export function splitBonusSummary(scores: readonly PlayerScore[]): {
  counted: BonusBreakdown;
  excluded: BonusBreakdown;
} {
  const counted = scores.filter((s) => !s.isUnusedBench && !isPlayerMuted(s));
  const excluded = scores.filter((s) => s.isUnusedBench || isPlayerMuted(s));
  return { counted: sumBonuses(counted), excluded: sumBonuses(excluded) };
}
