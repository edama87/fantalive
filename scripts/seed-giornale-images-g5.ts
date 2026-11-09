/**
 * Assicura vignette G5 in public/giornale/5 e aggiorna round_articles (header + paragraph_images).
 * Richiede ALLOW_MATCH_COMMENTS_SEED=1. Non crea bucket Supabase.
 * Sorgente opzionale: /workspace/vignette-g5/*.jpg (ricompressa) oppure usa già public/.
 */
import { existsSync, mkdirSync, readFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { getRoundArticle, upsertRoundArticle } from '@/lib/round-articles';

async function ensureWebp(srcJpg: string, destWebp: string, width: number) {
  mkdirSync(path.dirname(destWebp), { recursive: true });
  if (existsSync(srcJpg)) {
    await sharp(srcJpg).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(destWebp);
    return;
  }
  if (!existsSync(destWebp)) {
    throw new Error(`Manca ${srcJpg} e anche ${destWebp}`);
  }
}

async function main() {
  if (process.env.ALLOW_MATCH_COMMENTS_SEED !== '1') {
    console.error('Rifiuto: imposta ALLOW_MATCH_COMMENTS_SEED=1 solo dopo OK esplicito.');
    process.exit(1);
  }
  if (!isSupabaseServerConfigured()) {
    console.error('Supabase non configurato');
    process.exit(1);
  }

  const srcDir = process.env.VIGNETTE_SRC_DIR || '/workspace/vignette-g5';
  const destDir = path.join(process.cwd(), 'public', 'giornale', '5');
  mkdirSync(destDir, { recursive: true });

  const files = [
    { jpg: 'header.jpg', webp: 'header.webp', w: 1600 },
    { jpg: 'p1-fc-dc.jpg', webp: 'p1-fc-dc.webp', w: 1000 },
    { jpg: 'p2-le-rp.jpg', webp: 'p2-le-rp.webp', w: 1000 },
    { jpg: 'p3-psg-sf.jpg', webp: 'p3-psg-sf.webp', w: 1000 },
    { jpg: 'p4-am-st.jpg', webp: 'p4-am-st.webp', w: 1000 },
    { jpg: 'p5-ym-ap.jpg', webp: 'p5-ym-ap.webp', w: 1000 },
  ];
  for (const f of files) {
    await ensureWebp(path.join(srcDir, f.jpg), path.join(destDir, f.webp), f.w);
    console.log('ok', f.webp);
  }

  const raw = JSON.parse(readFileSync('data/match-comments-g5.json', 'utf8')) as {
    article: {
      round: number;
      headline: string;
      subtitle?: string | null;
      body: string;
      headerImageUrl?: string | null;
      paragraphImages?: { paragraphIndex: number; url: string; alt: string }[];
    };
  };
  const a = raw.article;
  const sb = getServerClient();
  const current = await getRoundArticle(sb, 5, { allowSeedFallback: true });
  const article = await upsertRoundArticle(sb, {
    round: 5,
    headline: current?.headline ?? a.headline,
    subtitle: current?.subtitle ?? a.subtitle ?? null,
    body: current?.body ?? a.body,
    headerImageUrl: a.headerImageUrl ?? '/giornale/5/header.webp',
    paragraphImages: a.paragraphImages ?? [],
  });
  console.log('article images', {
    id: article.id,
    header: article.headerImageUrl,
    paragraphs: article.paragraphImages.length,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
