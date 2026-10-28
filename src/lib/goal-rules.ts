/**
 * Spiega quale regola di conversione (applyGoalConversionRules) ha modificato il
 * risultato delle fasce gol. Solo descrittivo: riusa le funzioni di calcolo, non le cambia.
 */
import { applyGoalConversionRules, calculateGoals } from '@/lib/scoring-engine';
import { formatVote } from '@/lib/utils';
import { roundScore } from '@/lib/vote-precision';

export type GoalRuleExplanation = {
  rule: 'a' | 'a0' | 'c' | 'd';
  text: string;
  before: [number, number];
  after: [number, number];
};

export function explainGoalConversion(
  homeName: string,
  awayName: string,
  homePoints: number,
  awayPoints: number
): GoalRuleExplanation | null {
  const hg = calculateGoals(homePoints);
  const ag = calculateGoals(awayPoints);
  const adj = applyGoalConversionRules(homePoints, awayPoints, hg, ag);
  if (adj.homeGoals === hg && adj.awayGoals === ag) return null;

  const before: [number, number] = [hg, ag];
  const after: [number, number] = [adj.homeGoals, adj.awayGoals];
  const score = `(${hg}-${ag} → ${adj.homeGoals}-${adj.awayGoals})`;
  const diff = roundScore(Math.abs(homePoints - awayPoints));
  const homeLeads = homePoints > awayPoints;
  const [lead, trail] = homeLeads ? [homeName, awayName] : [awayName, homeName];
  const [leadPts, trailPts] = homeLeads ? [homePoints, awayPoints] : [awayPoints, homePoints];
  const pts = `${formatVote(leadPts)} vs ${formatVote(trailPts)}`;

  if (hg !== ag && diff < 3) {
    if (Math.min(homePoints, awayPoints) < 66) {
      return { rule: 'a0', before, after, text: `Regola a: differenza sotto 3 (${formatVote(diff)}) e ${trail} sotto 66 → pareggio 0-0 ${score}` };
    }
    return { rule: 'a', before, after, text: `Regola a: differenza sotto 3 (${formatVote(diff)}) → ${trail} pareggia ${score}` };
  }
  if (Math.min(homePoints, awayPoints) < 59) {
    return { rule: 'c', before, after, text: `Regola c: ${trail} sotto 59, ${lead} ≥59 e +3 (${pts}) → +1 gol ${lead} ${score}` };
  }
  return { rule: 'd', before, after, text: `Regola d: pari nelle fasce ma ${lead} +4 o più (${pts}) → +1 gol ${lead} ${score}` };
}
