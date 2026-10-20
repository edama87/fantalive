import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { listAliases, loadAliasCatalog, loadUnmatchedForRound } from '@/lib/alias-admin';
import { reapplyRoundVotes } from '@/lib/vote-reapply';
import { getRoundByNumber } from '@/data/calendar';

export const maxDuration = 60;

const SOURCES = new Set(['pianetafanta', 'fantacalcio', 'espn']);

async function guard() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ success: false, error: 'SUPABASE_SECRET_KEY non configurata' }, { status: 503 });
  }
  return null;
}

async function reapply(round: unknown) {
  const number = Number(round);
  const info = Number.isInteger(number) ? getRoundByNumber(number) : undefined;
  if (!info) return null;
  try {
    return await reapplyRoundVotes(number, { serieAMatchday: info.serieAMatchday });
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Riapplicazione non riuscita' };
  }
}

/** Non abbinati della giornata (con suggerimenti), catalogo giocatori e alias esistenti. */
export async function GET(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const round = Number(new URL(request.url).searchParams.get('round'));
  try {
    const catalog = await loadAliasCatalog();
    const [unmatched, aliases] = await Promise.all([
      Number.isInteger(round) && round > 0 ? loadUnmatchedForRound(round, catalog) : Promise.resolve([]),
      listAliases(),
    ]);
    return NextResponse.json({
      success: true,
      unmatched,
      aliases,
      players: catalog.map((p) => ({ id: p.id, name: p.name, role: p.role, realTeam: p.realTeam, fantaTeam: p.fantaTeam })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Errore' }, { status: 500 });
  }
}

/** Crea o aggiorna un alias (per alias+fonte) e riapplica i voti della giornata. */
export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as
    | { id?: string; alias?: string; playerId?: string; source?: string; round?: number }
    | null;
  const alias = body?.alias?.trim();
  const source = body?.source ?? 'pianetafanta';
  if (!alias || !body?.playerId || !SOURCES.has(source)) {
    return NextResponse.json({ success: false, error: 'Alias, giocatore e fonte sono obbligatori' }, { status: 400 });
  }
  const supabase = getServerClient();
  const row = { alias, player_id: body.playerId, source };
  const { error } = body.id
    ? await supabase.from('player_aliases').update(row).eq('id', body.id)
    : await supabase.from('player_aliases').upsert(row, { onConflict: 'alias,source' });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, reapplied: await reapply(body.round) });
}

export async function DELETE(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id mancante' }, { status: 400 });
  const { error } = await getServerClient().from('player_aliases').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, reapplied: await reapply(params.get('round')) });
}
