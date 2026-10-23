/**
 * Formazioni consigliate.
 * Auth: header "Authorization: Bearer <LINEUP_SUGGESTIONS_API_KEY>" oppure sessione admin.
 *  GET    ?round=N[&team=ap]   -> elenco (senza round: ultima giornata presente)
 *  POST   JSON payload          -> crea/aggiorna (id, oppure team+round+variant)
 *  DELETE ?id=<uuid>            -> elimina
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { bearerToken, verifyApiKey } from '@/lib/auth/api-key';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import {
  deleteSuggestion,
  listSuggestions,
  suggestionPayloadSchema,
  upsertSuggestion,
} from '@/lib/lineup-suggestions';

async function guard(request: Request) {
  const token = bearerToken(request.headers.get('authorization'));
  const authorized = token
    ? verifyApiKey(token, process.env.LINEUP_SUGGESTIONS_API_KEY)
    : await isAdminAuthenticated();
  if (!authorized) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ success: false, error: 'SUPABASE_SECRET_KEY non configurata' }, { status: 503 });
  }
  return null;
}

function fail(error: unknown, status = 500) {
  return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Errore' }, { status });
}

export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const roundParam = params.get('round');
  const round = roundParam ? Number(roundParam) : undefined;
  if (round !== undefined && (!Number.isInteger(round) || round <= 0)) return fail(new Error('round non valido'), 400);
  try {
    const result = await listSuggestions(getServerClient(), { round, teamId: params.get('team') ?? 'ap' });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const parsed = suggestionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Payload non valido', issues: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }
  try {
    const result = await upsertSuggestion(getServerClient(), parsed.data);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!z.string().uuid().safeParse(id).success) return fail(new Error('id non valido'), 400);
  try {
    const deleted = await deleteSuggestion(getServerClient(), id);
    return deleted
      ? NextResponse.json({ success: true, id })
      : NextResponse.json({ success: false, error: 'Non trovato' }, { status: 404 });
  } catch (error) {
    return fail(error);
  }
}
