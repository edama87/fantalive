import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { fetchAllFMSRevoRosters } from '@/lib/fmsrevo-client';
import {
  EXPECTED_ROSTER_ROLES,
  EXPECTED_ROSTER_TOTAL,
} from '@/lib/fmsrevo-roster-parser';

export async function POST() {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
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
        allValid: false,
        rawHtmlSample: result.rawHtmlSample,
      });
    }

    const teamsSummary = result.teams.map((t) => ({
      fmsTeamId: t.fmsTeamId,
      teamName: t.teamName,
      playerCount: t.players.length,
      roleBreakdown: {
        P: t.players.filter((p) => p.role === 'P').length,
        D: t.players.filter((p) => p.role === 'D').length,
        C: t.players.filter((p) => p.role === 'C').length,
        A: t.players.filter((p) => p.role === 'A').length,
      },
      isValid: t.validation?.ok === true,
      issues: t.validation?.issues.map((i) => i.message) || [],
    }));

    return NextResponse.json({
      success: true,
      teams: result.teams,
      teamsSummary,
      allValid: result.allValid,
      canConfirm: result.allValid,
      expected: {
        total: EXPECTED_ROSTER_TOTAL,
        roles: EXPECTED_ROSTER_ROLES,
      },
      error: result.error,
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
