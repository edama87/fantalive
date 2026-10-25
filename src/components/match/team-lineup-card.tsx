'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayerRow } from '@/components/match/player-row';
import { cn, formatVote } from '@/lib/utils';
import type { PlayerScore } from '@/types';
import { benchList } from '@/lib/bench-list';
import { fixtureForTeam, type RoundFixture } from '@/lib/serie-a-fixtures';
import { useState } from 'react';
import { ChevronDown, Home, Plane } from 'lucide-react';

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
  // Panchina completa: non entrati più chi è entrato al posto di un titolare
  // (mostrato anche qui, segnato come entrato), nell'ordine originale della panchina.
  const bench = benchList(playerScores);
  const [benchOpen, setBenchOpen] = useState(false);
  // Il titolare sostituito ha fantavoto 0: la somma resta quella dei soli che contano.
  const total = onField.reduce((sum, ps) => sum + (ps.substitutedBy ? 0 : ps.fantavoto), 0);

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
            {formatVote(total)}
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
            <button
              type="button"
              onClick={() => setBenchOpen((o) => !o)}
              aria-expanded={benchOpen}
              className="flex w-full items-center px-3 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase"
            >
              Panchina ({bench.length})
              <ChevronDown size={14} className={cn('ml-auto text-gray-400 transition-transform', benchOpen && 'rotate-180')} aria-hidden />
            </button>
            {benchOpen && <div className="divide-y divide-gray-100">
              {bench.map(ps => (
                <PlayerRow
                  key={`bench-${ps.player.id}`}
                  playerScore={ps}
                  isSubstitute
                  fixture={fixtureForTeam(fixtures, ps.player.realTeam)}
                />
              ))}
            </div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

