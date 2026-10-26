import { Suspense } from 'react';
import { connection } from 'next/server';
import { Header } from '@/components/layout/header';
import { calendar } from '@/data/calendar';
import { getActiveRound, getClosedRounds } from '@/lib/active-round-server';
import { parseGiornata } from '@/lib/standings';
import { getStandingsAfterRound } from '@/lib/standings-server';
import { ClassificaClient } from './classifica-client';

export const instant = false;

export default async function ClassificaPage({
  searchParams,
}: {
  searchParams: Promise<{ giornata?: string; vista?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const view = params.vista === 'calendario' ? 'calendario' : 'classifica';
  const giornata = parseGiornata(params.giornata, calendar.length);
  const [active, closedRounds] = await Promise.all([getActiveRound(), getClosedRounds()]);
  const currentRound = active.number;

  // Calendario: tutte le giornate; classifica: fino a quella in corso.
  const data = await getStandingsAfterRound(view === 'classifica' ? giornata : null);
  const calendarRound = giornata ?? currentRound;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header isLive={data.isLive && data.round === currentRound} />
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <Suspense>
          <ClassificaClient
            view={view}
            data={data}
            currentRound={currentRound}
            currentClosed={closedRounds.includes(currentRound)}
            calendarRound={calendarRound}
            totalRounds={calendar.length}
          />
        </Suspense>
      </div>
    </div>
  );
}
