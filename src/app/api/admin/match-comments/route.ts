/**
 * Scrive/aggiorna il commento di una sfida (solo sessione admin).
 * GET  ?round=N[&home=&away=] -> elenco o singolo
 * PUT  JSON { round, homeTeamId, awayTeamId, analysis, ironicNote }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import {
  getMatchComment,
  listMatchComments,
  matchCommentPayloadSchema,
  upsertMatchComment,
} from '@/lib/match-comments';

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
  const params = new URL(request.url).searchParams;
  const round = Number(params.get('round'));
  if (!Number.isInteger(round) || round <= 0) {
    return NextResponse.json({ success: false, error: 'round non valido' }, { status: 400 });
  }
  try {
    const sb = getServerClient();
    const home = params.get('home');
    const away = params.get('away');
    if (home && away) {
      const comment = await getMatchComment(sb, round, home, away, { allowSeedFallback: true });
      return NextResponse.json({ success: true, comment });
    }
    const comments = await listMatchComments(sb, round, { allowSeedFallback: true });
    return NextResponse.json({ success: true, comments });
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
  const body = await request.json().catch(() => null);
  const parsed = matchCommentPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Payload non valido', issues: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  try {
    const comment = await upsertMatchComment(getServerClient(), parsed.data);
    return NextResponse.json({ success: true, comment });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Errore' },
      { status: 500 },
    );
  }
}
