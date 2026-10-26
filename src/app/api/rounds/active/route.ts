import { connection, NextResponse } from 'next/server';
import { getActiveRoundInfo } from '@/lib/active-round-server';

/** Giornata attiva (cambia al primo calcio d'inizio della successiva) e giornate chiuse. */
export async function GET() {
  await connection();
  try {
    return NextResponse.json(await getActiveRoundInfo());
  } catch {
    return NextResponse.json({ error: 'Giornata non disponibile' }, { status: 500 });
  }
}
