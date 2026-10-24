'use client';

import { useState } from 'react';
import { CalendarClock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildMatchRecap, type RecapPlayer, type RecapSideInput } from '@/lib/match-recap';
import { fixtureLabel, romeKickoff, type RoundFixture } from '@/lib/serie-a-fixtures';

interface MatchRecapProps {
  fixtures: readonly RoundFixture[];
  homeName: string;
  awayName: string;
  home: readonly RecapSideInput[];
  away: readonly RecapSideInput[];
  /** Sulla home parte chiuso per non allungare la pagina. */
  collapsible?: boolean;
  className?: string;
}

function Players({ list, align }: { list: RecapPlayer[]; align: 'left' | 'right' }) {
  if (list.length === 0) return <span className="text-xs text-gray-300">–</span>;
  return (
    <ul className={cn('flex flex-wrap gap-1', align === 'right' && 'justify-end')}>
      {list.map((p) => (
        <li
          key={p.id}
          title={p.starter ? 'Titolare' : 'Panchina'}
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[11px] leading-4',
            p.starter ? 'bg-emerald-50 font-semibold text-emerald-800 ring-1 ring-emerald-100' : 'bg-gray-50 text-gray-500'
          )}
        >
          <span className="mr-0.5 text-[10px] text-gray-400">{p.role}</span>
          {surname(p.name)}
        </li>
      ))}
    </ul>
  );
}

/** "DE ROON Marten" -> "DE ROON": le parole in maiuscolo iniziali. */
function surname(name: string): string {
  const words = name.split(' ');
  const caps = words.filter((w, i) => words.slice(0, i + 1).every((x) => x === x.toUpperCase()));
  return (caps.length ? caps : words.slice(0, 1)).join(' ');
}

function when(f: RoundFixture): string {
  if (f.status !== 'scheduled') return fixtureLabel(f).replace(`${f.homeCode}-${f.awayCode} `, '');
  return f.kickoffTime ? romeKickoff(f.kickoffTime) : 'orario da definire';
}

/** "Partite da seguire": partite di Serie A con giocatori delle due squadre, in ordine di orario. */
export function MatchRecap({ fixtures, homeName, awayName, home, away, collapsible = false, className }: MatchRecapProps) {
  const [open, setOpen] = useState(!collapsible);
  const entries = buildMatchRecap(fixtures, home, away);
  if (entries.length === 0) return null;
  const starters = (side: 'home' | 'away') => entries.reduce((n, e) => n + e[side].filter((p) => p.starter).length, 0);

  return (
    <section className={cn('rounded-xl border border-gray-100 bg-white p-4 shadow-sm', className)} aria-label="Partite da seguire">
      <button
        type="button"
        onClick={() => collapsible && setOpen((o) => !o)}
        aria-expanded={open}
        className={cn('flex w-full items-center gap-2 text-left', !collapsible && 'cursor-default')}
      >
        <CalendarClock size={16} className="text-emerald-600" aria-hidden />
        <span className="text-sm font-semibold text-gray-900">Partite da seguire</span>
        <span className="ml-auto text-xs text-gray-400">{entries.length} partite</span>
        {collapsible && <ChevronDown size={16} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} aria-hidden />}
      </button>
      {open && (
        <>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            <span className="truncate">{homeName} · {starters('home')} tit.</span>
            <span />
            <span className="truncate text-right">{awayName} · {starters('away')} tit.</span>
          </div>
          <ol className="mt-1 divide-y divide-gray-100">
            {entries.map(({ fixture, home: h, away: a }) => (
              <li key={fixture.matchId} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2 py-2.5">
                <Players list={h} align="left" />
                <div className="flex min-w-[4.5rem] flex-col items-center text-center">
                  <span className="text-xs font-bold text-gray-900">{fixture.homeCode}-{fixture.awayCode}</span>
                  <span className={cn('text-[11px]', fixture.status === 'scheduled' ? 'text-gray-500' : fixture.status === 'finished' ? 'text-gray-400' : 'text-red-500')}>
                    {when(fixture)}
                  </span>
                </div>
                <Players list={a} align="right" />
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-gray-400">In verde i titolari, in grigio la panchina. Orari di Roma.</p>
        </>
      )}
    </section>
  );
}
