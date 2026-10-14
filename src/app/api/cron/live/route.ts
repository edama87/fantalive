/**
 * Live Data Cron Route
 * POST /api/cron/live
 * 
 * Protected by CRON_SECRET header (Vercel Cron sends this automatically).
 * Fetches live data from the configured provider and writes to Supabase.
 * 
 * Called every minute during match windows via Vercel Cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import { createProvider, getProviderType } from '@/providers/factory';

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
  let cronRunId: string | null = null;

  try {
    const { data: cronRun } = await supabase
      .from('cron_runs')
      .insert({
        job_name: 'live_ingestion',
        status: 'running',
      })
      .select('id')
      .single();
    
    cronRunId = cronRun?.id || null;

    const { data: currentRound } = await supabase
      .from('rounds')
      .select('number, serie_a_matchday')
      .in('status', ['live', 'scheduled'])
      .order('kickoff_date')
      .limit(1)
      .single();

    if (!currentRound) {
      await updateCronRun(supabase, cronRunId, 'success', {
        message: 'No active round found',
      });
      return NextResponse.json({ success: true, message: 'No active round' });
    }

    const providerType = getProviderType();
    const provider = createProvider({ type: providerType });
    await provider.initialize();

    const data = await provider.fetchLiveData(currentRound.serie_a_matchday);
    provider.dispose();

    let matchesUpdated = 0;
    let votesUpdated = 0;
    let eventsIngested = 0;

    for (const match of data.serieAMatches) {
      const { error: matchError } = await supabase
        .from('serie_a_matches')
        .upsert({
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
        }, {
          onConflict: 'id',
        });

      if (!matchError) matchesUpdated++;
    }

    for (const [playerId, playerData] of data.playerData) {
      if (playerData.minutesPlayed === 0 && playerData.events.length === 0) {
        continue;
      }

      const { error: voteError } = await supabase
        .from('live_votes')
        .upsert({
          round_number: currentRound.number,
          player_id: playerId,
          estimated_vote: playerData.estimatedVote,
          is_estimated: true,
          source_rating: playerData.rating,
          minutes_played: playerData.minutesPlayed,
          is_playing: playerData.isPlaying,
          is_subbed_out: playerData.isSubstitutedOut,
          source_provider: providerType,
        }, {
          onConflict: 'round_number,player_id,source_provider',
        });

      if (!voteError) votesUpdated++;

      for (const event of playerData.events) {
        const { error: eventError } = await supabase
          .from('live_events')
          .upsert({
            round_number: currentRound.number,
            player_id: playerId,
            event_type: event.type,
            minute: event.minute,
            related_player_id: event.relatedPlayerId || null,
            source_provider: providerType,
            source_event_id: `${playerId}-${event.type}-${event.minute}`,
          }, {
            onConflict: 'round_number,player_id,event_type,minute,source_provider',
          });

        if (!eventError) eventsIngested++;
      }
    }

    if (data.isLive) {
      await supabase
        .from('rounds')
        .update({ status: 'live' })
        .eq('number', currentRound.number)
        .eq('status', 'scheduled');
    } else if (!data.isLive && data.serieAMatches.every(m => m.status === 'finished')) {
      await supabase
        .from('rounds')
        .update({ status: 'finished' })
        .eq('number', currentRound.number)
        .eq('status', 'live');
    }

    const duration = Date.now() - startTime;

    await updateCronRun(supabase, cronRunId, 'success', {
      round_number: currentRound.number,
      matches_updated: matchesUpdated,
      votes_updated: votesUpdated,
      events_ingested: eventsIngested,
      duration_ms: duration,
      is_live: data.isLive,
    });

    return NextResponse.json({
      success: true,
      round: currentRound.number,
      matchesUpdated,
      votesUpdated,
      eventsIngested,
      isLive: data.isLive,
      durationMs: duration,
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
