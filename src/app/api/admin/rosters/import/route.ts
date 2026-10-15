import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import {
  validateTeamRoster,
  type ParsedTeamRoster,
} from '@/lib/fmsrevo-roster-parser';
import {
  importRostersViaRpc,
  readRosterDbCounts,
} from '@/lib/roster-import';
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
            'SUPABASE_SECRET_KEY non configurata: impossibile persistere le rose',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const teams: ParsedTeamRoster[] = body.teams;

    if (!teams || teams.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nessuna squadra da importare' },
        { status: 400 }
      );
    }

    const validations = teams.map((t) => validateTeamRoster(t));
    const invalid = validations.filter((v) => !v.ok);
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Conferma bloccata: una o più rose non sono valide (25 giocatori, 3/8/8/6).',
          issues: invalid
            .flatMap((v) => v.issues.map((i) => i.message))
            .slice(0, 20),
        },
        { status: 400 }
      );
    }

    const counts = await importRostersViaRpc(teams);
    const verified = await readRosterDbCounts();

    return NextResponse.json({
      success: true,
      imported: {
        teams: counts.importedTeams,
        players: counts.rosterPlayers,
      },
      counts: {
        ...counts,
        verified,
      },
      message: `Importati ${counts.rosterPlayers} posti rosa su ${counts.importedTeams} squadre (${verified.playersActive} giocatori attivi in DB)`,
    });
  } catch (error) {
    console.error('[API] Error importing rosters:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Errore durante import delle rose',
      },
      { status: 500 }
    );
  }
}
