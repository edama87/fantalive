import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { FANTACALCIO_JOB, type RosterCandidate } from '@/lib/fantacalcio-auto-import';

/** Stato dell'import automatico fantacalcio.it per una giornata (ultimi run del cron). */
export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ success: false, error: 'SUPABASE_SECRET_KEY non configurata' }, { status: 503 });
  }
  const round = Number(new URL(request.url).searchParams.get('round'));
  if (!Number.isInteger(round) || round < 1) {
    return NextResponse.json({ success: false, error: 'Giornata non valida' }, { status: 400 });
  }

  const { data, error } = await getServerClient()
    .from('cron_runs')
    .select('started_at, finished_at, status, votes_updated, error_message, metadata')
    .eq('job_name', FANTACALCIO_JOB)
    .eq('round_number', round)
    .order('started_at', { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const runs = data ?? [];
  // Non abbinati della lega visti nei run della giornata (il più recente vince).
  const candidates = new Map<string, RosterCandidate & { lastSeen: string }>();
  for (const run of runs) {
    const list = ((run.metadata as { roster_candidates?: RosterCandidate[] } | null)?.roster_candidates ?? []);
    for (const item of list) {
      const key = `${item.team}|${item.name}`;
      if (!candidates.has(key)) candidates.set(key, { ...item, lastSeen: run.started_at as string });
    }
  }
  const last = runs[0] ?? null;
  const meta = (last?.metadata ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    success: true,
    runs: runs.length,
    last: last
      ? {
          startedAt: last.started_at,
          status: last.status,
          saved: last.votes_updated ?? 0,
          skippedConsolidated: meta.skipped_consolidated ?? 0,
          matches: meta.matches ?? [],
          error: last.error_message,
        }
      : null,
    rosterCandidates: [...candidates.values()],
  });
}
