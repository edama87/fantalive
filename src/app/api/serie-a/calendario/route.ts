import { connection, NextRequest, NextResponse } from 'next/server';
import { fantacalcioCalendarUrl, parseFantacalcioCalendar } from '@/lib/fantacalcio-it';
import { fetchFantacalcioHtml } from '@/lib/fantacalcio-it-client';
import { withEspnClock } from '@/lib/serie-a-subs-loader';

export async function GET(request: NextRequest) {
  await connection();
  const matchday = Number(request.nextUrl.searchParams.get('giornata'));
  if (!Number.isFinite(matchday) || matchday < 1) {
    return NextResponse.json({ error: 'Giornata non valida' }, { status: 400 });
  }

  try {
    const html = await fetchFantacalcioHtml(fantacalcioCalendarUrl(matchday));
    const matches = await withEspnClock(parseFantacalcioCalendar(html));
    return NextResponse.json({ giornata: matchday, matches });
  } catch (error) {
    console.error('[API] Calendario fantacalcio.it:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Calendario non disponibile' },
      { status: 502 }
    );
  }
}
