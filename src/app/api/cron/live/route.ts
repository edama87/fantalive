/**
 * Live Data Cron Route
 * GET/POST /api/cron/live
 * 
 * Protected by CRON_SECRET in Authorization: Bearer header.
 * Fetches live data from the configured provider and writes to Supabase.
 * 
 * Called every minute via Supabase pg_cron + pg_net.
 * Giornata corrente scelta per data (non per stato). Legge da ESPN tutte le
 * partite dei giorni della giornata, le salva in serie_a_matches e aggiorna
 * rounds.status ('finished' solo a 10 partite finite).
 * Uscita veloce quando le partite sono già tutte nel DB e nessuna è live o
 * entro -15/+150 minuti dal calcio d'inizio.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { createProvider, getProviderType } from '@/providers/factory';
import {
  cronWindow,
  deriveRoundStatus,
  pickCurrentRound,
  romeTodayIso,
  roundEspnDates,
  type DbRoundRow,
  type DbSerieAMatchRow,
} from '@/lib/round-schedule';

export const maxDuration = 30;

async function verifyCronSecret(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.warn('[Cron] CRON_SECRET not configured, allowing request in development');
    return process.env.NODE_ENV === 'development';
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return false;
}

type Supabase = ReturnType<typeof getServerClient>;

interface CronRoundContext {
  round: DbRoundRow;
  dates: string[];
  matches: DbSerieAMatchRow[];
}

/** Giornata corrente per data + partite già nel DB + giorni ESPN da leggere. */
async function loadRoundContext(supabase: Supabase, now: Date): Promise<CronRoundContext | null> {
  const { data: rounds, error } = await supabase
    .from('rounds')
    .select('number, serie_a_matchday, kickoff_date, status')
    .order('kickoff_date', { ascending: true });
  if (error) throw new Error(`rounds: ${error.message}`);
  const all = (rounds ?? []) as DbRoundRow[];
  const round = pickCurrentRound(all, romeTodayIso(now));
  if (!round) return null;
  const next = all.find((r) => r.kickoff_date > round.kickoff_date) ?? null;

  const { data: matches, error: matchesError } = await supabase
    .from('serie_a_matches')
    .select('id, status, kickoff_time')
    .eq('round_number', round.number);
  if (matchesError) throw new Error(`serie_a_matches: ${matchesError.message}`);

  return { round, dates: roundEspnDates(round, next), matches: (matches ?? []) as DbSerieAMatchRow[] };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  if (!await verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 503 }
    );
  }

  const supabase = getServerClient();
  const now = new Date();

  let context: CronRoundContext | null;
  try {
    context = await loadRoundContext(supabase, now);
  } catch (error) {
    console.error('[Cron Live] round context:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!context) {
    return NextResponse.json({ success: true, skipped: true, reason: 'no_rounds' });
  }

  const todayKey = romeTodayIso(now).replace(/-/g, '');
  const windowCheck = cronWindow(context.matches, now, context.dates.includes(todayKey));
  if (!windowCheck.active) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: windowCheck.reason,
      round: context.round.number,
      message: 'No match within active window (-15/+150 min of kickoff)',
      durationMs: Date.now() - startTime,
    });
  }

  let cronRunId: string | null = null;

  try {
    const { data: cronRun } = await supabase
      .from('cron_runs')
      .insert({
        job_name: 'live_ingestion',
        status: 'running',
        round_number: context.round.number,
      })
      .select('id')
      .single();
    
    cronRunId = cronRun?.id || null;

    const currentRound = context.round;
    const providerType = getProviderType();
    const provider = createProvider({ type: providerType });
    await provider.initialize();

    const data = await provider.fetchLiveData(currentRound.serie_a_matchday, { dates: context.dates });
    provider.dispose();

    let matchesUpdated = 0;
    let votesUpdated = 0;
    let eventsIngested = 0;
    const errors: string[] = [];

    if (data.serieAMatches.length > 0) {
      const { error: matchError } = await supabase.from('serie_a_matches').upsert(
        data.serieAMatches.map((match) => ({
          id: match.matchId,
          round_number: currentRound.number,
          home_team: match.homeTeam,
          away_team: match.awayTeam,
          home_score: match.homeScore,
          away_score: match.awayScore,
          minute: match.minute,
          status: match.status,
          kickoff_time: match.kickoffTime,
          venue: match.venue,
          source_provider: providerType,
          source_match_id: match.matchId,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'id' }
      );
      if (matchError) errors.push(`serie_a_matches: ${matchError.message}`);
      else matchesUpdated = data.serieAMatches.length;
    }

    const played = [...data.playerData.values()].filter(
      (player) => player.minutesPlayed > 0 || player.events.length > 0
    );

    if (played.length > 0) {
      const { error: voteError } = await supabase.from('live_votes').upsert(
        played.map((player) => ({
          round_number: currentRound.number,
          player_id: player.playerId,
          estimated_vote: player.estimatedVote,
          is_estimated: true,
          source_rating: player.rating,
          minutes_played: player.minutesPlayed,
          is_playing: player.isPlaying,
          is_subbed_out: player.isSubstitutedOut,
          source_provider: providerType,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'round_number,player_id,source_provider' }
      );
      if (voteError) errors.push(`live_votes: ${voteError.message}`);
      else votesUpdated = played.length;

      // Gli eventi di questi giocatori vengono riscritti per intero: così un gol
      // annullato dal VAR o corretto dalla fonte sparisce anche dal DB.
      const playerIds = played.map((player) => player.playerId);
      const { error: deleteError } = await supabase
        .from('live_events')
        .delete()
        .eq('round_number', currentRound.number)
        .eq('source_provider', providerType)
        .in('player_id', playerIds);
      if (deleteError) errors.push(`live_events delete: ${deleteError.message}`);

      const seen = new Set<string>();
      const eventRows = played.flatMap((player) =>
        player.events.map((event, index) => {
          let sourceId = `${player.playerId}-${event.type}-${event.minute}`;
          if (seen.has(sourceId)) sourceId = `${sourceId}-${index}`;
          seen.add(sourceId);
          return {
            round_number: currentRound.number,
            player_id: player.playerId,
            event_type: event.type,
            minute: event.minute,
            // related_player_id ha FK su players: il gol subito dal portiere
            // ('opponent') si salva puntando al portiere stesso (vedi round-player-data).
            related_player_id:
              event.relatedPlayerId === 'opponent' ? player.playerId : event.relatedPlayerId || null,
            source_provider: providerType,
            source_event_id: sourceId,
          };
        })
      );
      // stesso giocatore/tipo/minuto (es. due gol subiti nello stesso minuto):
      // il vincolo unico ne tiene uno solo, quindi deduplichiamo prima.
      const unique = new Map<string, (typeof eventRows)[number]>();
      for (const row of eventRows) {
        unique.set(`${row.player_id}|${row.event_type}|${row.minute}`, row);
      }
      if (!deleteError && unique.size > 0) {
        const { error: eventError } = await supabase.from('live_events').upsert([...unique.values()], {
          onConflict: 'round_number,player_id,event_type,minute,source_provider',
        });
        if (eventError) errors.push(`live_events: ${eventError.message}`);
        else eventsIngested = unique.size;
      }
    }

    // Stato giornata dalle partite: 'finished' solo quando tutte e 10 sono finite.
    const { data: roundMatches } = await supabase
      .from('serie_a_matches')
      .select('status')
      .eq('round_number', currentRound.number);
    const roundStatus = deriveRoundStatus((roundMatches ?? []).map((m) => m.status as string));
    if (roundStatus !== currentRound.status) {
      const { error: roundError } = await supabase
        .from('rounds')
        .update({ status: roundStatus })
        .eq('number', currentRound.number);
      if (roundError) errors.push(`rounds: ${roundError.message}`);
    }

    const duration = Date.now() - startTime;
    const unmatched = data.unmatchedPlayers ?? [];

    await updateCronRun(supabase, cronRunId, errors.length > 0 ? 'error' : 'success', {
      round_number: currentRound.number,
      matches_updated: matchesUpdated,
      votes_updated: votesUpdated,
      events_ingested: eventsIngested,
      duration_ms: duration,
      is_live: data.isLive,
      round_status: roundStatus,
      dates: context.dates,
      unmatched_count: unmatched.length,
      unmatched_players: unmatched.slice(0, 60).map((p) => `${p.name} (${p.team ?? '?'})`),
      error_message: errors.length > 0 ? errors.join('; ') : undefined,
    });

    return NextResponse.json({
      success: errors.length === 0,
      round: currentRound.number,
      roundStatus,
      matchesUpdated,
      votesUpdated,
      eventsIngested,
      unmatchedCount: unmatched.length,
      isLive: data.isLive,
      durationMs: duration,
      ...(errors.length > 0 ? { errors } : {}),
    });

  } catch (error) {
    console.error('[Cron Live] Error:', error);
    
    await updateCronRun(supabase, cronRunId, 'error', {
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function updateCronRun(
  supabase: ReturnType<typeof getServerClient>,
  cronRunId: string | null,
  status: 'success' | 'error',
  metadata: Record<string, unknown>
): Promise<void> {
  if (!cronRunId) return;

  try {
    await supabase
      .from('cron_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        matches_updated: metadata.matches_updated as number || 0,
        votes_updated: metadata.votes_updated as number || 0,
        events_ingested: metadata.events_ingested as number || 0,
        error_message: metadata.error_message as string || null,
        metadata,
      })
      .eq('id', cronRunId);
  } catch (err) {
    console.error('[Cron] Failed to update cron_runs:', err);
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
