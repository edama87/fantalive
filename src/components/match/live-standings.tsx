'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiveDot } from '@/components/ui/live-dot';
import { cn, formatVote } from '@/lib/utils';
import { LiveStandingsEntry } from '@/types';
import { getTeamById } from '@/data/teams';
import { useMyTeamId } from '@/lib/hooks/use-my-team';

interface LiveStandingsProps {
  standings: LiveStandingsEntry[];
}

export function LiveStandings({ standings }: LiveStandingsProps) {
  const myTeamId = useMyTeamId();
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Classifica live</h3>
          <Badge variant="live" className="text-[10px]">
            <LiveDot size="sm" className="mr-1" />
            Tempo reale
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Calcolata in tempo reale
        </p>

        <div className="space-y-0">
          <div className="flex items-center text-xs text-gray-500 pb-2 border-b border-gray-100">
            <span className="w-8">Pos</span>
            <span className="flex-1">Squadra</span>
            <span className="w-8 text-center">Pt Fantapunti</span>
          </div>

          {standings.map((entry, index) => {
            const team = getTeamById(entry.teamId);
            const isUserTeam = myTeamId !== null && entry.teamId === myTeamId;
            const isRising = entry.liveFantaPoints > entry.fantaPoints;
            const isFalling = entry.liveFantaPoints < entry.fantaPoints;

            return (
              <div
                key={entry.teamId}
                className={cn(
                  'flex items-center py-2 text-sm',
                  isUserTeam && 'bg-emerald-50 -mx-4 px-4 rounded-lg'
                )}
              >
                <span className="w-8 font-medium text-gray-600 flex items-center gap-1">
                  {index + 1}
                  {isRising && <span className="text-green-500 text-xs">▲</span>}
                  {isFalling && <span className="text-red-500 text-xs">▼</span>}
                </span>
                <span className={cn(
                  'flex-1 flex items-center gap-2',
                  isUserTeam && 'font-semibold text-emerald-700'
                )}>
                  {team?.name || entry.teamName}
                  {isUserTeam && (
                    <Badge variant="userTeam" className="text-[10px]">Tu</Badge>
                  )}
                </span>
                <span className="w-8 text-center text-gray-500">
                  {entry.currentMatchResult?.fantaPoints ?? 0}
                </span>
                <span className={cn(
                  'w-12 text-right font-semibold',
                  isUserTeam ? 'text-emerald-700' : 'text-gray-900'
                )}>
                  {formatVote(entry.liveFantaPoints)}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Punteggi stimati: i voti ufficiali arrivano a fine giornata
        </p>
      </div>
    </Card>
  );
}
