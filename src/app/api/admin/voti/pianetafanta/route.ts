import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/admin';
import { getRoundByNumber } from '@/data/calendar';
import { isSupabaseServerConfigured } from '@/lib/db/supabase';
import { analyzePianetafantaFile, PIANETAFANTA_MAX_BYTES } from '@/lib/pianetafanta-import';
import { savePianetafantaVotes } from '@/lib/official-votes';

export const maxDuration = 60;

/**
 * POST multipart: file (.xlsx pianetafanta), roundNumber, mode = 'preview' | 'import'.
 * Per l'import: matches = JSON con le chiavi partita scelte e confirm = 'overwrite'.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ success: false, error: 'SUPABASE_SECRET_KEY non configurata' }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const round = getRoundByNumber(Number(form.get('roundNumber')));
    const mode = form.get('mode') === 'import' ? 'import' : 'preview';

    if (!round) return NextResponse.json({ success: false, error: 'Giornata non valida' }, { status: 400 });
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Carica il file .xlsx di pianetafanta' }, { status: 400 });
    }
    if (file.size > PIANETAFANTA_MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'File troppo grande (max 2 MB)' }, { status: 413 });
    }

    const { preview, groups } = await analyzePianetafantaFile(Buffer.from(await file.arrayBuffer()), round);

    if (mode === 'preview') {
      return NextResponse.json({ success: true, ...preview });
    }

    if (form.get('confirm') !== 'overwrite') {
      return NextResponse.json(
        { success: false, error: 'Conferma richiesta: i voti esistenti verranno sovrascritti' },
        { status: 400 }
      );
    }
    if (preview.matchdayMismatch) {
      return NextResponse.json(
        {
          success: false,
          error: `Il file è della giornata ${preview.fileMatchday} di Serie A, la giornata scelta è la ${round.serieAMatchday}`,
        },
        { status: 400 }
      );
    }

    let keys: unknown;
    try {
      keys = JSON.parse(String(form.get('matches') ?? '[]'));
    } catch {
      keys = null;
    }
    if (!Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json({ success: false, error: 'Scegli almeno una partita' }, { status: 400 });
    }
    const selected = groups.filter((group) => keys.includes(group.key));
    if (selected.length !== keys.length) {
      return NextResponse.json({ success: false, error: 'Partita non presente nel file' }, { status: 400 });
    }

    const result = await savePianetafantaVotes(round.number, round.serieAMatchday, selected);
    return NextResponse.json({
      success: true,
      ...preview,
      saved: result.saved,
      imported: result.matches,
      message: `Consolidati ${result.saved} voti (${selected.map((g) => g.key).join(', ')}) per la giornata ${round.number}`,
    });
  } catch (error) {
    console.error('[API] Import pianetafanta:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Errore durante l’import' },
      { status: 500 }
    );
  }
}
