import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import {
  upsertRoundLineupsViaRpc,
  type ImportedLineupInput,
} from '@/lib/lineups-db';
import { isSupabaseServerConfigured } from '@/lib/db/supabase';

export async function POST(request: Request) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: 'Non autorizzato' },
      { status: 401 }
    );
  }

  try {
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'SUPABASE_SECRET_KEY non configurata: impossibile persistere le formazioni',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const roundNumber = Number(body.roundNumber);
    const teams: ImportedLineupInput[] = body.teams || [];

    if (!Number.isFinite(roundNumber) || roundNumber < 1) {
      return NextResponse.json(
        { success: false, error: 'roundNumber non valido' },
        { status: 400 }
      );
    }

    if (!Array.isArray(teams) || teams.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nessuna formazione da importare' },
        { status: 400 }
      );
    }

    const result = await upsertRoundLineupsViaRpc(roundNumber, teams);

    return NextResponse.json({
      success: true,
      ...result,
      message: `Salvate ${result.lineupsSaved} formazioni per giornata ${roundNumber}`,
    });
  } catch (error) {
    console.error('[API] Error importing lineups:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Errore durante import formazioni',
      },
      { status: 500 }
    );
  }
}
