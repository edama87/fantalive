import { NextResponse } from 'next/server';
import {
  fetchLineupsForRound,
  fetchPlayersByIds,
  playerIdsFromLineups,
} from '@/lib/lineups-db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roundParam = searchParams.get('round');
    const roundNumber = roundParam ? Number.parseInt(roundParam, 10) : NaN;

    if (!Number.isFinite(roundNumber) || roundNumber < 1) {
      return NextResponse.json(
        { success: false, error: 'Parametro round obbligatorio' },
        { status: 400 }
      );
    }

    const lineups = await fetchLineupsForRound(roundNumber);
    const players = await fetchPlayersByIds(playerIdsFromLineups(lineups));
    return NextResponse.json({
      success: true,
      roundNumber,
      lineups,
      players,
      count: Object.keys(lineups).length,
    });
  } catch (error) {
    console.error('[API] Error fetching lineups:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Errore nel caricamento formazioni',
      },
      { status: 500 }
    );
  }
}
