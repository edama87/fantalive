'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LiveDot } from '@/components/ui/live-dot';
import { cn } from '@/lib/utils';
import { romeKickoff, type RoundFixture } from '@/lib/serie-a-fixtures';

function statusText(fixture: RoundFixture): string {
  switch (fixture.status) {
    case 'finished':
      return 'finita';
    case 'halftime':
      return 'intervallo';
    case 'live':
      return fixture.minute ? `${fixture.minute}′` : 'in corso';
    default:
      return fixture.kickoffTime ? romeKickoff(fixture.kickoffTime) : 'da giocare';
  }
}

/** Partite di Serie A della giornata (colonna laterale su tablet/desktop). */
export function SerieAFixturesCard({
  fixtures,
  highlightTeams = [],
  className,
}: {
  fixtures: RoundFixture[];
  /** Squadre di Serie A dei propri giocatori, evidenziate. */
  highlightTeams?: string[];
  className?: string;
}) {
  const highlight = new Set(highlightTeams.map((t) => t.toUpperCase()));
  const sorted = [...fixtures].sort((a, b) => (a.kickoffTime ?? '').localeCompare(b.kickoffTime ?? ''));
  return (
    <Card className={className}>
      <CardHeader>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Partite Serie A</h3>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400">Calendario non ancora disponibile</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sorted.map((fixture) => {
              const started = fixture.status !== 'scheduled';
              const live = fixture.status === 'live' || fixture.status === 'halftime';
              const mine = highlight.has(fixture.homeCode) || highlight.has(fixture.awayCode);
              return (
                <li key={fixture.matchId} className="flex items-center gap-3 py-2 text-sm">
                  <span className={cn('flex-1 min-w-0 truncate', mine ? 'font-medium text-gray-900' : 'text-gray-600')}>
                    {fixture.homeTeam} – {fixture.awayTeam}
                  </span>
                  {started && (
                    <span className="tabular-nums font-semibold text-gray-900">
                      {fixture.homeScore}-{fixture.awayScore}
                    </span>
                  )}
                  <span
                    className={cn(
                      'w-20 text-right text-xs flex items-center justify-end gap-1',
                      live ? 'text-green-600 font-medium' : 'text-gray-400'
                    )}
                  >
                    {live && <LiveDot />}
                    {statusText(fixture)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
