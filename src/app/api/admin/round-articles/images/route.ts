/**
 * Upload vignetta di paragrafo per l'articolo di giornata.
 * Scrive file ottimizzato in public/giornale/{round}/ e aggiorna round_articles.
 * Solo admin. Non crea bucket Supabase. Nessuna vignetta di apertura.
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
  slot: z.literal('paragraph').default('paragraph'),
  paragraphIndex: z.coerce.number().int().min(0).max(40),
  alt: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(800).optional(),
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
    const slotRaw = form.get('slot');
    if (slotRaw != null && slotRaw !== '' && slotRaw !== 'paragraph') {
      return NextResponse.json(
        { success: false, error: 'Solo upload per paragrafo (header non più supportato)' },
        { status: 400 },
      );
    }
    const parsed = metaSchema.safeParse({
      round: form.get('round'),
      slot: 'paragraph',
      paragraphIndex: form.get('paragraphIndex'),
      alt: form.get('alt') ?? undefined,
      description: form.get('description') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Metadati non validi' }, { status: 400 });
    }
    const { round, paragraphIndex } = parsed.data;

    const buf = Buffer.from(await file.arrayBuffer());
    const webp = await sharp(buf)
      .rotate()
      .resize({ width: 1000, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    const dir = path.join(process.cwd(), 'public', 'giornale', String(round));
    await mkdir(dir, { recursive: true });
    const filename = `p${paragraphIndex + 1}.webp`;
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

    const prev = current.paragraphImages.find((p) => p.paragraphIndex === paragraphIndex);
    const alt =
      parsed.data.alt ??
      prev?.alt ??
      `Vignetta del paragrafo ${paragraphIndex + 1}`;
    const description = parsed.data.description ?? prev?.description ?? '';

    const paragraphImages = [
      ...current.paragraphImages.filter((p) => p.paragraphIndex !== paragraphIndex),
      { paragraphIndex, url, alt, description },
    ].sort((a, b) => a.paragraphIndex - b.paragraphIndex);

    const article = await upsertRoundArticle(sb, {
      round,
      headline: current.headline,
      subtitle: current.subtitle,
      body: current.body,
      headerImageUrl: null,
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
