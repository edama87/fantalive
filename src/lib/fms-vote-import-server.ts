/** Server: anteprima/conferma/annullamento import voti FMS (vedi fms-vote-import). */
import { getRoundByNumber } from '@/data/calendar';
import { getServerClient } from '@/lib/db/supabase';
import { computeRoundMatches } from '@/lib/round-matches-server';
import { getRoundTabellini } from '@/lib/quadratura-server';
import { FMS_SOURCE, buildFmsImportPreview, saveFmsVotes, undoFmsVotes, type FmsImportPreview } from '@/lib/fms-vote-import';
import type { FantasyMatchResult, PlayerMatchData } from '@/types';

async function currentRound(round: number) {
  let playerData = new Map<string, PlayerMatchData>();
  const { matches } = await computeRoundMatches(round, { transformPlayerData: (d) => (playerData = d) });
  return { matches, playerData };
}

async function importedCount(round: number): Promise<number> {
  const { count, error } = await getServerClient()
    .from('official_votes').select('player_id', { count: 'exact', head: true })
    .eq('round_number', round).eq('source', FMS_SOURCE);
  return error ? 0 : (count ?? 0);
}

export async function getFmsImportPreview(round: number, refresh = false): Promise<FmsImportPreview> {
  const { tabellini, error } = await getRoundTabellini(round, refresh);
  if (!tabellini.length) return { round, error: error ?? 'Nessun tabellino FMS', items: [], outcomes: [], imported: await importedCount(round) };
  const current = await currentRound(round);
  const computeWith = async (data: Map<string, PlayerMatchData>): Promise<FantasyMatchResult[]> =>
    (await computeRoundMatches(round, { transformPlayerData: () => data })).matches;
  return buildFmsImportPreview(round, tabellini, current, computeWith, await importedCount(round));
}

export async function confirmFmsImport(round: number, playerIds: readonly string[]) {
  const preview = await getFmsImportPreview(round);
  if (preview.error) throw new Error(preview.error);
  const wanted = new Set(playerIds);
  const items = preview.items.filter((i) => wanted.has(i.playerId));
  const { playerData } = await currentRound(round);
  const matchday = getRoundByNumber(round)?.serieAMatchday ?? round;
  return saveFmsVotes(getServerClient(), round, matchday, items, playerData);
}

export async function undoFmsImport(round: number) {
  return undoFmsVotes(getServerClient(), round);
}
