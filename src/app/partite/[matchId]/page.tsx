import Link from 'next/link';
import { connection } from 'next/server';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { EventEmojis, EventLegend } from '@/components/match/event-emoji';
import type { FantacalcioVotePlayer } from '@/lib/fantacalcio-it';
import { fantacalcioBonusBreakdown, substitutionsByPlayer, type PlayerSubInfo } from '@/lib/serie-a-subs';
import { loadEspnSubstitutions } from '@/lib/serie-a-subs-loader';
import { loadConsolidatedMatchVotes } from '@/lib/consolidated-votes-loader';
import { samePianetafantaName, type ConsolidatedVoteEntry } from '@/lib/pianetafanta-url';
import { ConsolidatedMark, CONSOLIDATED_TITLE, ESTIMATED_TITLE, VoteSourceLegend } from '@/components/match/vote-source';
import { fantavotoFromVote } from '@/lib/fantacalcio-it';
import { formatNumber, formatVote } from '@/lib/utils';
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
              ) : (
                <p className="mt-1 inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs italic text-gray-500">
                  Voti stimati fantacalcio.it · non ancora consolidati
                </p>
              )}
            </div>
            <TeamVotes title={match.homeTeam} players={homePlayers} subs={subs} consolidated={consolidated} />
            <TeamVotes title={match.awayTeam} players={awayPlayers} subs={subs} consolidated={consolidated} />
            <EventLegend className="text-xs text-gray-500 pt-1" />
            <VoteSourceLegend />
          </>
        )}
      </div>
    </div>
  );
}

function TeamVotes({
  title,
  players,
  subs,
  consolidated,
}: {
  title: string;
  players: FantacalcioVotePlayer[];
  subs: Map<string, PlayerSubInfo>;
  consolidated: ConsolidatedVoteEntry[] | null;
}) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="font-semibold text-gray-900 pb-2 border-b border-gray-100">{title}</div>
        {players.length === 0 && <p className="text-sm text-gray-400 pt-2">Nessun voto</p>}
        <ul className="divide-y divide-gray-100">
          {players.map((player) => {
            const sub = subs.get(`${player.team}|${player.name}`);
            const official = consolidated ? findConsolidated(consolidated, player) : null;
            const vote = official ? official.average : player.vote;
            const fantaVote = official
              ? official.average == null ? null : fantavotoFromVote(official.average, player.bonuses)
              : player.fantaVote;
            const estimated = !official && vote != null;
            return (
              <li
                key={`${title}-${player.name}`}
                className={`flex items-center justify-between gap-3 py-2 text-sm ${sub?.in ? 'pl-3 border-l-2 border-emerald-200' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] font-semibold text-gray-500">
                      {player.role ?? '–'}
                    </span>
                    <span className="font-medium text-gray-900">{player.name}</span>
                    <EventEmojis bonuses={fantacalcioBonusBreakdown(player.bonuses)} />
                  </div>
                  {official && official.average != null && (
                    <div className="mt-0.5 pl-7 text-[11px] text-gray-400 tabular-nums">
                      G {fmt(official.votes.gazzetta)} · CS {fmt(official.votes.corriere)} · TS {fmt(official.votes.tuttosport)}
                    </div>
                  )}
                  {(sub?.in || sub?.out) && (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 pl-7 text-xs">
                      {sub.in && <SubMarker kind="in" minute={sub.in.minute} />}
                      {sub.out && <SubMarker kind="out" minute={sub.out.minute} />}
                    </div>
                  )}
                </div>
                <div
                  className="flex shrink-0 items-center gap-2 text-right"
                  title={official ? CONSOLIDATED_TITLE : estimated ? ESTIMATED_TITLE : undefined}
                >
                  <div className="w-4">{official && official.average != null && <ConsolidatedMark />}</div>
                  <div className="w-11">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">Voto</div>
                    <div className={`font-semibold text-gray-700 tabular-nums ${estimated ? 'italic' : ''}`}>
                      {vote != null ? formatVote(vote) : 's.v.'}
                    </div>
                  </div>
                  <div className="w-11">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">FV</div>
                    <div className={`font-bold text-gray-900 tabular-nums ${estimated ? 'italic' : ''}`}>
                      {fantaVote != null ? formatNumber(fantaVote) : '–'}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

const fmt = (value: number | null) => (value == null ? 's.v.' : formatVote(value));

function findConsolidated(entries: ConsolidatedVoteEntry[], player: FantacalcioVotePlayer): ConsolidatedVoteEntry | null {
  const sameTeam = entries.filter((entry) => entry.team.toLowerCase() === player.team.toLowerCase());
  const pool = sameTeam.length > 0 ? sameTeam : entries;
  const hits = pool.filter((entry) => samePianetafantaName(entry.name, player.name));
  return hits.length === 1 ? hits[0] : null;
}

function SubMarker({ kind, minute }: { kind: 'in' | 'out'; minute: number | null }) {
  const label = `${kind === 'in' ? 'entrato' : 'uscito'}${minute != null ? ` ${minute}′` : ''}`;
  return kind === 'in' ? (
    <span className="inline-flex items-center gap-0.5 font-medium text-emerald-600">
      <ArrowUp aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
      {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 font-medium text-red-600">
      <ArrowDown aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
      {label}
    </span>
  );
}
