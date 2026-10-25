'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiveDot } from '@/components/ui/live-dot';
import { cn, formatVote } from '@/lib/utils';
import type { CumulativeStandingsEntry } from '@/lib/standings';
import { getTeamById } from '@/data/teams';
import { useMyTeamId } from '@/lib/hooks/use-my-team';
import { PositionChange } from '@/components/match/position-change';

interface LiveStandingsProps {
  standings: CumulativeStandingsEntry[];
  /** Giornata dopo la quale è calcolata la classifica. */
  round: number;
  /** Giornata ancora in corso: classifica parziale. */
  partial: boolean;
}

export function LiveStandings({ standings, round, partial }: LiveStandingsProps) {
  const myTeamId = useMyTeamId();
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Classifica dopo la {round}ª giornata</h3>
          {partial && (
            <Badge variant="live" className="text-[10px]">
              <LiveDot size="sm" className="mr-1" />
              Parziale
            </Badge>
          )}
        </div>

        <div className="flex items-center text-xs text-gray-500 pb-2 border-b border-gray-100">
          <span className="w-10 pl-3.5">Pos</span>
          <span className="flex-1">Squadra</span>
          <span className="w-8 text-center">G</span>
          <span className="w-10 text-center">Pt</span>
          <span className="w-14 text-right">FP</span>
        </div>

        {standings.map((entry, index) => {
          const isUserTeam = myTeamId !== null && entry.teamId === myTeamId;
          return (
            <div key={entry.teamId} className={cn('flex items-center py-2 text-sm', isUserTeam && 'bg-emerald-50 -mx-4 px-4 rounded-lg')}>
              <span className="flex w-10 items-center gap-1 font-medium text-gray-600"><PositionChange change={entry.positionChange} />{index + 1}</span>
              <span className={cn('flex-1 flex min-w-0 items-center gap-2', isUserTeam && 'font-semibold text-emerald-700')}>
                <span className="truncate">{getTeamById(entry.teamId)?.name || entry.teamName}</span>
                {isUserTeam && <Badge variant="userTeam" className="text-[10px]">Tu</Badge>}
                {entry.live && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" title="Sfida in corso" />}
              </span>
              <span className="w-8 text-center text-gray-500">{entry.played}</span>
              <span className={cn('w-10 text-center font-bold', isUserTeam ? 'text-emerald-700' : 'text-gray-900')}>{entry.points}</span>
              <span className="w-14 text-right text-gray-500">{formatVote(entry.fantaTotal)}</span>
            </div>
          );
        })}

        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
          <span>{partial ? 'Punteggi stimati finché non arrivano i voti ufficiali' : 'Pt: 3 vittoria, 1 pareggio'}</span>
          <Link href={`/classifica?giornata=${round}`} className="font-medium text-emerald-700 hover:underline">Classifica completa</Link>
        </div>
      </div>
    </Card>
  );
}
