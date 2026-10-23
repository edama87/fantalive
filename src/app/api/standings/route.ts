import { NextResponse } from 'next/server';
import { calendar } from '@/data/calendar';
import { parseGiornata } from '@/lib/standings';
import { getStandingsAfterRound } from '@/lib/standings-server';

/** GET /api/standings?giornata=N -> classifica dopo la giornata N (default: ultima giocata). */
export async function GET(request: Request) {
  const giornata = parseGiornata(new URL(request.url).searchParams.get('giornata'), calendar.length);
  try {
    const data = await getStandingsAfterRound(giornata);
    return NextResponse.json(
      { round: data.round, maxRound: data.maxRound, partial: data.partial, isLive: data.isLive, standings: data.standings },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Classifica non disponibile' }, { status: 500 });
  }
}
