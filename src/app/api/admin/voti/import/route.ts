import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getRoundByNumber } from '@/data/calendar';
import { isSupabaseServerConfigured } from '@/lib/db/supabase';
import {
  loadFantacalcioCatalog,
  scrapeFantacalcioMatchday,
} from '@/lib/fantacalcio-it-client';
import { saveFantacalcioOfficialVotes } from '@/lib/official-votes';

export const maxDuration = 60;

export async function POST(request: Request) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { success: false, error: 'SUPABASE_SECRET_KEY non configurata' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const roundNumber = Number(body.roundNumber);
    const round = getRoundByNumber(roundNumber);
    if (!round) {
      return NextResponse.json(
        { success: false, error: 'Giornata non valida' },
        { status: 400 }
      );
    }

    const catalog = await loadFantacalcioCatalog();
    const matchday = await scrapeFantacalcioMatchday(round.serieAMatchday, catalog);
    const result = await saveFantacalcioOfficialVotes(round.number, matchday.players);

    return NextResponse.json({
      success: true,
      roundNumber: round.number,
      serieAMatchday: round.serieAMatchday,
      saved: result.saved,
      unmatched: matchday.unmatched.length,
      message: `Salvati ${result.saved} voti per la giornata ${round.number}`,
    });
  } catch (error) {
    console.error('[API] Import voti fantacalcio.it:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore durante il salvataggio dei voti',
      },
      { status: 500 }
    );
  }
}
