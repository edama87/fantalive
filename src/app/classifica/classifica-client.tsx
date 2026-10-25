'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoundNav } from '@/components/layout/round-nav';
import { cn, formatVote } from '@/lib/utils';
import { calendar } from '@/data/calendar';
import { getTeamById } from '@/data/teams';
import { useMyTeamId } from '@/lib/hooks/use-my-team';
import { PositionChange } from '@/components/match/position-change';
import type { CumulativeStandingsEntry } from '@/lib/standings';
import type { StandingsAfterRound } from '@/lib/standings-server';
import type { FantasyMatchResult } from '@/types';

type View = 'classifica' | 'calendario';
const REFRESH_MS = 60000;

export function ClassificaClient({
  view,
  data,
  currentRound,
  calendarRound,
  totalRounds,
}: {
  view: View;
  data: StandingsAfterRound;
  currentRound: number;
  calendarRound: number;
  totalRounds: number;
}) {
  const router = useRouter();
  const myTeamId = useMyTeamId();

  // Giornata in corso: aggiorna i dati del server ogni minuto.
  useEffect(() => {
    if (view !== 'classifica' || !data.partial) return;
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [view, data.partial, router]);

  const tab = (v: View, label: string, round: number) => (
    <Link
      href={`/classifica?vista=${v}&giornata=${round}`}
      className={cn(
        'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
        view === v ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      <div className="flex items-center gap-2">
        {tab('classifica', 'Classifica', data.round || 1)}
        {tab('calendario', 'Calendario', view === 'calendario' ? calendarRound : data.round || currentRound)}
      </div>

      {view === 'classifica' ? (
        data.round === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            Nessuna giornata giocata finora.
          </p>
        ) : (
          <>
            <RoundNav selected={data.round} max={data.maxRound} current={currentRound} label={(n) => `Dopo la ${n}ª giornata`} />
            <StandingsTable standings={data.standings} round={data.round} partial={data.partial} myTeamId={myTeamId} />
            <RoundResults round={data.round} matches={data.matches} myTeamId={myTeamId} />
          </>
        )
      ) : (
        <>
          <RoundNav selected={calendarRound} max={totalRounds} current={currentRound} />
          <CalendarView round={calendarRound} myTeamId={myTeamId} />
        </>
      )}
    </>
  );
}

export function StandingsTable({
  standings,
  round,
  partial,
  myTeamId = null,
}: {
  standings: CumulativeStandingsEntry[];
  round: number;
  partial: boolean;
  myTeamId?: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">Classifica dopo la {round}ª giornata</h3>
          {partial && <Badge variant="live" className="text-[10px]">Parziale · in corso</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-xs">
                <th className="text-left py-2 w-12 pl-3.5">#</th>
                <th className="text-left py-2">Squadra</th>
                <th className="text-center py-2 w-8" title="Giocate">G</th>
                <th className="text-center py-2 w-8" title="Vinte">V</th>
                <th className="text-center py-2 w-8" title="Pareggiate">P</th>
                <th className="text-center py-2 w-8" title="Sconfitte">S</th>
                <th className="text-center py-2 w-10" title="Gol fatti">GF</th>
                <th className="text-center py-2 w-10" title="Gol subiti">GS</th>
                <th className="text-center py-2 w-10 font-bold" title="Punti">Pt</th>
                <th className="text-right py-2 w-16" title="Fantapunti totali">FP</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((e, idx) => {
                const mine = myTeamId !== null && e.teamId === myTeamId;
                return (
                  <tr key={e.teamId} className={cn('border-b border-gray-50', mine && 'bg-emerald-50')}>
                    <td className="py-2 pr-1 font-medium text-gray-600"><span className="flex items-center gap-1 tabular-nums"><PositionChange change={e.positionChange} />{idx + 1}</span></td>
                    <td className={cn('py-2', mine ? 'font-semibold text-emerald-700' : 'text-gray-900')}>
                      <div className="flex items-center gap-2">
                        <span className="truncate">{getTeamById(e.teamId)?.name || e.teamName}</span>
                        {mine && <Badge variant="userTeam" className="text-[10px]">Tu</Badge>}
                        {e.live && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" title="Sfida in corso" />}
                      </div>
                    </td>
                    <td className="py-2 text-center text-gray-600">{e.played}</td>
                    <td className="py-2 text-center text-gray-600">{e.won}</td>
                    <td className="py-2 text-center text-gray-600">{e.drawn}</td>
                    <td className="py-2 text-center text-gray-600">{e.lost}</td>
                    <td className="py-2 text-center text-gray-600">{e.goalsFor}</td>
                    <td className="py-2 text-center text-gray-600">{e.goalsAgainst}</td>
                    <td className={cn('py-2 text-center font-bold', mine ? 'text-emerald-700' : 'text-gray-900')}>{e.points}</td>
                    <td className="py-2 text-right text-gray-600">{formatVote(e.fantaTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          A parità di punti conta la somma dei fantapunti. {partial ? 'I risultati della giornata in corso sono stimati.' : ''}
        </p>
      </CardContent>
    </Card>
  );
}

function RoundResults({ round, matches, myTeamId }: { round: number; matches: FantasyMatchResult[]; myTeamId: string | null }) {
  if (!matches.length) return null;
  const statusLabel = (m: FantasyMatchResult) =>
    m.status === 'finished' ? 'Finale' : m.status === 'scheduled' ? 'Da giocare' : 'In corso';
  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="font-semibold text-gray-900">Risultati {round}ª giornata</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {matches.map((m) => {
            const mine = myTeamId !== null && (m.homeTeamId === myTeamId || m.awayTeamId === myTeamId);
            const hasLineups = m.homePlayerScores.length > 0 && m.awayPlayerScores.length > 0;
            const showScore = hasLineups && m.status !== 'scheduled';
            return (
              <li key={`${m.homeTeamId}-${m.awayTeamId}`}>
                <Link
                  href={`/sfida/${round}/${m.homeTeamId}-${m.awayTeamId}`}
                  className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg p-3 text-sm transition-colors hover:bg-emerald-50', mine ? 'bg-emerald-50' : 'bg-gray-50')}
                >
                  <span className="truncate text-gray-900">{getTeamById(m.homeTeamId)?.name}</span>
                  <span className="text-center">
                    <span className="block font-bold text-gray-900">{showScore ? `${m.homeGoals} - ${m.awayGoals}` : 'vs'}</span>
                    <span className="block text-[11px] text-gray-500">
                      {showScore ? `${formatVote(m.homeTotal)} · ${formatVote(m.awayTotal)}` : hasLineups ? statusLabel(m) : 'Formazioni non disponibili'}
                    </span>
                  </span>
                  <span className="truncate text-right text-gray-900">{getTeamById(m.awayTeamId)?.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export function CalendarView({ round: roundNumber, myTeamId = null }: { round: number; myTeamId?: string | null }) {
  const round = calendar.find((r) => r.number === roundNumber);
  if (!round) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{round.number}ª Giornata</h3>
          <span className="text-sm text-gray-500">Serie A {round.serieAMatchday}ª · {round.date}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {round.pairings.map((p) => {
            const mine = myTeamId !== null && (p.homeTeamId === myTeamId || p.awayTeamId === myTeamId);
            return (
              <Link key={`${p.homeTeamId}-${p.awayTeamId}`} href={`/sfida/${round.number}/${p.homeTeamId}-${p.awayTeamId}`}
                className={cn('flex items-center justify-between p-3 rounded-lg hover:bg-emerald-50', mine ? 'bg-emerald-50' : 'bg-gray-50')}>
                <span className={cn('flex-1', myTeamId === p.homeTeamId && 'font-semibold text-emerald-700')}>{getTeamById(p.homeTeamId)?.name}</span>
                <span className="px-3 text-gray-400">vs</span>
                <span className={cn('flex-1 text-right', myTeamId === p.awayTeamId && 'font-semibold text-emerald-700')}>{getTeamById(p.awayTeamId)?.name}</span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
