/**
 * Anteprima e import del file pianetafanta (lato server, admin).
 */

import { getServerClient } from '@/lib/db/supabase';
import { loadFantacalcioCatalog } from '@/lib/fantacalcio-it-client';
import {
  groupPianetafantaMatches,
  matchPianetafantaPlayers,
  parsePianetafantaRows,
  suggestRosterPlayer,
  missingOutlets,
  type PianetafantaOutlet,
  type PianetafantaMatchGroup,
} from '@/lib/pianetafanta';
import { readFirstSheet } from '@/lib/xlsx-reader';
import type { Round } from '@/types';

export const PIANETAFANTA_MAX_BYTES = 2 * 1024 * 1024;

export type PreviewVotes = { gazzetta: number | null; corriere: number | null; tuttosport: number | null };

export interface PreviewUnmatched {
  name: string;
  team: string;
  teamCode: string | null;
  role: string | null;
  average: number | null;
  votes: PreviewVotes;
  voteCount: number;
  /** Candidato in rosa con stesso cognome/iniziale/ruolo in un altro club (da confermare). */
  suggestion: { id: string; name: string } | null;
}

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
    /** Testate non ancora pubblicate per la partita (voti incompleti). */
    missingOutlets: PianetafantaOutlet[];
    unmatched: PreviewUnmatched[];
    /** Giocatori con voto solo da 1 o 2 testate su 3. */
    partial: Array<{ name: string; role: string | null; votes: PreviewVotes; average: number | null; inRosa: boolean }>;
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
      matches: groups.map((group) => {
        const missing = missingOutlets(group.players);
        const expected = 3 - missing.length;
        const isPartial = (p: (typeof group.players)[number]) => {
          const got = (['gazzetta', 'corriere', 'tuttosport'] as const).filter(
            (o) => !missing.includes(o) && p.votes[o] != null
          ).length;
          return got > 0 && got < expected;
        };
        return {
        key: group.key,
        homeTeam: group.homeTeam,
        awayTeam: group.awayTeam,
        players: group.players.length,
        matched: group.matched,
        withVote: group.players.filter((p) => p.average != null).length,
        missingOutlets: missing,
        partialVotes: group.players.filter(isPartial).length,
        unmatched: group.unmatched.map((p) => {
          const hit = suggestRosterPlayer(p, catalog.players);
          return {
            name: p.name,
            team: p.team,
            teamCode: p.teamCode,
            role: p.role,
            average: p.average,
            votes: p.votes,
            voteCount: p.voteCount,
            suggestion: hit ? { id: hit.playerId, name: hit.playerName } : null,
          };
        }),
        partial: group.players
          .filter(isPartial)
          .map((p) => ({ name: p.name, role: p.role, votes: p.votes, average: p.average, inRosa: p.playerId != null })),
        alreadyConsolidated: group.players.filter((p) => p.playerId && consolidated.has(p.playerId)).length,
        };
      }),
    },
  };
}
