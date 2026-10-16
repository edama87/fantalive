import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getRoundByNumber } from '@/data/calendar';
import {
  loadFantacalcioCatalog,
  scrapeFantacalcioMatchday,
} from '@/lib/fantacalcio-it-client';

export const maxDuration = 60;

export async function POST(request: Request) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
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

    return NextResponse.json({
      success: true,
      roundNumber: round.number,
      serieAMatchday: round.serieAMatchday,
      matches: matchday.matches,
      players: matchday.players.map((player) => ({
        matchId: player.matchId,
        team: player.team,
        name: player.name,
        role: player.role,
        vote: player.vote,
        fantaVote: player.fantaVote,
        bonuses: player.bonuses,
        substitutedOut: player.substitutedOut,
        playerId: player.playerId,
        matchedName: player.matchedName,
      })),
      unmatched: matchday.unmatched.map((player) => ({
        matchId: player.matchId,
        team: player.team,
        name: player.name,
        role: player.role,
        vote: player.vote,
      })),
    });
  } catch (error) {
    console.error('[API] Anteprima voti fantacalcio.it:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore durante la lettura dei voti',
      },
      { status: 500 }
    );
  }
}
