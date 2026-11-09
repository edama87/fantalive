/**
 * Upload vignetta articolo (header o paragrafo).
 * Scrive file ottimizzato in public/giornale/{round}/ e aggiorna round_articles se le colonne esistono.
 * Solo admin. Non crea bucket Supabase.
 */
import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { getRoundArticle, upsertRoundArticle } from '@/lib/round-articles';


const metaSchema = z.object({
  round: z.coerce.number().int().positive().max(60),
  slot: z.enum(['header', 'paragraph']),
  paragraphIndex: z.coerce.number().int().min(0).max(40).optional(),
  alt: z.string().trim().min(1).max(300).optional(),
});

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ success: false, error: 'SUPABASE_SECRET_KEY non configurata' }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'file mancante' }, { status: 400 });
    }
    const parsed = metaSchema.safeParse({
      round: form.get('round'),
      slot: form.get('slot'),
      paragraphIndex: form.get('paragraphIndex') ?? undefined,
      alt: form.get('alt') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Metadati non validi' }, { status: 400 });
    }
    const { round, slot } = parsed.data;
    if (slot === 'paragraph' && parsed.data.paragraphIndex === undefined) {
      return NextResponse.json({ success: false, error: 'paragraphIndex richiesto' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const width = slot === 'header' ? 1600 : 1000;
    const webp = await sharp(buf)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    const dir = path.join(process.cwd(), 'public', 'giornale', String(round));
    await mkdir(dir, { recursive: true });
    const filename =
      slot === 'header'
        ? 'header.webp'
        : `p${(parsed.data.paragraphIndex ?? 0) + 1}.webp`;
    await writeFile(path.join(dir, filename), webp);
    const url = `/giornale/${round}/${filename}`;

    const sb = getServerClient();
    const current = await getRoundArticle(sb, round, { allowSeedFallback: true });
    if (!current) {
      return NextResponse.json(
        { success: false, error: 'Salva prima il testo dell\'articolo', url },
        { status: 404 },
      );
    }

    const alt =
      parsed.data.alt ??
      (slot === 'header'
        ? `Vignetta di apertura della ${round}ª giornata`
        : `Vignetta del paragrafo ${(parsed.data.paragraphIndex ?? 0) + 1}`);

    const paragraphImages = [...(current.paragraphImages ?? [])];
    let headerImageUrl = current.headerImageUrl;
    if (slot === 'header') {
      headerImageUrl = url;
    } else {
      const idx = parsed.data.paragraphIndex!;
      const without = paragraphImages.filter((p) => p.paragraphIndex !== idx);
      without.push({ paragraphIndex: idx, url, alt });
      paragraphImages.splice(0, paragraphImages.length, ...without.sort((a, b) => a.paragraphIndex - b.paragraphIndex));
    }

    const article = await upsertRoundArticle(sb, {
      round,
      headline: current.headline,
      subtitle: current.subtitle,
      body: current.body,
      headerImageUrl,
      paragraphImages,
    });

    return NextResponse.json({ success: true, url, article });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Errore upload' },
      { status: 500 },
    );
  }
}
