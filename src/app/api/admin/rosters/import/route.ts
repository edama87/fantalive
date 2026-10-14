import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

interface RosterPlayer {
  name: string;
  role: 'P' | 'D' | 'C' | 'A';
  realTeam: string;
  price?: number;
}

interface TeamRoster {
  fmsTeamId: number;
  teamName: string;
  players: RosterPlayer[];
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('admin_session');
  
  if (!adminSession || adminSession.value !== 'authenticated') {
    return NextResponse.json(
      { success: false, error: 'Non autorizzato' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const teams: TeamRoster[] = body.teams;

    if (!teams || teams.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nessuna squadra da importare' },
        { status: 400 }
      );
    }

    const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);

    console.log('[API] Importing rosters:', {
      teamCount: teams.length,
      totalPlayers,
      teams: teams.map(t => ({ name: t.teamName, players: t.players.length })),
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
