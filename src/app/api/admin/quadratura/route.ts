/**
 * Quadratura con FMS Revo (solo sessione admin).
 *  GET ?round=N            -> usa la cache (o legge FMS se vuota/scaduta)
 *  GET ?round=N&refresh=1  -> rilegge i tabellini da FMS (login + lettura, nessun altro form)
 */
import { NextResponse, connection } from 'next/server';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/auth/admin';
import { getQuadratura } from '@/lib/quadratura-server';
import { calendar } from '@/data/calendar';

export async function GET(request: Request) {
  await connection();
  const devOpen = !isAdminConfigured() && process.env.NODE_ENV !== 'production';
  if (!devOpen && !(await isAdminAuthenticated())) {
    return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
  }
  const url = new URL(request.url);
  const round = Number(url.searchParams.get('round'));
  if (!Number.isInteger(round) || !calendar.some((r) => r.number === round)) {
    return NextResponse.json({ success: false, error: 'Giornata non valida' }, { status: 400 });
  }
  try {
    const data = await getQuadratura(round, { refresh: url.searchParams.get('refresh') === '1', fetchFms: true });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Errore' }, { status: 500 });
  }
}
