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
import { getAllPlayers, teams } from '@/data/teams';

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

    const allPlayers = getAllPlayers();
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
      
      const lineupResult = convertPDFResultToLineupResult(pdfResult, allPlayers, fantasyTeams);
      
      return NextResponse.json({
        success: true,
        teams: lineupResult.teams,
        serieAMatchday: pdfResult.serieAMatchday,
        fantasyMatchday: pdfResult.fantasyMatchday,
        roundNumber,
        isPDF: true,
        message: pdfResult.message,
      });
    } else {
      console.log('[Admin Lineups] Parsing HTML response');
      
      const htmlContent = new TextDecoder().decode(result.data);
      const lineupResult = parseLineupsContent(htmlContent, allPlayers, fantasyTeams);
      
      return NextResponse.json({
        success: lineupResult.success,
        teams: lineupResult.teams,
        serieAMatchday: lineupResult.serieAMatchday,
        roundNumber,
        isPDF: false,
        parseErrors: lineupResult.parseErrors,
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
