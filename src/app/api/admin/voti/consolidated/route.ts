import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { isSupabaseServerConfigured } from '@/lib/db/supabase';
import { clearConsolidatedVotes, listConsolidatedMatches } from '@/lib/consolidated-votes-admin';

export const maxDuration = 60;

async function guard() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ success: false, error: 'SUPABASE_SECRET_KEY non configurata' }, { status: 503 });
  }
  return null;
}

/** GET ?round= : partite con voti consolidati della giornata. */
export async function GET(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const round = Number(new URL(request.url).searchParams.get('round'));
  if (!Number.isInteger(round) || round <= 0) {
    return NextResponse.json({ success: false, error: 'Giornata non valida' }, { status: 400 });
  }
  try {
    return NextResponse.json({ success: true, matches: await listConsolidatedMatches(round) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Errore' }, { status: 500 });
  }
}

/** DELETE JSON { round, matchKey, playerId?, confirm: 'delete' }: torna ai voti fantacalcio.it. */
export async function DELETE(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as
    | { round?: number; matchKey?: string; playerId?: string; confirm?: string }
    | null;
  const round = Number(body?.round);
  if (!Number.isInteger(round) || round <= 0 || !body?.matchKey) {
    return NextResponse.json({ success: false, error: 'Giornata e partita sono obbligatorie' }, { status: 400 });
  }
  if (body.confirm !== 'delete') {
    return NextResponse.json({ success: false, error: 'Conferma richiesta' }, { status: 400 });
  }
  try {
    const result = await clearConsolidatedVotes(round, body.matchKey, body.playerId || undefined);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Errore' }, { status: 400 });
  }
}
