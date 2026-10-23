import Link from 'next/link';
import { connection } from 'next/server';
import { Header } from '@/components/layout/header';
import { EventLegend } from '@/components/match/event-emoji';
import { substitutionsByPlayer } from '@/lib/serie-a-subs';
import { buildSerieAVoteRows } from '@/lib/serie-a-vote-rows';
import { TeamVotes } from './team-votes';
import { loadEspnSubstitutions } from '@/lib/serie-a-subs-loader';
import { loadConsolidatedMatchVotes } from '@/lib/consolidated-votes-loader';
import { ConsolidatedMark, VoteSourceLegend } from '@/components/match/vote-source';
import { loadFantacalcioMatchVotes } from '@/lib/fantacalcio-it-client';
import { calendar, getCurrentRound } from '@/data/calendar';
import { getServerClient } from '@/lib/db/supabase';
import { hasAnyVote, liveVotesToMatchPlayers, type LiveVoteRow } from '@/lib/live-vote-fallback';
import type { FantacalcioVotePlayer } from '@/lib/fantacalcio-it';

/** Voti live stimati (live_votes) della giornata fantacalcio corrispondente. */
async function loadLiveVoteRows(serieAMatchday: number): Promise<LiveVoteRow[]> {
  const round = calendar.find((r) => r.serieAMatchday === serieAMatchday);
  if (!round) return [];
  try {
    const { data } = await getServerClient()
      .from('live_votes')
      .select('estimated_vote, is_subbed_out, players(name, role, real_team)')
      .eq('round_number', round.number);
    return (data ?? []).map((row) => {
      const p = (Array.isArray(row.players) ? row.players[0] : row.players) as { name: string; role: string | null; real_team: string | null } | null;
      return {
        name: p?.name ?? '',
        role: p?.role ?? null,
        realTeam: p?.real_team ?? null,
        vote: row.estimated_vote == null ? null : Number(row.estimated_vote),
        isSubbedOut: row.is_subbed_out === true,
      };
    });
  } catch {
    return [];
  }
}

export const instant = false;

export default async function PartitaVotiPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ giornata?: string }>;
}) {
  await connection();
  const { matchId } = await params;
  const query = await searchParams;
  const giornata = Number(query.giornata) || getCurrentRound().serieAMatchday;
  const loaded = await loadFantacalcioMatchVotes(giornata, matchId);
  const { match } = loaded;
  let players: FantacalcioVotePlayer[] = loaded.players;
  // In partita fantacalcio.it non pubblica voti: si mostrano le stime live.
  let liveFallback = false;
  if (match && match.status !== 'scheduled' && !hasAnyVote(players)) {
    const live = liveVotesToMatchPlayers(await loadLiveVoteRows(giornata), match.homeTeam, match.awayTeam);
    if (live.length > 0) {
      players = live;
      liveFallback = true;
    }
  }

  const [espnSubs, consolidated] = match
    ? await Promise.all([loadEspnSubstitutions(match), loadConsolidatedMatchVotes(giornata, match.homeTeam, match.awayTeam)])
    : [[], null];
  const subs = substitutionsByPlayer(players, espnSubs);

  const homePlayers = players.filter((player) => match && player.team === match.homeTeam);
  const awayPlayers = players.filter((player) => match && player.team === match.awayTeam);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header isLive={match?.status === 'live' || match?.status === 'halftime'} />
      <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
        <Link href="/partite" className="text-sm text-emerald-700">
          Serie A
        </Link>
        {!match ? (
          <p className="text-gray-500">Partita non trovata in questa giornata.</p>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {match.homeTeam} {match.status === 'scheduled' ? 'vs' : `${match.homeScore}-${match.awayScore}`} {match.awayTeam}
              </h2>
              <p className="text-sm text-gray-500">Voti · Serie A {giornata}ª</p>
              {consolidated ? (
                <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  <ConsolidatedMark /> Voti consolidati · media Gazzetta, Corriere, Tuttosport
                </p>
              ) : liveFallback ? (
                <p className="mt-1 inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-xs italic text-red-700">
                  Voti live stimati · solo giocatori della lega · fantacalcio.it pubblica i voti a fine partita
                </p>
              ) : (
                <p className="mt-1 inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs italic text-gray-500">
                  Voti stimati fantacalcio.it · non ancora consolidati
                </p>
              )}
            </div>
            <TeamVotes title={match.homeTeam} rows={buildSerieAVoteRows(homePlayers, subs, consolidated)} />
            <TeamVotes title={match.awayTeam} rows={buildSerieAVoteRows(awayPlayers, subs, consolidated)} />
            <p className="text-center text-xs text-gray-400">Tocca un giocatore per i dettagli del voto</p>
            <EventLegend className="text-xs text-gray-500 pt-1" />
            <VoteSourceLegend />
          </>
        )}
      </div>
    </div>
  );
}
