/** Articoli di giornata — solo server. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MASTHEAD_NAME,
  articleParagraphs,
  roundArticlePayloadSchema,
  type RoundArticle,
  type RoundArticlePayload,
} from './round-articles-shared';

export type { RoundArticle, RoundArticlePayload };
export { MASTHEAD_NAME, articleParagraphs, roundArticlePayloadSchema };

type Row = {
  id: string;
  round_number: number;
  headline: string;
  subtitle: string | null;
  body: string;
  updated_at: string;
};

function fromRow(row: Row): RoundArticle {
  return {
    id: row.id,
    round: row.round_number,
    headline: row.headline,
    subtitle: row.subtitle,
    body: row.body,
    updatedAt: row.updated_at,
    source: 'db',
  };
}

function seedFile(): string {
  return path.join(process.cwd(), 'data', 'match-comments-g5.json');
}

export function loadSeedArticle(round: number): RoundArticle | null {
  const file = seedFile();
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, 'utf8')) as {
    article?: { round: number; headline: string; subtitle?: string | null; body: string };
  };
  const a = raw.article;
  if (!a || a.round !== round) return null;
  return {
    id: null,
    round: a.round,
    headline: a.headline,
    subtitle: a.subtitle ?? null,
    body: a.body,
    updatedAt: null,
    source: 'seed',
  };
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

export async function getRoundArticle(
  sb: SupabaseClient,
  round: number,
  opts?: { allowSeedFallback?: boolean },
): Promise<RoundArticle | null> {
  const { data, error } = await sb
    .from('round_articles')
    .select('id, round_number, headline, subtitle, body, updated_at')
    .eq('round_number', round)
    .maybeSingle();
  if (error) {
    if (opts?.allowSeedFallback !== false && isMissingTable(error)) return loadSeedArticle(round);
    throw new Error(error.message);
  }
  if (data) return fromRow(data as Row);
  if (opts?.allowSeedFallback) return loadSeedArticle(round);
  return null;
}

export async function upsertRoundArticle(
  sb: SupabaseClient,
  payload: RoundArticlePayload,
): Promise<RoundArticle> {
  const row = {
    round_number: payload.round,
    headline: payload.headline.trim(),
    subtitle: payload.subtitle?.trim() ? payload.subtitle.trim() : null,
    body: payload.body.trim(),
  };
  const { data, error } = await sb
    .from('round_articles')
    .upsert(row, { onConflict: 'round_number' })
    .select('id, round_number, headline, subtitle, body, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data as Row);
}
