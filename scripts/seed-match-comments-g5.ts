/**
 * Upsert commenti G5 + articolo di giornata.
 * NON scrivere su prod senza OK: richiede ALLOW_MATCH_COMMENTS_SEED=1.
 * Uso: ALLOW_MATCH_COMMENTS_SEED=1 npx tsx --env-file=.env.local scripts/seed-match-comments-g5.ts
 */
import { readFileSync } from 'node:fs';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { upsertMatchComment } from '@/lib/match-comments';
import { upsertRoundArticle } from '@/lib/round-articles';

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

  const raw = JSON.parse(readFileSync('data/match-comments-g5.json', 'utf8')) as {
    comments: Array<{
      round: number;
      homeTeamId: string;
      awayTeamId: string;
      analysis: string;
      ironicNote: string;
    }>;
    article: { round: number; headline: string; subtitle?: string | null; body: string };
  };

  const sb = getServerClient();
  for (const c of raw.comments) {
    const saved = await upsertMatchComment(sb, {
      round: c.round,
      homeTeamId: c.homeTeamId,
      awayTeamId: c.awayTeamId,
      analysis: c.analysis,
      ironicNote: c.ironicNote,
    });
    console.log('comment', saved.homeTeamId, saved.awayTeamId, saved.id);
  }
  const article = await upsertRoundArticle(sb, {
    round: raw.article.round,
    headline: raw.article.headline,
    subtitle: raw.article.subtitle ?? null,
    body: raw.article.body,
  });
  console.log('article', article.round, article.id);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
