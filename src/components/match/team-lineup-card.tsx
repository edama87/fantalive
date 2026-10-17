'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayerRow } from '@/components/match/player-row';
import { cn, formatNumber } from '@/lib/utils';
import type { PlayerScore } from '@/types';
import { fixtureForTeam, type RoundFixture } from '@/lib/serie-a-fixtures';
import { Home, Plane } from 'lucide-react';

export function TeamLineupCard({
  title,
  isUserTeam,
  playerScores,
  isHome,
  fixtures = [],
}: {
  title: string;
  isUserTeam: boolean;
  playerScores: PlayerScore[];
  isHome: boolean;
  /** Partite di Serie A della giornata, per mostrare squadra e stato partita. */
  fixtures?: RoundFixture[];
}) {
  // On field: original starters + substitutes who entered (status != to_play)
  const onField = playerScores.filter(
    (ps) => !ps.isUnusedBench && (ps.isStarter || ps.status !== 'to_play')
  );
  // Remaining bench: unused substitutes
  const bench = playerScores.filter(
    (ps) => ps.isUnusedBench || (!ps.isStarter && ps.status === 'to_play')
  );
  const total = onField.reduce((sum, ps) => sum + ps.fantavoto, 0);

  return (
    <Card className={cn(isUserTeam && 'ring-1 ring-emerald-200')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isHome ? <Home size={16} className="text-gray-400" /> : <Plane size={16} className="text-gray-400" />}
            <h3 className={cn(
              'font-semibold',
              isUserTeam ? 'text-emerald-700' : 'text-gray-900'
            )}>
              {title}
            </h3>
            {isUserTeam && (
              <Badge variant="userTeam" className="text-[10px]">Tu</Badge>
            )}
          </div>
          <span className="font-bold text-lg">
            {formatNumber(total)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-100">
          {onField.map(ps => (
            <PlayerRow
              key={ps.player.id}
              playerScore={ps}
              isSubstitute={!ps.isStarter}
              fixture={fixtureForTeam(fixtures, ps.player.realTeam)}
            />
          ))}
        </div>
        {bench.length > 0 && (
          <>
            <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
              Panchina ({bench.length})
            </div>
            <div className="divide-y divide-gray-100">
              {bench.map(ps => (
                <PlayerRow
                  key={ps.player.id}
                  playerScore={ps}
                  isSubstitute
                  fixture={fixtureForTeam(fixtures, ps.player.realTeam)}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

