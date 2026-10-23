import type { PlayerScore } from '@/types';

/**
 * "In campo N/11": solo gli 11 che contano per la squadra fantacalcio
 * (titolari o subentrati dalla panchina al loro posto) il cui giocatore è
 * in campo adesso. I panchinari non utilizzati, mostrati solo per
 * visualizzazione, non contano anche se stanno giocando nella realtà.
 */
export function countOnPitch(scores: readonly PlayerScore[]): number {
  return scores.filter((s) => !s.isUnusedBench && s.status === 'playing').length;
}
