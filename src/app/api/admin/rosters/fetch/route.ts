import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchAllFMSRevoRosters } from '@/lib/fmsrevo-client';

export async function POST() {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('admin_session');
  
  if (!adminSession || adminSession.value !== 'authenticated') {
    return NextResponse.json(
      { success: false, error: 'Non autorizzato' },
      { status: 401 }
    );
  }

  try {
    const result = await fetchAllFMSRevoRosters();
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        rawHtmlSample: result.rawHtmlSample,
      });
    }

    const teamsSummary = result.teams.map(t => ({
      fmsTeamId: t.fmsTeamId,
      teamName: t.teamName,
      playerCount: t.players.length,
      roleBreakdown: {
        P: t.players.filter(p => p.role === 'P').length,
        D: t.players.filter(p => p.role === 'D').length,
        C: t.players.filter(p => p.role === 'C').length,
        A: t.players.filter(p => p.role === 'A').length,
      },
    }));

    return NextResponse.json({
      success: true,
      teams: result.teams,
      teamsSummary,
      rawHtmlSample: result.rawHtmlSample?.substring(0, 2000),
    });

  } catch (error) {
    console.error('[API] Error fetching rosters:', error);
    return NextResponse.json(
      { success: false, error: 'Errore interno nel recupero delle rose' },
      { status: 500 }
    );
  }
}
