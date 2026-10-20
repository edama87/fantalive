/* Riapplica i voti di una giornata (pianetafanta salvato + fantacalcio.it). Uso: npx tsx scripts/reapply-round.ts 1 */
import { reapplyRoundVotes } from '@/lib/vote-reapply';
import { getRoundByNumber } from '@/data/calendar';
(async () => {
  const round = Number(process.argv[2]);
  const r = getRoundByNumber(round);
  if (!r) throw new Error('giornata non valida');
  console.log(JSON.stringify(await reapplyRoundVotes(round, { serieAMatchday: r.serieAMatchday })));
})();
