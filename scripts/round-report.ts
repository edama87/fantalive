/* Diagnostica: ricalcola una giornata con dati DB e stampa totali/dettagli. Uso: npx tsx scripts/round-report.ts 1 [teamId] */
import { getRoundPlayerState } from '@/lib/round-player-data';
import { fetchLineupsForRound, fetchPlayersByIds, playerIdsFromLineups, createLineupProviderFromMap } from '@/lib/lineups-db';
import { calculateAllMatches } from '@/lib/live-data';
import { teamStatusesFromFixtures } from '@/lib/serie-a-fixtures';

(async () => {
  const round = Number(process.argv[2] ?? 1);
  const focus = process.argv[3];
  const state = await getRoundPlayerState(round);
  const lineups = await fetchLineupsForRound(round);
  const players = await fetchPlayersByIds(playerIdsFromLineups(lineups));
  const matches = calculateAllMatches(round, state.playerData, undefined, createLineupProviderFromMap(lineups), players, state.fixtures.length ? teamStatusesFromFixtures(state.fixtures) : undefined);
  for (const m of matches) {
    console.log(`${m.homeTeamId}-${m.awayTeamId} ${m.homeGoals}-${m.awayGoals} (${m.homeTotal.toFixed(3)}-${m.awayTotal.toFixed(3)}) mods H ${JSON.stringify({d: m.homeModifiers.defenseModifier, c: m.homeModifiers.midfieldModifier, a: m.homeModifiers.attackModifier})} A ${JSON.stringify({d: m.awayModifiers.defenseModifier, c: m.awayModifiers.midfieldModifier, a: m.awayModifiers.attackModifier})}`);
    for (const side of ['home', 'away'] as const) {
      const id = side === 'home' ? m.homeTeamId : m.awayTeamId;
      if (focus && focus !== id && focus !== 'all') continue;
      const scores = side === 'home' ? m.homePlayerScores : m.awayPlayerScores;
      for (const s of scores) console.log(`   ${id} ${s.isUnusedBench ? 'bench' : 'XI   '} ${s.player.role} ${s.player.name.padEnd(28)} v=${s.baseVote} fv=${s.fantavoto} ${s.status} src=${s.voteSource ?? '-'}`);
      const mid = m.homeModifiers.details?.midfield;
      if (mid) console.log('   mid', side, JSON.stringify(side === 'home' ? mid.homeInputs : mid.awayInputs));
    }
  }
})();
