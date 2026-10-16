import { connection } from 'next/server';
import { getCurrentRound } from '@/data/calendar';
import {
  fantacalcioCalendarUrl,
  parseFantacalcioCalendar,
  type FantacalcioCalendarMatch,
} from '@/lib/fantacalcio-it';
import { fetchFantacalcioHtml } from '@/lib/fantacalcio-it-client';
import { PartiteList } from './partite-list';

export const instant = false;

export default async function PartiteSerieAPage() {
  await connection();
  const currentRound = getCurrentRound();
  let matches: FantacalcioCalendarMatch[] = [];
  let error: string | null = null;

  try {
    const html = await fetchFantacalcioHtml(fantacalcioCalendarUrl(currentRound.serieAMatchday));
    matches = parseFantacalcioCalendar(html);
  } catch {
    error = 'Calendario non disponibile';
  }

  return (
    <PartiteList
      giornata={currentRound.serieAMatchday}
      date={currentRound.date}
      initialMatches={matches}
      initialError={error}
    />
  );
}
