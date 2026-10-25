/**
 * Riapplica i voti di una giornata con il matcher e gli alias attuali, senza
 * ricaricare file: usato dopo il salvataggio di un alias in Admin e per
 * correggere giornate già importate.
 *
 * - pianetafanta: rilegge i giocatori salvati in official_vote_imports, li
 *   riabbina e riscrive le righe consolidate (nuovo consolidated_at, quindi il
 *   trigger di protezione le accetta: è un import pianetafanta).
 * - fantacalcio.it: rilegge le pagine voti della giornata e salva solo i
 *   giocatori senza voto consolidato (saveFantacalcioOfficialVotes).
 */

import { getServerClient } from '@/lib/db/supabase';
import { loadFantacalcioCatalog, scrapeFantacalcioMatchday } from '@/lib/fantacalcio-it-client';
import { matchFantacalcioPlayer, type FantacalcioAlias, type FantacalcioCatalogPlayer } from '@/lib/fantacalcio-it';
import type { PianetafantaMatchGroup, PianetafantaMatchedPlayer } from '@/lib/pianetafanta';
import { saveFantacalcioOfficialVotes, savePianetafantaVotes } from '@/lib/official-votes';
import { averageOfVotes, paperVote } from '@/lib/vote-precision';
import type { PlayerRole } from '@/types';

interface StoredImport {
  serie_a_matchday: number;
  match_key: string;
  home_team: string;
  away_team: string | null;
  players: PianetafantaMatchedPlayer[];
}

type Catalog = { players: readonly FantacalcioCatalogPlayer[]; aliases: readonly FantacalcioAlias[] };

/** Riabbina i giocatori di un import salvato (puro, testabile). */
export function rematchStoredImport(stored: StoredImport, catalog: Catalog): PianetafantaMatchGroup {
  const players = stored.players.map((stale) => {
    // import salvati prima della correzione: 0 = testata senza voto
    const votes = {
      gazzetta: paperVote(stale.votes?.gazzetta),
      corriere: paperVote(stale.votes?.corriere),
      tuttosport: paperVote(stale.votes?.tuttosport),
    };
    const player = { ...stale, votes, voteCount: Object.values(votes).filter((v) => v != null).length };
    if (player.excluded) {
      return { ...player, average: averageOfVotes(Object.values(votes)), playerId: null, matchedName: null };
    }
    const hit = matchFantacalcioPlayer(player.name, catalog.players, catalog.aliases, {
      role: (player.role as PlayerRole | null) ?? undefined,
      realTeam: player.team,
    });
    return {
      ...player,
      // media ricalcolata a 3 decimali dai voti di testata
      average: averageOfVotes(Object.values(votes)),
      playerId: hit?.playerId ?? null,
      matchedName: hit?.playerName ?? null,
    };
  });
  const unmatched = players.filter((player) => !player.playerId && !player.excluded);
  return {
    key: stored.match_key,
    homeTeam: stored.home_team,
    awayTeam: stored.away_team,
    players,
    matched: players.filter((player) => player.playerId).length,
    unmatched,
  };
}

export interface ReapplyResult {
  pianetafanta: { matches: number; saved: number; newlyMatched: number; unmatched: number };
  fantacalcio: { saved: number; skippedConsolidated: number; error?: string } | null;
}

export async function reapplyRoundVotes(
  roundNumber: number,
  options: { fantacalcio?: boolean; serieAMatchday?: number } = {}
): Promise<ReapplyResult> {
  const supabase = getServerClient();
  const catalog = await loadFantacalcioCatalog();
  const { data, error } = await supabase
    .from('official_vote_imports')
    .select('serie_a_matchday, match_key, home_team, away_team, players')
    .eq('round_number', roundNumber)
    .eq('source', 'pianetafanta');
  if (error) throw new Error(`official_vote_imports: ${error.message}`);

  const stored = (data ?? []) as StoredImport[];
  const result: ReapplyResult = {
    pianetafanta: { matches: stored.length, saved: 0, newlyMatched: 0, unmatched: 0 },
    fantacalcio: null,
  };
  const byMatchday = new Map<number, PianetafantaMatchGroup[]>();
  for (const item of stored) {
    const group = rematchStoredImport(item, catalog);
    const before = item.players.filter((p) => p.playerId).length;
    result.pianetafanta.newlyMatched += Math.max(0, group.matched - before);
    result.pianetafanta.unmatched += group.unmatched.length;
    const list = byMatchday.get(item.serie_a_matchday) ?? [];
    list.push(group);
    byMatchday.set(item.serie_a_matchday, list);
  }
  for (const [matchday, groups] of byMatchday) {
    const saved = await savePianetafantaVotes(roundNumber, matchday, groups);
    result.pianetafanta.saved += saved.saved;
  }

  const matchday = options.serieAMatchday ?? stored[0]?.serie_a_matchday;
  if (options.fantacalcio !== false && matchday != null) {
    try {
      const scraped = await scrapeFantacalcioMatchday(matchday, catalog);
      result.fantacalcio = await saveFantacalcioOfficialVotes(roundNumber, scraped.players);
    } catch (err) {
      result.fantacalcio = { saved: 0, skippedConsolidated: 0, error: err instanceof Error ? err.message : String(err) };
    }
  }
  return result;
}
