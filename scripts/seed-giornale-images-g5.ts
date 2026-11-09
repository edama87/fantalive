/**
 * Assicura vignette G5 wide (21:9) in public/giornale/5 (*-w.webp) e aggiorna
 * round_articles.paragraph_images (con description). Imposta header_image_url a null.
 * Richiede ALLOW_MATCH_COMMENTS_SEED=1. Non crea bucket Supabase.
 * Sorgente: VIGNETTE_SRC_DIR o /workspace/vignette-g5-wide.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { getRoundArticle, upsertRoundArticle } from '@/lib/round-articles';
import type { ParagraphImage } from '@/lib/round-articles-shared';

async function ensureWebp(srcJpg: string, destWebp: string, width: number) {
  mkdirSync(path.dirname(destWebp), { recursive: true });
  if (existsSync(srcJpg)) {
    await sharp(srcJpg)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(destWebp);
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

  const srcDir = process.env.VIGNETTE_SRC_DIR || '/workspace/vignette-g5-wide';
  const destDir = path.join(process.cwd(), 'public', 'giornale', '5');
  mkdirSync(destDir, { recursive: true });

  const files = [
    { jpg: 'p1-fc-dc.jpg', webp: 'p1-fc-dc-w.webp' },
    { jpg: 'p2-le-rp.jpg', webp: 'p2-le-rp-w.webp' },
    { jpg: 'p3-psg-sf.jpg', webp: 'p3-psg-sf-w.webp' },
    { jpg: 'p4-am-st.jpg', webp: 'p4-am-st-w.webp' },
    { jpg: 'p5-ym-ap.jpg', webp: 'p5-ym-ap-w.webp' },
  ];
  for (const f of files) {
    await ensureWebp(path.join(srcDir, f.jpg), path.join(destDir, f.webp), 1280);
    console.log('ok', f.webp);
  }

  // Legacy assets: niente header, niente vecchi quadrati
  for (const legacy of [
    'header.webp',
    'p1-fc-dc.webp',
    'p2-le-rp.webp',
    'p3-psg-sf.webp',
    'p4-am-st.webp',
    'p5-ym-ap.webp',
  ]) {
    const p = path.join(destDir, legacy);
    if (existsSync(p)) {
      unlinkSync(p);
      console.log('removed', legacy);
    }
  }

  const raw = JSON.parse(readFileSync('data/match-comments-g5.json', 'utf8')) as {
    article: {
      round: number;
      headline: string;
      subtitle?: string | null;
      body: string;
      headerImageUrl?: string | null;
      paragraphImages?: ParagraphImage[];
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
    headerImageUrl: null,
    paragraphImages: a.paragraphImages ?? [],
  });
  console.log('article images', {
    id: article.id,
    header: article.headerImageUrl,
    paragraphs: article.paragraphImages.length,
    withDescription: article.paragraphImages.filter((p) => p.description).length,
    urls: article.paragraphImages.map((p) => p.url),
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
