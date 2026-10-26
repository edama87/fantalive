/**
 * Caricamento dati e salvataggio del debrief (tabella public.lineup_debriefs,
 * migrazione 20261026120000_lineup_debriefs.sql). Se la tabella non esiste
 * ancora il debrief viene calcolato e mostrato ma non salvato.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Player, PlayerRole } from '@/types';
import { getRoundByNumber } from '@/data/calendar';
import { fetchLineupsForRound, fetchPlayersByIds, lineupKey } from '@/lib/lineups-db';
import { generateDefaultLineup } from '@/lib/lineup-utils';
import { getRoundPlayerState } from '@/lib/round-player-data';
import { teamStatusesFromFixtures } from '@/lib/serie-a-fixtures';
import { buildDebrief, type LineupDebrief } from '@/lib/lineup-debrief';
import type { LineupSuggestion } from '@/lib/lineup-suggestions';

const TABLE = 'lineup_debriefs';

/** Tabella assente (migrazione non applicata). */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /lineup_debriefs/.test(error.message ?? '') && /not find|does not exist/i.test(error.message ?? '');
}

async function loadRoster(sb: SupabaseClient, teamId: string, roundStart: string | null): Promise<string[]> {
  const { data: versions, error } = await sb
    .from('roster_versions')
    .select('id, effective_from, effective_until, version_number')
    .eq('team_id', teamId)
    .order('version_number', { ascending: false });
  if (error) throw new Error(`roster_versions: ${error.message}`);
  const at = roundStart ? Date.parse(roundStart) : Date.now();
  const covering = (versions ?? []).find(
    (v) => (!v.effective_from || Date.parse(v.effective_from) <= at) && (!v.effective_until || Date.parse(v.effective_until) > at),
  );
  const version = covering ?? versions?.[0];
  if (!version) return [];
  const { data, error: rpError } = await sb.from('roster_players').select('player_id').eq('roster_version_id', version.id);
  if (rpError) throw new Error(`roster_players: ${rpError.message}`);
  return (data ?? []).map((r) => r.player_id as string);
}

export async function computeDebrief(sb: SupabaseClient, suggestion: LineupSuggestion): Promise<LineupDebrief> {
  const round = suggestion.round;
  const pairing = getRoundByNumber(round)?.pairings.find(
    (p) => p.homeTeamId === suggestion.teamId || p.awayTeamId === suggestion.teamId,
  );
  if (!pairing) throw new Error(`Nessuna sfida per ${suggestion.teamId} alla giornata ${round}`);
  const isHome = pairing.homeTeamId === suggestion.teamId;
  const opponentTeamId = isHome ? pairing.awayTeamId : pairing.homeTeamId;

  const [state, lineups] = await Promise.all([getRoundPlayerState(round), fetchLineupsForRound(round)]);
  const kickoffs = state.fixtures.map((f) => f.kickoffTime).filter((k): k is string => !!k).sort();
  const rosterIds = await loadRoster(sb, suggestion.teamId, kickoffs[0] ?? null);

  const actualLineup = lineups[lineupKey(suggestion.teamId, round)] ?? null;
  const opponentLineup = lineups[lineupKey(opponentTeamId, round)] ?? generateDefaultLineup(opponentTeamId, round);
  const suggestedIds = [...suggestion.starters, ...suggestion.bench].map((p) => p.playerId).filter((id): id is string => !!id);
  const allIds = [
    ...rosterIds,
    ...suggestedIds,
    ...[actualLineup, opponentLineup].flatMap((l) => (l ? [...l.starters, ...l.bench].map((s) => s.playerId) : [])),
  ];
  const players = await fetchPlayersByIds(allIds);
  const roster = [...new Set([...rosterIds, ...suggestedIds])]
    .map((id) => players[id])
    .filter((p): p is Player => !!p && (['P', 'D', 'C', 'A'] as PlayerRole[]).includes(p.role));

  return buildDebrief({
    suggestion,
    round,
    isHome,
    opponentTeamId,
    actualLineup,
    opponentLineup,
    roster,
    players,
    playerData: state.playerData,
    teamStatuses: state.fixtures.length ? teamStatusesFromFixtures(state.fixtures) : undefined,
    unfinishedFixtures: state.fixtures.filter((f) => f.status !== 'finished').map((f) => `${f.homeTeam}-${f.awayTeam}`),
  });
}

export const MAX_NOTES_LENGTH = 4000;

/** Note dell'admin già salvate per il suggerimento (null se assenti o tabella mancante). */
async function existingNotes(sb: SupabaseClient, suggestionId: string): Promise<LineupDebrief['notes']> {
  const { data, error } = await sb.from(TABLE).select('payload').eq('suggestion_id', suggestionId).maybeSingle();
  if (error) return null;
  return (data?.payload as LineupDebrief | undefined)?.notes ?? null;
}

export async function saveDebrief(sb: SupabaseClient, debrief: LineupDebrief): Promise<{ saved: boolean; reason?: string }> {
  // Rigenera: le note dell'admin restano.
  debrief.notes = debrief.notes ?? (await existingNotes(sb, debrief.suggestionId));
  const { error } = await sb.from(TABLE).upsert(
    {
      suggestion_id: debrief.suggestionId,
      team_id: debrief.teamId,
      round_number: debrief.round,
      consolidated: debrief.consolidated,
      payload: debrief,
      generated_at: debrief.generatedAt,
    },
    { onConflict: 'suggestion_id' },
  );
  if (!error) return { saved: true };
  if (isMissingTableError(error)) return { saved: false, reason: 'Tabella lineup_debriefs non ancora creata: debrief non salvato' };
  throw new Error(error.message);
}

/** Debrief salvati per gli id dei suggerimenti (mappa vuota se la tabella manca). */
export async function loadDebriefs(sb: SupabaseClient, suggestionIds: string[]): Promise<Map<string, LineupDebrief>> {
  const map = new Map<string, LineupDebrief>();
  if (!suggestionIds.length) return map;
  const { data, error } = await sb.from(TABLE).select('suggestion_id, payload').in('suggestion_id', suggestionIds);
  if (error) {
    if (isMissingTableError(error)) return map;
    throw new Error(error.message);
  }
  for (const row of data ?? []) map.set(row.suggestion_id as string, row.payload as LineupDebrief);
  return map;
}

/** Aggiorna solo le note dell'admin dentro il payload del debrief salvato. */
export async function saveDebriefNotes(
  sb: SupabaseClient,
  suggestionId: string,
  text: string,
  now: Date = new Date(),
): Promise<LineupDebrief | null> {
  const { data, error } = await sb.from(TABLE).select('payload').eq('suggestion_id', suggestionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const trimmed = text.trim().slice(0, MAX_NOTES_LENGTH);
  const payload: LineupDebrief = {
    ...(data.payload as LineupDebrief),
    notes: trimmed ? { text: trimmed, updatedAt: now.toISOString() } : null,
  };
  const { error: upError } = await sb.from(TABLE).update({ payload }).eq('suggestion_id', suggestionId);
  if (upError) throw new Error(upError.message);
  return payload;
}
