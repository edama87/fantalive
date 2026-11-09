/**
 * Commento qualitativo di una sfida (lettura pubblica via service role).
 * GET ?round=N&home=xx&away=yy  -> { success, comment | null }
 * GET ?round=N                  -> { success, comments: [...] }
 */
import { NextResponse } from 'next/server';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { getMatchComment, listMatchComments } from '@/lib/match-comments';

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ success: false, error: 'Supabase non configurato' }, { status: 503 });
  }
  const params = new URL(request.url).searchParams;
  const round = Number(params.get('round'));
  if (!Number.isInteger(round) || round <= 0) {
    return NextResponse.json({ success: false, error: 'round non valido' }, { status: 400 });
  }
  const home = params.get('home');
  const away = params.get('away');
  const allowSeed = process.env.MATCH_COMMENTS_SEED_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
  try {
    const sb = getServerClient();
    if (home && away) {
      const comment = await getMatchComment(sb, round, home, away, { allowSeedFallback: allowSeed });
      return NextResponse.json({ success: true, comment });
    }
    const comments = await listMatchComments(sb, round, { allowSeedFallback: allowSeed });
    return NextResponse.json({ success: true, comments });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Errore' },
      { status: 500 },
    );
  }
}
