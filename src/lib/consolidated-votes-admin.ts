/**
 * Cancellazione dei voti consolidati (pianetafanta) di una partita o di un
 * giocatore: si torna ai voti fantacalcio.it (riletti subito dalla pagina voti).
 * I punteggi si ricalcolano da soli: sono calcolati alla lettura da official_votes.
 */

import { getServerClient } from '@/lib/db/supabase';
import { loadFantacalcioCatalog, scrapeFantacalcioMatchday } from '@/lib/fantacalcio-it-client';
import { saveFantacalcioOfficialVotes } from '@/lib/official-votes';
import type { PianetafantaMatchedPlayer } from '@/lib/pianetafanta';
import { averageOfVotes, paperVote } from '@/lib/vote-precision';

export interface ConsolidatedMatchSummary {
  matchKey: string;
  homeTeam: string;
  awayTeam: string | null;
  serieAMatchday: number;
  importedAt: string | null;
  players: Array<{
    playerId: string;
    name: string;
    role: string | null;
    votes: { gazzetta: number | null; corriere: number | null; tuttosport: number | null };
    average: number | null;
    /** Testate con 0 nel file salvato (bug 0 = voto, da ripulire). */
    zeroVotes: number;
  }>;
}

interface ImportRow {
  id: string;
  serie_a_matchday: number;
  match_key: string;
  home_team: string;
  away_team: string | null;
  imported_at: string | null;
  players: PianetafantaMatchedPlayer[];
}

/** Giocatori in rosa ancora consolidati di un import (puro, testabile). */
export function consolidatedPlayersOf(players: readonly PianetafantaMatchedPlayer[]): ConsolidatedMatchSummary['players'] {
  return players
    .filter((p) => p.playerId && !p.excluded)
    .map((p) => {
      const raw = [p.votes?.gazzetta, p.votes?.corriere, p.votes?.tuttosport];
      const votes = {
        gazzetta: paperVote(p.votes?.gazzetta),
        corriere: paperVote(p.votes?.corriere),
        tuttosport: paperVote(p.votes?.tuttosport),
      };
      return {
        playerId: p.playerId as string,
        name: p.matchedName ?? p.name,
        role: p.role ?? null,
        votes,
        average: averageOfVotes(Object.values(votes)),
        zeroVotes: raw.filter((v) => v === 0).length,
      };
    });
}

/** Esclude un giocatore dall'import salvato, così la riapplicazione non lo riconsolida. */
export function excludePlayer(players: readonly PianetafantaMatchedPlayer[], playerId: string): PianetafantaMatchedPlayer[] {
  return players.map((p) => (p.playerId === playerId ? { ...p, excluded: true } : p));
}

export async function listConsolidatedMatches(roundNumber: number): Promise<ConsolidatedMatchSummary[]> {
  const { data, error } = await getServerClient()
    .from('official_vote_imports')
    .select('id, serie_a_matchday, match_key, home_team, away_team, imported_at, players')
    .eq('round_number', roundNumber)
    .eq('source', 'pianetafanta')
    .order('match_key');
  if (error) throw new Error(error.message);
  return ((data ?? []) as ImportRow[]).map((row) => ({
    matchKey: row.match_key,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    serieAMatchday: row.serie_a_matchday,
    importedAt: row.imported_at,
    players: consolidatedPlayersOf(row.players ?? []),
  }));
}

export interface ClearResult {
  deleted: number;
  restoredFromFantacalcio: number;
  fantacalcioError?: string;
}

/** Cancella i voti consolidati di una partita (o di un solo giocatore) e rilegge fantacalcio.it. */
export async function clearConsolidatedVotes(
  roundNumber: number,
  matchKey: string,
  playerId?: string
): Promise<ClearResult> {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from('official_vote_imports')
    .select('id, serie_a_matchday, match_key, home_team, away_team, imported_at, players')
    .eq('round_number', roundNumber)
    .eq('source', 'pianetafanta')
    .eq('match_key', matchKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Nessun voto consolidato per questa partita');
  const row = data as ImportRow;
  const ids = playerId
    ? [playerId]
    : (row.players ?? []).filter((p) => p.playerId).map((p) => p.playerId as string);

  let deleted = 0;
  if (ids.length > 0) {
    const { data: removed, error: deleteError } = await supabase
      .from('official_votes')
      .delete()
      .eq('round_number', roundNumber)
      .eq('source', 'pianetafanta')
      .in('player_id', ids)
      .select('player_id');
    if (deleteError) throw new Error(deleteError.message);
    deleted = removed?.length ?? 0;
  }

  const { error: importError } = playerId
    ? await supabase.from('official_vote_imports').update({ players: excludePlayer(row.players ?? [], playerId) }).eq('id', row.id)
    : await supabase.from('official_vote_imports').delete().eq('id', row.id);
  if (importError) throw new Error(importError.message);

  const result: ClearResult = { deleted, restoredFromFantacalcio: 0 };
  try {
    const catalog = await loadFantacalcioCatalog();
    const scraped = await scrapeFantacalcioMatchday(row.serie_a_matchday, catalog);
    const wanted = new Set(ids);
    const saved = await saveFantacalcioOfficialVotes(
      roundNumber,
      scraped.players.filter((p) => p.playerId && wanted.has(p.playerId))
    );
    result.restoredFromFantacalcio = saved.saved;
  } catch (err) {
    result.fantacalcioError = err instanceof Error ? err.message : String(err);
  }
  return result;
}
