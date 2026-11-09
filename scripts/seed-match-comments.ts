/**
 * Upsert commenti + articolo di giornata da data/match-comments-g{N}.json.
 * NON scrivere su prod senza OK: richiede ALLOW_MATCH_COMMENTS_SEED=1.
 * Uso: ALLOW_MATCH_COMMENTS_SEED=1 npx tsx --env-file=.env.local scripts/seed-match-comments.ts 5
 *      ALLOW_MATCH_COMMENTS_SEED=1 npx tsx --env-file=.env.local scripts/seed-match-comments.ts 1 2 3 4
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { upsertMatchComment } from '@/lib/match-comments';
import { upsertRoundArticle } from '@/lib/round-articles';

async function seedRound(sb: ReturnType<typeof getServerClient>, round: number) {
  const file = path.join(process.cwd(), 'data', `match-comments-g${round}.json`);
  if (!existsSync(file)) {
    throw new Error(`Manca ${file}`);
  }
  const raw = JSON.parse(readFileSync(file, 'utf8')) as {
    comments: Array<{
      round: number;
      homeTeamId: string;
      awayTeamId: string;
      analysis: string;
      ironicNote: string;
    }>;
    article: {
      round: number;
      headline: string;
      subtitle?: string | null;
      body: string;
      headerImageUrl?: string | null;
      paragraphImages?: Array<{
        paragraphIndex: number;
        url: string;
        alt?: string;
        description?: string;
      }>;
    };
  };

  for (const c of raw.comments) {
    if (c.round !== round) throw new Error(`Commento round ${c.round} nel file g${round}`);
    const saved = await upsertMatchComment(sb, {
      round: c.round,
      homeTeamId: c.homeTeamId,
      awayTeamId: c.awayTeamId,
      analysis: c.analysis,
      ironicNote: c.ironicNote,
    });
    console.log('comment', round, saved.homeTeamId, saved.awayTeamId, saved.id);
  }

  const a = raw.article;
  if (a.round !== round) throw new Error(`Articolo round ${a.round} nel file g${round}`);
  const article = await upsertRoundArticle(sb, {
    round: a.round,
    headline: a.headline,
    subtitle: a.subtitle ?? null,
    body: a.body,
    headerImageUrl: a.headerImageUrl ?? null,
    paragraphImages: (a.paragraphImages ?? []).map((img) => ({
      paragraphIndex: img.paragraphIndex,
      url: img.url,
      alt: img.alt ?? '',
      description: img.description ?? '',
    })),
  });
  console.log('article', article.round, article.id, 'imgs', article.paragraphImages.length);
}

async function main() {
  if (process.env.ALLOW_MATCH_COMMENTS_SEED !== '1') {
    console.error(
      'Rifiuto: imposta ALLOW_MATCH_COMMENTS_SEED=1 solo dopo OK esplicito (e non su prod senza consenso).',
    );
    process.exit(1);
  }
  if (!isSupabaseServerConfigured()) {
    console.error('Supabase non configurato');
    process.exit(1);
  }

  const args = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const rounds = args.length ? args : [5];
  const sb = getServerClient();
  for (const round of rounds) {
    await seedRound(sb, round);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
