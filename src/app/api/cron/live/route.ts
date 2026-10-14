/**
 * Live Data Cron Route
 * GET/POST /api/cron/live
 * 
 * Protected by CRON_SECRET in Authorization: Bearer header.
 * Fetches live data from the configured provider and writes to Supabase.
 * 
 * Called every minute via Supabase pg_cron + pg_net during match windows.
 * Returns fast (cheap early exit) when no Serie A match is live or within
 * -15/+150 minutes of kickoff.
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

/**
 * Check if any Serie A match is live or within the active window (-15/+150 min of kickoff).
 * Uses DB data (serie_a_matches/rounds) for the check, not the external provider.
 */
async function isWithinMatchWindow(
  supabase: ReturnType<typeof getServerClient>
): Promise<{ active: boolean; reason: string; roundNumber?: number }> {
  const now = new Date();
  const windowStartMs = 15 * 60 * 1000;
  const windowEndMs = 150 * 60 * 1000;

  const { data: liveMatches } = await supabase
    .from('serie_a_matches')
    .select('id, status')
    .in('status', ['live', 'halftime'])
    .limit(1);

  if (liveMatches && liveMatches.length > 0) {
    return { active: true, reason: 'live_match_in_progress' };
  }

  const { data: upcomingRounds } = await supabase
    .from('rounds')
    .select('number, kickoff_date, kickoff_time, status')
    .in('status', ['scheduled', 'live'])
    .order('kickoff_date', { ascending: true })
    .limit(5);

  if (!upcomingRounds || upcomingRounds.length === 0) {
    return { active: false, reason: 'no_scheduled_rounds' };
  }

  for (const round of upcomingRounds) {
    if (round.status === 'live') {
      return { active: true, reason: 'round_is_live', roundNumber: round.number };
    }

    const kickoffStr = `${round.kickoff_date}T${round.kickoff_time || '00:00:00'}`;
    const kickoffTime = new Date(kickoffStr);
    const diffMs = kickoffTime.getTime() - now.getTime();

    if (diffMs >= -windowEndMs && diffMs <= windowStartMs) {
      return { active: true, reason: 'within_kickoff_window', roundNumber: round.number };
    }
  }

  const { data: recentMatches } = await supabase
    .from('serie_a_matches')
    .select('id, kickoff_time, status')
    .eq('status', 'scheduled')
    .not('kickoff_time', 'is', null)
    .order('kickoff_time', { ascending: true })
    .limit(10);

  if (recentMatches) {
    for (const match of recentMatches) {
      if (!match.kickoff_time) continue;
      const kickoffTime = new Date(match.kickoff_time);
      const diffMs = kickoffTime.getTime() - now.getTime();

      if (diffMs >= -windowEndMs && diffMs <= windowStartMs) {
        return { active: true, reason: 'match_within_window' };
      }
    }
  }

  return { active: false, reason: 'outside_match_window' };
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

  const windowCheck = await isWithinMatchWindow(supabase);
  if (!windowCheck.active) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: windowCheck.reason,
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
