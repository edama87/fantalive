/**
 * Anteprima e import del file pianetafanta (lato server, admin).
 */

import { getServerClient } from '@/lib/db/supabase';
import { loadFantacalcioCatalog } from '@/lib/fantacalcio-it-client';
import {
  groupPianetafantaMatches,
  matchPianetafantaPlayers,
  parsePianetafantaRows,
  type PianetafantaMatchGroup,
} from '@/lib/pianetafanta';
import { readFirstSheet } from '@/lib/xlsx-reader';
import type { Round } from '@/types';

export const PIANETAFANTA_MAX_BYTES = 2 * 1024 * 1024;

export interface PianetafantaPreview {
  roundNumber: number;
  serieAMatchday: number;
  fileMatchday: number | null;
  matchdayMismatch: boolean;
  matches: Array<{
    key: string;
    homeTeam: string;
    awayTeam: string | null;
    players: number;
    matched: number;
    withVote: number;
    partialVotes: number;
    unmatched: Array<{ name: string; team: string; role: string | null; average: number | null }>;
    /** Giocatori abbinati che hanno già un voto consolidato (verrà riscritto). */
    alreadyConsolidated: number;
  }>;
}

async function roundFixtures(roundNumber: number): Promise<Array<{ homeTeam: string; awayTeam: string }>> {
  const { data, error } = await getServerClient()
    .from('serie_a_matches')
    .select('home_team, away_team')
    .eq('round_number', roundNumber);
  if (error) {
    console.warn('[pianetafanta] calendario non disponibile:', error.message);
    return [];
  }
  return (data ?? []).map((row) => ({ homeTeam: row.home_team as string, awayTeam: row.away_team as string }));
}

async function consolidatedIds(roundNumber: number): Promise<Set<string>> {
  const { data } = await getServerClient()
    .from('official_votes')
    .select('player_id')
    .eq('round_number', roundNumber)
    .eq('source', 'pianetafanta');
  return new Set((data ?? []).map((row) => row.player_id as string));
}

export async function analyzePianetafantaFile(
  buffer: Buffer,
  round: Round
): Promise<{ preview: PianetafantaPreview; groups: PianetafantaMatchGroup[] }> {
  const file = parsePianetafantaRows(readFirstSheet(buffer));
  if (file.players.length === 0) throw new Error('Nessun giocatore nel file');
  const [catalog, fixtures, consolidated] = await Promise.all([
    loadFantacalcioCatalog(),
    roundFixtures(round.number),
    consolidatedIds(round.number),
  ]);
  const groups = groupPianetafantaMatches(matchPianetafantaPlayers(file.players, catalog), fixtures);

  return {
    groups,
    preview: {
      roundNumber: round.number,
      serieAMatchday: round.serieAMatchday,
      fileMatchday: file.serieAMatchday,
      matchdayMismatch: file.serieAMatchday != null && file.serieAMatchday !== round.serieAMatchday,
      matches: groups.map((group) => ({
        key: group.key,
        homeTeam: group.homeTeam,
        awayTeam: group.awayTeam,
        players: group.players.length,
        matched: group.matched,
        withVote: group.players.filter((p) => p.average != null).length,
        partialVotes: group.players.filter((p) => p.voteCount > 0 && p.voteCount < 3).length,
        unmatched: group.unmatched.map((p) => ({ name: p.name, team: p.team, role: p.role, average: p.average })),
        alreadyConsolidated: group.players.filter((p) => p.playerId && consolidated.has(p.playerId)).length,
      })),
    },
  };
}
