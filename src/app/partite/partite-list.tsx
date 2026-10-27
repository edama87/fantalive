'use client';

import { RoundNav } from '@/components/layout/round-nav';
import { calendar } from '@/data/calendar';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiveDot } from '@/components/ui/live-dot';
import { LinkPendingSpinner } from '@/components/ui/link-pending';
import { matchClockText } from '@/lib/match-clock';
import type { FantacalcioCalendarMatch } from '@/lib/fantacalcio-it';
import { kickoffLabel } from '@/lib/kickoff-label';


export function PartiteList({
  giornata,
  roundNumber,
  currentRound,
  currentClosed = false,
  date,
  initialMatches,
  initialError,
}: {
  giornata: number;
  /** Giornata del fantacalcio (per la navigazione ?giornata=N). */
  roundNumber: number;
  currentRound: number;
  currentClosed?: boolean;
  date: string;
  initialMatches: FantacalcioCalendarMatch[];
  initialError: string | null;
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [error, setError] = useState(initialError);
  const isLive = matches.some((match) => match.status === 'live' || match.status === 'halftime');

  useEffect(() => {
    const refresh = async () => {
      const response = await fetch(`/api/serie-a/calendario?giornata=${giornata}`);
      if (!response.ok) {
        setError('Calendario non disponibile');
        return;
      }
      const data = await response.json();
      setMatches(data.matches ?? []);
      setError(null);
    };
    const interval = setInterval(() => {
      void refresh();
    }, 60000);
    return () => clearInterval(interval);
  }, [giornata]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header isLive={isLive} />
      <div className="px-4 py-4 space-y-4">
      <Suspense>
        <RoundNav selected={roundNumber} max={calendar.length} current={currentRound} currentClosed={currentClosed} />
      </Suspense>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Partite Serie A</h2>
          <p className="text-sm text-gray-500">
            {giornata}ª giornata · {date}
          </p>
        </div>
        {isLive && (
          <Badge variant="live">
            <LiveDot size="sm" className="mr-1" />
            Live
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {matches.map((match) => (
          <Link
            key={match.matchId}
            href={`/partite/${match.matchId}?giornata=${giornata}`}
            className="block"
          >
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 font-medium text-gray-900">{match.homeTeam}</div>
                  <div className="px-4 text-center">
                    {match.status === 'scheduled' ? (
                      <div className="flex flex-col items-center">
                        <span className="text-gray-400 text-sm">vs</span>
                        {kickoffLabel(match.kickoffTime) && (
                          <span className="text-xs text-gray-500 whitespace-nowrap">{kickoffLabel(match.kickoffTime)}</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-lg">
                          {match.homeScore} - {match.awayScore}
                        </span>
                        {match.status === 'live' && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <LiveDot size="sm" />
                            <span>{matchClockText(match)}</span>
                          </div>
                        )}
                        {match.status === 'halftime' && (
                          <span className="text-xs text-amber-600">Intervallo</span>
                        )}
                        {match.status === 'finished' && (
                          <span className="text-xs text-gray-400">Finale</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-right font-medium text-gray-900">{match.awayTeam}</div>
                </div>
                <div className="mt-1 flex items-center justify-end gap-1 text-xs text-emerald-700">
                  <LinkPendingSpinner size={12} />
                  Voti
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {error && <div className="text-center py-8 text-gray-500">{error}</div>}
      {!error && matches.length === 0 && (
        <div className="text-center py-8 text-gray-500">Nessuna partita disponibile</div>
      )}
      </div>
    </div>
  );
}
