/**
 * POST /api/admin/lineups/add-player
 * Creates a player from a PDF row and links them to the team's open roster.
 */

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { isSupabaseServerConfigured } from '@/lib/db/supabase';
import { getFMSClubRealTeam } from '@/lib/fmsrevo-lineup-parser';
import { addPlayerToOpenRoster, saveFmsPlayerAlias } from '@/lib/roster-import';
import type { PlayerRole } from '@/types';

const ROLES = new Set<PlayerRole>(['P', 'D', 'C', 'A']);

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
        { success: false, error: 'SUPABASE_SECRET_KEY non configurata' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const rawName = typeof body.rawName === 'string' ? body.rawName.trim() : '';
    const role = body.role as PlayerRole;
    const serieAClub = typeof body.serieAClub === 'string' ? body.serieAClub.trim() : '';
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';

    if (!rawName || !ROLES.has(role) || !teamId) {
      return NextResponse.json(
        { success: false, error: 'Nome, ruolo e squadra sono obbligatori' },
        { status: 400 }
      );
    }

    const realTeam = (serieAClub ? getFMSClubRealTeam(serieAClub) : null) ?? (serieAClub || null);
    const player = await addPlayerToOpenRoster({
      name: rawName,
      role,
      realTeam,
      teamId,
    });
    await saveFmsPlayerAlias(rawName, player.id);

    return NextResponse.json({
      success: true,
      player: {
        id: player.id,
        name: player.name,
        role: player.role,
        realTeam: player.realTeam ?? realTeam,
        rosterTeamIds: [teamId],
      },
    });
  } catch (error) {
    console.error('[API] Error adding lineup player:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore creazione giocatore',
      },
      { status: 500 }
    );
  }
}
