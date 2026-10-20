/* Dry run: quanti non abbinati negli import pianetafanta si abbinano col matcher attuale. */
import { getPublicClient } from '@/lib/db/supabase';
import { loadFantacalcioCatalog } from '@/lib/fantacalcio-it-client';
import { matchFantacalcioPlayer } from '@/lib/fantacalcio-it';
(async () => {
  const round = Number(process.argv[2] ?? 1);
  const catalog = await loadFantacalcioCatalog();
  const { data } = await getPublicClient().from('official_vote_imports').select('match_key, players').eq('round_number', round);
  let total = 0, newly = 0, changed = 0;
  for (const imp of data ?? []) for (const p of imp.players as Array<{ name: string; team: string; role: string | null; playerId: string | null }>) {
    const hit = matchFantacalcioPlayer(p.name, catalog.players, catalog.aliases, { realTeam: p.team, role: (p.role as never) ?? undefined });
    if (!p.playerId) { total++; if (hit) { newly++; console.log('NEW', imp.match_key, p.name, '->', hit.playerName, hit.confidence); } }
    else if (hit?.playerId !== p.playerId) { changed++; console.log('CHANGED', imp.match_key, p.name, p.playerId, '->', hit?.playerId); }
  }
  console.log({ unmatchedBefore: total, newlyMatched: newly, changed });
})();
