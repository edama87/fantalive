import { connection } from 'next/server';
import { calendar, getRoundByNumber } from '@/data/calendar';
import { getActiveRound } from '@/lib/active-round-server';
import { parseGiornata } from '@/lib/standings';
import {
  fantacalcioCalendarUrl,
  parseFantacalcioCalendar,
  type FantacalcioCalendarMatch,
} from '@/lib/fantacalcio-it';
import { fetchFantacalcioHtml } from '@/lib/fantacalcio-it-client';
import { withEspnClock } from '@/lib/serie-a-subs-loader';
import { PartiteList } from './partite-list';

export const instant = false;

export default async function PartiteSerieAPage({ searchParams }: { searchParams: Promise<{ giornata?: string }> }) {
  await connection();
  const liveRound = await getActiveRound();
  const giornata = parseGiornata((await searchParams).giornata, calendar.length);
  const currentRound = (giornata ? getRoundByNumber(giornata) : undefined) ?? liveRound;
  let matches: FantacalcioCalendarMatch[] = [];
  let error: string | null = null;

  try {
    const html = await fetchFantacalcioHtml(fantacalcioCalendarUrl(currentRound.serieAMatchday));
    matches = await withEspnClock(parseFantacalcioCalendar(html));
  } catch {
    error = 'Calendario non disponibile';
  }

  return (
    <PartiteList
      key={currentRound.number}
      roundNumber={currentRound.number}
      currentRound={liveRound.number}
      giornata={currentRound.serieAMatchday}
      date={currentRound.date}
      initialMatches={matches}
      initialError={error}
    />
  );
}
