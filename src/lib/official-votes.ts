/**
 * Persistenza dei voti in official_votes.
 * - fantacalcio.it (scraping): voto provvisorio, source 'fantacalcio'.
 * - pianetafanta (Excel caricato dall'admin): voti di testata consolidati,
 *   source 'pianetafanta'. Hanno la precedenza: lo scraping non li tocca più.
 */

import { getServerClient } from '@/lib/db/supabase';
import type { FantacalcioScrapedPlayer } from '@/lib/fantacalcio-it-client';
import { fantavotoFromVote } from '@/lib/fantacalcio-it';
import { averageOfVotes, paperVote } from '@/lib/vote-precision';
import {
  PIANETAFANTA_SOURCE,
  type PianetafantaMatchGroup,
  type PianetafantaMatchedPlayer,
} from '@/lib/pianetafanta';

async function consolidatedPlayerIds(roundNumber: number): Promise<Set<string>> {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from('official_votes')
    .select('player_id')
    .eq('round_number', roundNumber)
    .eq('source', PIANETAFANTA_SOURCE);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.player_id as string));
}

export async function saveFantacalcioOfficialVotes(
  roundNumber: number,
  players: readonly FantacalcioScrapedPlayer[]
): Promise<{ saved: number; skippedConsolidated: number }> {
  const byPlayer = new Map<string, FantacalcioScrapedPlayer>();
  for (const player of players) {
    if (!player.playerId) continue;
    const graded = player.vote != null && player.vote > 0 && player.vote <= 10; // fuori scala = senza voto
    // s.v. di chi è sceso in campo (subentrato o 55 = s.v. della fonte): si salva
    // con voto null, così sostituisce la stima ESPN e un eventuale voto rimasto.
    const enteredSv = !graded && (player.noGrade === true || player.substitution?.in != null);
    if (!graded && !enteredSv) continue;
    byPlayer.set(player.playerId, graded ? player : { ...player, vote: null, fantaVote: null });
  }

  // I voti consolidati (pianetafanta) non vengono sovrascritti dallo scraping.
  const consolidated = byPlayer.size > 0 ? await consolidatedPlayerIds(roundNumber) : new Set<string>();
  const rows = [...byPlayer.values()]
    .filter((player) => !consolidated.has(player.playerId as string))
    .map((player) => ({
      round_number: roundNumber,
      player_id: player.playerId,
      vote_fantacalcio: player.vote,
      fanta_vote: player.fantaVote,
      bonus_malus: player.bonuses,
    }));
  const skippedConsolidated = byPlayer.size - rows.length;

  if (rows.length === 0) {
    return { saved: 0, skippedConsolidated };
  }

  const supabase = getServerClient();
  const { error } = await supabase.from('official_votes').upsert(rows, {
    onConflict: 'round_number,player_id',
  });

  if (error) {
    throw new Error(error.message);
  }

  return { saved: rows.length, skippedConsolidated };
}

/** bonus_malus della riga: bonus pianetafanta più i cambi (minuto). */
function pianetafantaBonusMalus(player: PianetafantaMatchedPlayer) {
  const items: Array<{ type: string; label: string; count: number; minute: number | null }> =
    player.bonuses.map((bonus) => ({ ...bonus }));
  if (player.subIn != null) items.push({ type: 'substitution_in', label: 'Entrato', count: 1, minute: player.subIn });
  if (player.subOut != null) {
    items.push({ type: 'substitution_out', label: 'Uscito', count: 1, minute: player.subOut });
  }
  return items;
}

function rowAverage(player: PianetafantaMatchedPlayer): number | null {
  return averageOfVotes([player.votes.gazzetta, player.votes.corriere, player.votes.tuttosport]);
}

export function pianetafantaVoteRow(roundNumber: number, player: PianetafantaMatchedPlayer, now: string) {
  return {
    round_number: roundNumber,
    player_id: player.playerId,
    source: PIANETAFANTA_SOURCE,
    consolidated_at: now,
    vote_gazzetta: paperVote(player.votes.gazzetta),
    vote_corriere: paperVote(player.votes.corriere),
    vote_tuttosport: paperVote(player.votes.tuttosport),
    // Il consolidato sostituisce lo scraping: un s.v. (nessun voto di testata) non
    // deve ereditare il voto fantacalcio.it della riga live (es. 6 per 11').
    vote_fantacalcio: null,
    minutes_played: player.minutesPlayed,
    fanta_vote: rowAverage(player) == null ? null : fantavotoFromVote(rowAverage(player) as number, player.bonuses),
    bonus_malus: pianetafantaBonusMalus(player),
  };
}

export interface PianetafantaImportResult {
  saved: number;
  matches: Array<{ key: string; saved: number; unmatched: number }>;
}

/**
 * Scrive i voti delle partite scelte: una riga official_votes per giocatore
 * abbinato (anche s.v.: il consolidato dice che non ha voto) e la traccia
 * completa in official_vote_imports.
 */
export async function savePianetafantaVotes(
  roundNumber: number,
  serieAMatchday: number,
  groups: readonly PianetafantaMatchGroup[]
): Promise<PianetafantaImportResult> {
  const supabase = getServerClient();
  const now = new Date().toISOString();
  const result: PianetafantaImportResult = { saved: 0, matches: [] };

  for (const group of groups) {
    const byPlayer = new Map<string, PianetafantaMatchedPlayer>();
    for (const player of group.players) if (player.playerId) byPlayer.set(player.playerId, player);
    const rows = [...byPlayer.values()].map((player) => pianetafantaVoteRow(roundNumber, player, now));

    if (rows.length > 0) {
      const { error } = await supabase.from('official_votes').upsert(rows, { onConflict: 'round_number,player_id' });
      if (error) throw new Error(`official_votes ${group.key}: ${error.message}`);
    }

    const { error: importError } = await supabase.from('official_vote_imports').upsert(
      {
        round_number: roundNumber,
        serie_a_matchday: serieAMatchday,
        source: PIANETAFANTA_SOURCE,
        match_key: group.key,
        home_team: group.homeTeam,
        away_team: group.awayTeam,
        players: group.players,
        matched_count: group.matched,
        unmatched_count: group.unmatched.length,
        imported_at: now,
      },
      { onConflict: 'round_number,source,match_key' }
    );
    if (importError) throw new Error(`official_vote_imports ${group.key}: ${importError.message}`);

    result.saved += rows.length;
    result.matches.push({ key: group.key, saved: rows.length, unmatched: group.unmatched.length });
  }
  return result;
}
