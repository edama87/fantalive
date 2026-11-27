/**
 * Admin Lineups Fetch API Route
 * POST /api/admin/lineups/fetch
 * 
 * Fetches lineups from FMS Revo for a given fantasy round.
 * Admin-only: requires valid admin session cookie.
 * 
 * Body: { roundNumber: number }
 * 
 * Uses FMSREVO_USERNAME and FMSREVO_PASSWORD env vars (server-only).
 * FMS Revo returns a PDF with lineup data, which we parse server-side.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getRoundByNumber } from '@/data/calendar';
import { fetchFMSRevoLineups } from '@/lib/fmsrevo-client';
import { isPDFContent, parseFMSRevoPDF, convertPDFResultToLineupResult } from '@/lib/fmsrevo-pdf-parser';
import { parseLineupsContent } from '@/lib/fmsrevo-lineup-parser';
import { teams } from '@/data/teams';
import { fetchOpenRosterPlayersForMatching } from '@/lib/roster-import';
import { isSupabaseServerConfigured } from '@/lib/db/supabase';
import { fetchLatestLineupsBefore } from '@/lib/lineups-db';
import { lineupsHaveSamePlayers } from '@/lib/lineup-utils';
import type { ParsedTeamLineup } from '@/lib/fmsrevo-lineup-parser';


async function annotateIdenticalToPrevious(
  roundNumber: number,
  teams: ParsedTeamLineup[]
): Promise<ParsedTeamLineup[]> {
  const ids = teams
    .map((team) => team.matchedTeamId)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return teams;
  let previous: Awaited<ReturnType<typeof fetchLatestLineupsBefore>> = {};
  try {
    previous = await fetchLatestLineupsBefore(ids, roundNumber);
  } catch (error) {
    console.error('[Admin Lineups] confronto con giornata precedente non disponibile', error);
    return teams;
  }
  return teams.map((team) => {
    if (!team.matchedTeamId || !team.hasLineup) return team;
    const prev = previous[team.matchedTeamId];
    if (!prev) return team;
    const current = {
      teamId: team.matchedTeamId,
      roundNumber,
      formation: team.formation || prev.formation,
      starters: team.starters
        .filter((s) => s.matchedPlayerId)
        .map((s, i) => ({ playerId: s.matchedPlayerId!, position: s.position ?? i })),
      bench: team.bench
        .filter((s) => s.matchedPlayerId)
        .map((s, i) => ({ playerId: s.matchedPlayerId!, position: s.position ?? i })),
    };
    if (!lineupsHaveSamePlayers(current, prev)) return team;
    return {
      ...team,
      identicalToPrevious: true,
      previousRound: prev.roundNumber,
      warnings: [
        ...team.warnings,
        `Identica alla giornata ${prev.roundNumber}: potrebbe essere una ripresa automatica (malus −3)`,
      ],
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { roundNumber } = body;

    if (!roundNumber || typeof roundNumber !== 'number') {
      return NextResponse.json(
        { error: 'roundNumber is required' },
        { status: 400 }
      );
    }

    const round = getRoundByNumber(roundNumber);
    if (!round) {
      return NextResponse.json(
        { error: `Round ${roundNumber} not found` },
        { status: 404 }
      );
    }

    const serieAMatchday = round.serieAMatchday;

    const result = await fetchFMSRevoLineups(serieAMatchday);

    if (!result.success || !result.data) {
      const errorMessage = result.error || 'Errore sconosciuto';
      
      let statusCode = 500;
      if (errorMessage.includes('Credenziali') && errorMessage.includes('errate')) {
        statusCode = 401;
      } else if (errorMessage.includes('non configurate')) {
        statusCode = 503;
      } else if (errorMessage.includes('non raggiungibile')) {
        statusCode = 502;
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }

    if (!isSupabaseServerConfigured()) {
      return NextResponse.json(
        {
          error:
            'SUPABASE_SECRET_KEY non configurata: impossibile abbinare i giocatori alle rose FMS',
        },
        { status: 503 }
      );
    }

    const { allPlayers, byTeamId, aliases, catalog } =
      await fetchOpenRosterPlayersForMatching();
    const fantasyTeams = teams.map(t => ({ id: t.id, name: t.name }));

    if (isPDFContent(result.data)) {
      console.log('[Admin Lineups] Parsing PDF response');
      
      const pdfResult = await parseFMSRevoPDF(result.data, fantasyTeams);
      
      if (!pdfResult.success) {
        return NextResponse.json(
          { 
            error: pdfResult.message || 'Errore parsing PDF',
            isPDF: true,
          },
          { status: 500 }
        );
      }
      
      const lineupResult = convertPDFResultToLineupResult(
        pdfResult,
        allPlayers,
        fantasyTeams,
        byTeamId,
        aliases
      );
      
      return NextResponse.json({
        success: true,
        teams: await annotateIdenticalToPrevious(roundNumber, lineupResult.teams),
        serieAMatchday: pdfResult.serieAMatchday,
        fantasyMatchday: pdfResult.fantasyMatchday,
        roundNumber,
        isPDF: true,
        message: pdfResult.message,
        catalog,
      });
    } else {
      console.log('[Admin Lineups] Parsing HTML response');
      
      const htmlContent = new TextDecoder().decode(result.data);
      const lineupResult = parseLineupsContent(
        htmlContent,
        allPlayers,
        fantasyTeams,
        byTeamId,
        aliases
      );
      
      return NextResponse.json({
        success: lineupResult.success,
        teams: await annotateIdenticalToPrevious(roundNumber, lineupResult.teams),
        serieAMatchday: lineupResult.serieAMatchday,
        roundNumber,
        isPDF: false,
        parseErrors: lineupResult.parseErrors,
        catalog,
      });
    }

  } catch (error) {
    console.error('[Admin Lineups Fetch] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
