/**
 * Quadratura con il sito ufficiale FMS Revo: totali, gol, modificatori e
 * voti per giocatore, letti dai tabellini FMS (solo lettura, cache 10 min).
 */
import Link from 'next/link';
import { connection } from 'next/server';
import { ArrowLeft, Scale } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { calendar } from '@/data/calendar';
import { getActiveRound } from '@/lib/active-round-server';
import { cn } from '@/lib/utils';
import { QuadraturaView } from '@/components/admin/quadratura-view';

export default async function QuadraturaPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  await connection();
  const current = (await getActiveRound()).number;
  const rounds = calendar.map((r) => r.number).filter((n) => n <= current);
  const requested = Number((await searchParams).round);
  const round = rounds.includes(requested) ? requested : Math.max(1, current - 1);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="ADMIN" isLive={false} />
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-700">
          <ArrowLeft size={16} /> Pannello
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Scale size={22} className="text-emerald-600" />
            Quadratura FMS · Giornata {round}
          </h2>
          <nav className="flex flex-wrap gap-1" aria-label="Giornate">
            {rounds.map((r) => (
              <Link key={r} href={`/admin/quadratura?round=${r}`}
                className={cn('rounded-full px-3 py-1 text-sm', r === round ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50')}>
                G{r}
              </Link>
            ))}
          </nav>
        </div>
        <QuadraturaView key={round} round={round} />
      </div>
    </div>
  );
}
