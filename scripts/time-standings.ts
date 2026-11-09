import { getStandingsAfterRound } from '@/lib/standings-server';
import { computeRoundMatches } from '@/lib/round-matches-server';

async function time(label: string, fn: () => Promise<unknown>) {
  const t0 = performance.now();
  await fn();
  console.log(label, Math.round(performance.now() - t0) + 'ms');
}

async function main() {
  console.log('--- cold (first compute per round) ---');
  await time('computeRoundMatches(1) cold', () => computeRoundMatches(1));
  await time('computeRoundMatches(5) cold', () => computeRoundMatches(5));
  console.log('--- warm (memory cache) ---');
  await time('computeRoundMatches(1) warm', () => computeRoundMatches(1));
  await time('computeRoundMatches(5) warm', () => computeRoundMatches(5));
  console.log('--- standings (reuses round cache; 2/3/4 still cold on first) ---');
  await time('getStandingsAfterRound(1)', () => getStandingsAfterRound(1));
  await time('getStandingsAfterRound(3) cold-partial', () => getStandingsAfterRound(3));
  await time('getStandingsAfterRound(5) cold-partial', () => getStandingsAfterRound(5));
  await time('getStandingsAfterRound(5) warm', () => getStandingsAfterRound(5));
  await time('getStandingsAfterRound(3) warm', () => getStandingsAfterRound(3));
  await time('getStandingsAfterRound(1) warm', () => getStandingsAfterRound(1));
}
main();
