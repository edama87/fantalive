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
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getRoundByNumber } from '@/data/calendar';
import { fetchFMSRevoLineups } from '@/lib/fmsrevo-client';

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

    if (!result.success) {
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

    return NextResponse.json({
      success: true,
      html: result.html,
      serieAMatchday,
      roundNumber,
    });

  } catch (error) {
    console.error('[Admin Lineups Fetch] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
