/**
 * Admin Lineups Parse API
 * POST /api/admin/lineups/parse
 *
 * Parses pasted HTML/text lineups using active open FMS rosters for matching.
 */

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { parseLineupsContent } from '@/lib/fmsrevo-lineup-parser';
import { teams } from '@/data/teams';
import { fetchOpenRosterPlayersForMatching } from '@/lib/roster-import';
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
            'SUPABASE_SECRET_KEY non configurata: impossibile abbinare i giocatori',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content : '';
    if (!content.trim()) {
      return NextResponse.json(
        { success: false, error: 'Contenuto vuoto' },
        { status: 400 }
      );
    }

    const { allPlayers, byTeamId, aliases, catalog } =
      await fetchOpenRosterPlayersForMatching();
    const fantasyTeams = teams.map((t) => ({ id: t.id, name: t.name }));
    const result = parseLineupsContent(
      content,
      allPlayers,
      fantasyTeams,
      byTeamId,
      aliases
    );

    return NextResponse.json({
      success: result.success,
      teams: result.teams,
      serieAMatchday: result.serieAMatchday,
      parseErrors: result.parseErrors,
      source: result.source,
      catalog,
    });
  } catch (error) {
    console.error('[API] Error parsing lineups:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Errore durante il parsing formazioni',
      },
      { status: 500 }
    );
  }
}
