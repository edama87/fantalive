/**
 * Commenti qualitativi di fine sfida — solo server (service role + seed file).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  type MatchComment,
  type MatchCommentPayload,
  matchCommentPayloadSchema,
  analysisParagraphs,
} from './match-comments-shared';

export type { MatchComment, MatchCommentPayload };
export { matchCommentPayloadSchema, analysisParagraphs };

type Row = {
  id: string;
  round_number: number;
  home_team_id: string;
  away_team_id: string;
  analysis: string;
  ironic_note: string;
  updated_at: string;
};

function fromRow(row: Row): MatchComment {
  return {
    id: row.id,
    round: row.round_number,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    analysis: row.analysis,
    ironicNote: row.ironic_note,
    updatedAt: row.updated_at,
    source: 'db',
  };
}

function seedPath(): string {
  return path.join(process.cwd(), 'data', 'match-comments-g5.json');
}

export function loadSeedComments(): MatchComment[] {
  const file = seedPath();
  if (!existsSync(file)) return [];
  const raw = JSON.parse(readFileSync(file, 'utf8')) as {
    comments?: Array<{
      round: number;
      homeTeamId: string;
      awayTeamId: string;
      analysis: string;
      ironicNote: string;
    }>;
  };
  return (raw.comments ?? []).map((c) => ({
    id: null,
    round: c.round,
    homeTeamId: c.homeTeamId,
    awayTeamId: c.awayTeamId,
    analysis: c.analysis,
    ironicNote: c.ironicNote,
    updatedAt: null,
    source: 'seed' as const,
  }));
}

export function findSeedComment(round: number, homeTeamId: string, awayTeamId: string): MatchComment | null {
  return (
    loadSeedComments().find(
      (c) => c.round === round && c.homeTeamId === homeTeamId && c.awayTeamId === awayTeamId,
    ) ?? null
  );
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /could not find the table/i.test(msg) ||
    (/does not exist|relation/i.test(msg) && /(match_comments|round_articles)/i.test(msg))
  );
}

export async function getMatchComment(
  sb: SupabaseClient,
  round: number,
  homeTeamId: string,
  awayTeamId: string,
  opts?: { allowSeedFallback?: boolean },
): Promise<MatchComment | null> {
  const { data, error } = await sb
    .from('match_comments')
    .select('id, round_number, home_team_id, away_team_id, analysis, ironic_note, updated_at')
    .eq('round_number', round)
    .eq('home_team_id', homeTeamId)
    .eq('away_team_id', awayTeamId)
    .maybeSingle();

  if (error) {
    if (opts?.allowSeedFallback !== false && isMissingTable(error)) {
      return findSeedComment(round, homeTeamId, awayTeamId);
    }
    throw new Error(error.message);
  }
  if (data) return fromRow(data as Row);
  if (opts?.allowSeedFallback) return findSeedComment(round, homeTeamId, awayTeamId);
  return null;
}

export async function listMatchComments(
  sb: SupabaseClient,
  round: number,
  opts?: { allowSeedFallback?: boolean },
): Promise<MatchComment[]> {
  const { data, error } = await sb
    .from('match_comments')
    .select('id, round_number, home_team_id, away_team_id, analysis, ironic_note, updated_at')
    .eq('round_number', round)
    .order('home_team_id');

  if (error) {
    if (opts?.allowSeedFallback !== false && isMissingTable(error)) {
      return loadSeedComments().filter((c) => c.round === round);
    }
    throw new Error(error.message);
  }
  const rows = (data as Row[] | null) ?? [];
  if (rows.length === 0 && opts?.allowSeedFallback) {
    return loadSeedComments().filter((c) => c.round === round);
  }
  return rows.map(fromRow);
}

export async function upsertMatchComment(
  sb: SupabaseClient,
  payload: MatchCommentPayload,
): Promise<MatchComment> {
  if (payload.homeTeamId === payload.awayTeamId) {
    throw new Error('Casa e trasferta devono essere squadre diverse');
  }
  const row = {
    round_number: payload.round,
    home_team_id: payload.homeTeamId,
    away_team_id: payload.awayTeamId,
    analysis: payload.analysis.trim(),
    ironic_note: payload.ironicNote.trim(),
  };
  const { data, error } = await sb
    .from('match_comments')
    .upsert(row, { onConflict: 'round_number,home_team_id,away_team_id' })
    .select('id, round_number, home_team_id, away_team_id, analysis, ironic_note, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data as Row);
}
