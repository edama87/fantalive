/** Articoli di giornata — solo server. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MASTHEAD_NAME,
  articleParagraphs,
  normalizeParagraphImages,
  roundArticlePayloadSchema,
  type ParagraphImage,
  type RoundArticle,
  type RoundArticlePayload,
} from './round-articles-shared';

export type { RoundArticle, RoundArticlePayload, ParagraphImage };
export { MASTHEAD_NAME, articleParagraphs, normalizeParagraphImages, roundArticlePayloadSchema };

type Row = {
  id: string;
  round_number: number;
  headline: string;
  subtitle: string | null;
  body: string;
  header_image_url?: string | null;
  paragraph_images?: unknown;
  updated_at: string;
};

function fromRow(row: Row): RoundArticle {
  return {
    id: row.id,
    round: row.round_number,
    headline: row.headline,
    subtitle: row.subtitle,
    body: row.body,
    headerImageUrl: row.header_image_url ?? null,
    paragraphImages: normalizeParagraphImages(row.paragraph_images),
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
    article?: {
      round: number;
      headline: string;
      subtitle?: string | null;
      body: string;
      headerImageUrl?: string | null;
      paragraphImages?: ParagraphImage[];
    };
  };
  const a = raw.article;
  if (!a || a.round !== round) return null;
  return {
    id: null,
    round: a.round,
    headline: a.headline,
    subtitle: a.subtitle ?? null,
    body: a.body,
    headerImageUrl: a.headerImageUrl ?? null,
    paragraphImages: normalizeParagraphImages(a.paragraphImages ?? []),
    updatedAt: null,
    source: 'seed',
  };
}

function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /could not find the table/i.test(msg) ||
    (/does not exist|relation/i.test(msg) && /round_articles/i.test(msg))
  );
}

function isMissingImageColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === '42703' ||
    /header_image_url|paragraph_images/i.test(msg)
  );
}

export async function getRoundArticle(
  sb: SupabaseClient,
  round: number,
  opts?: { allowSeedFallback?: boolean },
): Promise<RoundArticle | null> {
  const full = await sb
    .from('round_articles')
    .select('id, round_number, headline, subtitle, body, header_image_url, paragraph_images, updated_at')
    .eq('round_number', round)
    .maybeSingle();

  if (full.error && isMissingImageColumn(full.error)) {
    const basic = await sb
      .from('round_articles')
      .select('id, round_number, headline, subtitle, body, updated_at')
      .eq('round_number', round)
      .maybeSingle();
    if (basic.error) {
      if (opts?.allowSeedFallback !== false && isMissingRelation(basic.error)) return loadSeedArticle(round);
      throw new Error(basic.error.message);
    }
    if (!basic.data) {
      if (opts?.allowSeedFallback) return loadSeedArticle(round);
      return null;
    }
    const base = fromRow(basic.data as Row);
    const seeded = loadSeedArticle(round);
    if (seeded) {
      return {
        ...base,
        headerImageUrl: seeded.headerImageUrl,
        paragraphImages: seeded.paragraphImages,
      };
    }
    return base;
  }

  if (full.error) {
    if (opts?.allowSeedFallback !== false && isMissingRelation(full.error)) return loadSeedArticle(round);
    throw new Error(full.error.message);
  }
  if (full.data) return fromRow(full.data as Row);
  if (opts?.allowSeedFallback) return loadSeedArticle(round);
  return null;
}

export async function upsertRoundArticle(
  sb: SupabaseClient,
  payload: RoundArticlePayload,
): Promise<RoundArticle> {
  const row: Record<string, unknown> = {
    round_number: payload.round,
    headline: payload.headline.trim(),
    subtitle: payload.subtitle?.trim() ? payload.subtitle.trim() : null,
    body: payload.body.trim(),
  };
  if (payload.headerImageUrl !== undefined) {
    row.header_image_url = payload.headerImageUrl?.trim() ? payload.headerImageUrl.trim() : null;
  }
  if (payload.paragraphImages !== undefined) {
    row.paragraph_images = payload.paragraphImages.map((img) => ({
      paragraph_index: img.paragraphIndex,
      paragraphIndex: img.paragraphIndex,
      url: img.url,
      alt: img.alt ?? '',
      description: img.description ?? '',
    }));
  }

  const { data, error } = await sb
    .from('round_articles')
    .upsert(row, { onConflict: 'round_number' })
    .select('id, round_number, headline, subtitle, body, header_image_url, paragraph_images, updated_at')
    .single();

  if (error && isMissingImageColumn(error)) {
    const basic = await sb
      .from('round_articles')
      .upsert(
        {
          round_number: payload.round,
          headline: payload.headline.trim(),
          subtitle: payload.subtitle?.trim() ? payload.subtitle.trim() : null,
          body: payload.body.trim(),
        },
        { onConflict: 'round_number' },
      )
      .select('id, round_number, headline, subtitle, body, updated_at')
      .single();
    if (basic.error) throw new Error(basic.error.message);
    const base = fromRow(basic.data as Row);
    return {
      ...base,
      headerImageUrl: payload.headerImageUrl ?? null,
      paragraphImages: payload.paragraphImages ?? [],
    };
  }
  if (error) throw new Error(error.message);
  return fromRow(data as Row);
}
