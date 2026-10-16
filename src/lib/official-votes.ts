/**
 * Persist fantacalcio.it grades into official_votes.
 */

import { getServerClient } from '@/lib/db/supabase';
import type { FantacalcioScrapedPlayer } from '@/lib/fantacalcio-it-client';

export async function saveFantacalcioOfficialVotes(
  roundNumber: number,
  players: readonly FantacalcioScrapedPlayer[]
): Promise<{ saved: number }> {
  const byPlayer = new Map<string, FantacalcioScrapedPlayer>();
  for (const player of players) {
    if (!player.playerId || player.vote == null) continue;
    byPlayer.set(player.playerId, player);
  }

  const rows = [...byPlayer.values()].map((player) => ({
    round_number: roundNumber,
    player_id: player.playerId,
    vote_fantacalcio: player.vote,
    fanta_vote: player.fantaVote,
    bonus_malus: player.bonuses,
    minutes_played: null,
  }));

  if (rows.length === 0) {
    return { saved: 0 };
  }

  const supabase = getServerClient();
  const { error } = await supabase.from('official_votes').upsert(rows, {
    onConflict: 'round_number,player_id',
  });

  if (error) {
    throw new Error(error.message);
  }

  return { saved: rows.length };
}
