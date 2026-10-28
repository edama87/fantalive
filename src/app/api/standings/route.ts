import { NextResponse } from 'next/server';
import { calendar } from '@/data/calendar';
import { parseGiornata } from '@/lib/standings';
import { getStandingsAfterRound } from '@/lib/standings-server';

/** GET /api/standings?giornata=N -> classifica dopo la giornata N (default: ultima giocata). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const giornata = parseGiornata(params.get('giornata'), calendar.length);
  const simulate = params.get('sim') === '1';
  try {
    const data = await getStandingsAfterRound(giornata, { simulate });
    return NextResponse.json(
      { round: data.round, maxRound: data.maxRound, partial: data.partial, isLive: data.isLive, standings: data.standings },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Classifica non disponibile' }, { status: 500 });
  }
}
