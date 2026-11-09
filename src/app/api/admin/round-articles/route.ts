/** GET ?round=N | PUT JSON articolo — solo admin */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import {
  getRoundArticle,
  MASTHEAD_NAME,
  roundArticlePayloadSchema,
  upsertRoundArticle,
} from '@/lib/round-articles';

async function guard() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ success: false, error: 'SUPABASE_SECRET_KEY non configurata' }, { status: 503 });
  }
  return null;
}

export async function GET(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const round = Number(new URL(request.url).searchParams.get('round'));
  if (!Number.isInteger(round) || round <= 0) {
    return NextResponse.json({ success: false, error: 'round non valido' }, { status: 400 });
  }
  try {
    const article = await getRoundArticle(getServerClient(), round, { allowSeedFallback: true });
    return NextResponse.json({ success: true, masthead: MASTHEAD_NAME, article });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Errore' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = roundArticlePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Payload non valido', issues: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  try {
    const article = await upsertRoundArticle(getServerClient(), parsed.data);
    return NextResponse.json({ success: true, masthead: MASTHEAD_NAME, article });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Errore' },
      { status: 500 },
    );
  }
}
