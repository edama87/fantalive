import { Suspense } from 'react';
import { connection } from 'next/server';
import { cookies } from 'next/headers';
import { SIMULATION_COOKIE } from '@/lib/simulation';
import { Header } from '@/components/layout/header';
import { calendar } from '@/data/calendar';
import { getActiveRound, getClosedRounds } from '@/lib/active-round-server';
import { parseGiornata } from '@/lib/standings';
import { getStandingsAfterRound } from '@/lib/standings-server';
import { computeRoundMatches } from '@/lib/round-matches-server';
import { ClassificaClient } from './classifica-client';
import type { FantasyMatchResult } from '@/types';
import type { StandingsAfterRound } from '@/lib/standings-server';

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
  const simulate = (await cookies()).get(SIMULATION_COOKIE)?.value === '1';
  const calendarRound = giornata ?? currentRound;

  let data: StandingsAfterRound;
  let calendarMatches: FantasyMatchResult[] = [];

  if (view === 'classifica') {
    data = await getStandingsAfterRound(giornata, { simulate });
    // Prefetch giornate vicine in background (cache di processo).
    const focus = data.round;
    for (const n of [focus - 1, focus + 1]) {
      if (n >= 1 && n <= currentRound) {
        void computeRoundMatches(n, { simulate }).catch(() => null);
      }
    }
  } else {
    const bundle = await computeRoundMatches(calendarRound, { simulate }).catch(() => ({
      matches: [] as FantasyMatchResult[],
      isLive: false,
      closed: false,
    }));
    calendarMatches = bundle.matches;
    data = {
      round: currentRound,
      maxRound: currentRound,
      partial: false,
      closed: closedRounds.includes(currentRound),
      isLive: bundle.isLive,
      standings: [],
      matches: [],
    };
    for (const n of [calendarRound - 1, calendarRound + 1]) {
      if (n >= 1 && n <= calendar.length) {
        void computeRoundMatches(n, { simulate }).catch(() => null);
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header isLive={view === 'classifica' && data.isLive && data.round === currentRound} />
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <Suspense>
          <ClassificaClient
            view={view}
            data={data}
            currentRound={currentRound}
            currentClosed={closedRounds.includes(currentRound)}
            calendarRound={calendarRound}
            calendarMatches={calendarMatches}
            totalRounds={calendar.length}
            simulated={simulate}
          />
        </Suspense>
      </div>
    </div>
  );
}
