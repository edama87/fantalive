/**
 * POST /api/admin/lineups/alias
 * Saves an FMS display name as a player_aliases row (source = fms).
 */

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { isSupabaseServerConfigured } from '@/lib/db/supabase';
import { saveFmsPlayerAlias } from '@/lib/roster-import';

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
    const alias = typeof body.alias === 'string' ? body.alias.trim() : '';
    const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
    if (!alias || !playerId) {
      return NextResponse.json(
        { success: false, error: 'alias e playerId sono obbligatori' },
        { status: 400 }
      );
    }

    await saveFmsPlayerAlias(alias, playerId);
    return NextResponse.json({ success: true, alias, playerId });
  } catch (error) {
    console.error('[API] Error saving player alias:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore salvataggio alias',
      },
      { status: 500 }
    );
  }
}
