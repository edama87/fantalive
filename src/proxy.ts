import { NextResponse, type NextRequest } from 'next/server';
import { hasMyTeamChoice, MY_TEAM_COOKIE } from '@/lib/my-team';

/**
 * Prima visita: chi non ha ancora scelto "La mia squadra" (o "Salta") vede la
 * pagina di benvenuto, poi torna alla pagina richiesta.
 */
export function proxy(request: NextRequest) {
  if (request.method !== 'GET') return NextResponse.next();
  if (request.headers.get('purpose') === 'prefetch' || request.headers.has('next-router-prefetch')) {
    return NextResponse.next();
  }
  if (hasMyTeamChoice(request.cookies.get(MY_TEAM_COOKIE)?.value)) return NextResponse.next();
  // Le note legali devono restare leggibili anche prima della scelta della squadra.
  if (request.nextUrl.pathname === '/disclaimer') return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = '/benvenuto';
  url.search = next === '/' ? '' : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Solo pagine dell'app: escluse API, admin, benvenuto, note legali e file statici.
  matcher: ['/((?!api|admin|benvenuto|disclaimer|_next|favicon.ico|.*\\..*).*)'],
};
