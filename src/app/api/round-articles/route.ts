/** GET ?round=N -> { success, article | null, masthead } */
import { NextResponse } from 'next/server';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { getRoundArticle, MASTHEAD_NAME } from '@/lib/round-articles';

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ success: false, error: 'Supabase non configurato' }, { status: 503 });
  }
  const round = Number(new URL(request.url).searchParams.get('round'));
  if (!Number.isInteger(round) || round <= 0) {
    return NextResponse.json({ success: false, error: 'round non valido' }, { status: 400 });
  }
  const allowSeed = process.env.MATCH_COMMENTS_SEED_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
  try {
    const article = await getRoundArticle(getServerClient(), round, { allowSeedFallback: allowSeed });
    return NextResponse.json({ success: true, masthead: MASTHEAD_NAME, article });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Errore' },
      { status: 500 },
    );
  }
}
