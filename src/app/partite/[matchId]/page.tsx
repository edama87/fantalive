import Link from 'next/link';
import { connection } from 'next/server';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { loadFantacalcioMatchVotes } from '@/lib/fantacalcio-it-client';
import { getCurrentRound } from '@/data/calendar';

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
  const { match, players } = await loadFantacalcioMatchVotes(giornata, matchId);

  const homePlayers = players.filter((player) => match && player.team === match.homeTeam);
  const awayPlayers = players.filter((player) => match && player.team === match.awayTeam);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header isLive={match?.status === 'live' || match?.status === 'halftime'} />
      <div className="px-4 py-4 space-y-4">
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
            </div>
            <TeamVotes title={match.homeTeam} players={homePlayers} />
            <TeamVotes title={match.awayTeam} players={awayPlayers} />
          </>
        )}
      </div>
    </div>
  );
}

function TeamVotes({
  title,
  players,
}: {
  title: string;
  players: Array<{
    name: string;
    role: string | null;
    vote: number | null;
    fantaVote: number | null;
    bonuses: Array<{ label: string; count: number }>;
    substitutedOut: boolean;
  }>;
}) {
  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="font-medium text-gray-900">{title}</div>
        {players.length === 0 && <p className="text-sm text-gray-400">Nessun voto</p>}
        {players.map((player) => (
          <div key={`${title}-${player.name}`} className="flex items-start justify-between gap-3 text-sm">
            <div>
              <div className="text-gray-900">
                {player.name}
                {player.substitutedOut && <span className="text-gray-400"> · esce</span>}
              </div>
              <div className="text-xs text-gray-400">
                {player.role}
                {player.bonuses.length > 0 &&
                  ` · ${player.bonuses.map((bonus) => `${bonus.label}${bonus.count > 1 ? ` x${bonus.count}` : ''}`).join(', ')}`}
              </div>
            </div>
            <div className="text-right">
              <Badge>{player.vote ?? '-'}</Badge>
              <div className="text-[10px] text-gray-400 mt-1">FV {player.fantaVote ?? '-'}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
