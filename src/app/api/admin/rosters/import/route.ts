import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import {
  validateTeamRoster,
  type ParsedTeamRoster,
} from '@/lib/fmsrevo-roster-parser';

export async function POST(request: Request) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: 'Non autorizzato' },
      { status: 401 }
    );
  }

  try {
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
          error: 'Conferma bloccata: una o più rose non sono valide (25 giocatori, 3/8/8/6).',
          issues: invalid.flatMap((v) => v.issues.map((i) => i.message)).slice(0, 20),
        },
        { status: 400 }
      );
    }

    const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);

    console.log('[API] Importing rosters:', {
      teamCount: teams.length,
      totalPlayers,
      teams: teams.map((t) => ({ name: t.teamName, players: t.players.length })),
    });

    return NextResponse.json({
      success: true,
      imported: {
        teams: teams.length,
        players: totalPlayers,
      },
      message: `Importati ${totalPlayers} giocatori da ${teams.length} squadre`,
    });
  } catch (error) {
    console.error('[API] Error importing rosters:', error);
    return NextResponse.json(
      { success: false, error: 'Errore durante import delle rose' },
      { status: 500 }
    );
  }
}
