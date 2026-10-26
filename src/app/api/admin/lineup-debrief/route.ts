/**
 * Debrief di una formazione consigliata (solo sessione admin).
 *  POST  { suggestionId }        -> calcola (o ricalcola) e salva, note conservate; { success, debrief, saved, notice? }
 *  PATCH { suggestionId, notes } -> aggiorna le "Note di Daniele"; { success, debrief }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { getSuggestion } from '@/lib/lineup-suggestions';
import { computeDebrief, MAX_NOTES_LENGTH, saveDebrief, saveDebriefNotes } from '@/lib/lineup-debrief-server';

const bodySchema = z.object({ suggestionId: z.string().uuid() });

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ success: false, error: 'SUPABASE_SECRET_KEY non configurata' }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'suggestionId non valido' }, { status: 400 });
  try {
    const sb = getServerClient();
    const suggestion = await getSuggestion(sb, parsed.data.suggestionId);
    if (!suggestion) return NextResponse.json({ success: false, error: 'Formazione consigliata non trovata' }, { status: 404 });
    const debrief = await computeDebrief(sb, suggestion);
    const { saved, reason } = await saveDebrief(sb, debrief);
    return NextResponse.json({ success: true, debrief, saved, notice: reason ?? null });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Errore' }, { status: 500 });
  }
}

const notesSchema = z.object({ suggestionId: z.string().uuid(), notes: z.string().max(MAX_NOTES_LENGTH) });

export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ success: false, error: 'SUPABASE_SECRET_KEY non configurata' }, { status: 503 });
  }
  const parsed = notesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Dati non validi' }, { status: 400 });
  try {
    const debrief = await saveDebriefNotes(getServerClient(), parsed.data.suggestionId, parsed.data.notes);
    if (!debrief) return NextResponse.json({ success: false, error: 'Genera prima il debrief' }, { status: 404 });
    return NextResponse.json({ success: true, debrief });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Errore' }, { status: 500 });
  }
}
