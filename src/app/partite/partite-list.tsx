'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiveDot } from '@/components/ui/live-dot';
import { LinkPendingSpinner } from '@/components/ui/link-pending';
import type { FantacalcioCalendarMatch } from '@/lib/fantacalcio-it';

export function PartiteList({
  giornata,
  date,
  initialMatches,
  initialError,
}: {
  giornata: number;
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
                      <span className="text-gray-400 text-sm">vs</span>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-lg">
                          {match.homeScore} - {match.awayScore}
                        </span>
                        {match.status === 'live' && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <LiveDot size="sm" />
                            <span>{match.minute}&apos;</span>
                          </div>
                        )}
                        {match.status === 'halftime' && (
                          <span className="text-xs text-amber-600">Intervallo</span>
                        )}
                        {match.status === 'finished' && (
                          <span className="text-xs text-gray-400">Finita</span>
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
