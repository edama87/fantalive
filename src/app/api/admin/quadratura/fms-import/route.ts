/**
 * Import voti FMS come voti ufficiali (solo sessione admin).
 *  GET    ?round=N[&refresh=1]          -> anteprima (differenze + risultati che cambiano), nessuna scrittura
 *  POST   { round, playerIds: string[] } -> scrive i voti FMS dei giocatori scelti (source 'fms')
 *  DELETE ?round=N                       -> annulla l'import FMS della giornata
 * FMS è letto in sola lettura (login + tabellini).
 * In locale (NODE_ENV != production) le scritture sono bloccate: .env.local punta al DB di prod.
 */
import { NextResponse, connection } from 'next/server';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/auth/admin';
import { calendar } from '@/data/calendar';
import { confirmFmsImport, getFmsImportPreview, undoFmsImport } from '@/lib/fms-vote-import-server';

async function guard(): Promise<NextResponse | null> {
  await connection();
  const devOpen = !isAdminConfigured() && process.env.NODE_ENV !== 'production';
  if (!devOpen && !(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  }
  return null;
}

function writesBlocked(): NextResponse | null {
  if (process.env.NODE_ENV === 'production' || process.env.FMS_IMPORT_ALLOW_LOCAL_WRITES === '1') return null;
  return NextResponse.json({ success: false, error: 'Scrittura disabilitata in locale (DB di produzione)' }, { status: 403 });
}

function parseRound(value: unknown): number | null {
  const round = Number(value);
  return Number.isInteger(round) && calendar.some((r) => r.number === round) ? round : null;
}

const fail = (error: unknown) =>
  NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Errore' }, { status: 500 });

export async function GET(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const url = new URL(request.url);
  const round = parseRound(url.searchParams.get('round'));
  if (!round) return NextResponse.json({ success: false, error: 'Giornata non valida' }, { status: 400 });
  try {
    return NextResponse.json({ success: true, data: await getFmsImportPreview(round, url.searchParams.get('refresh') === '1') });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  const denied = (await guard()) ?? writesBlocked();
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { round?: unknown; playerIds?: unknown } | null;
  const round = parseRound(body?.round);
  const ids = Array.isArray(body?.playerIds) ? body.playerIds.filter((x): x is string => typeof x === 'string') : null;
  if (!round || !ids) return NextResponse.json({ success: false, error: 'Richiesta non valida' }, { status: 400 });
  try {
    return NextResponse.json({ success: true, data: await confirmFmsImport(round, ids) });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  const denied = (await guard()) ?? writesBlocked();
  if (denied) return denied;
  const round = parseRound(new URL(request.url).searchParams.get('round'));
  if (!round) return NextResponse.json({ success: false, error: 'Giornata non valida' }, { status: 400 });
  try {
    return NextResponse.json({ success: true, data: await undoFmsImport(round) });
  } catch (error) {
    return fail(error);
  }
}
