'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Selettore giornate con articolo: frecce + chip scrollabili. */
export function GiornaleRoundNav({ currentRound }: { currentRound: number }) {
  const [rounds, setRounds] = useState<number[] | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/round-articles?list=1')
      .then(async (res) => {
        const json = (await res.json()) as { success?: boolean; rounds?: number[] };
        return json.success && Array.isArray(json.rounds) ? json.rounds : [];
      })
      .then((list) => {
        if (!cancelled) setRounds(list);
      })
      .catch(() => {
        if (!cancelled) setRounds([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!rounds?.length) return;
    queueMicrotask(() => {
      activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
  }, [rounds, currentRound]);

  if (rounds === null) {
    return <div className="mb-4 h-9 animate-pulse rounded-md bg-gray-200/60" aria-hidden />;
  }
  if (rounds.length === 0) return null;

  const idx = rounds.indexOf(currentRound);
  const prev = idx > 0 ? rounds[idx - 1] : null;
  const next = idx >= 0 && idx < rounds.length - 1 ? rounds[idx + 1] : null;

  return (
    <nav aria-label="Edizioni del giornale" className="mb-4 border-y border-gray-300/80 bg-inherit">
      <div className="flex items-center gap-1 py-1.5">
        {prev !== null ? (
          <Link
            href={`/giornale/${prev}`}
            aria-label={`Giornata ${prev}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-gray-200/70"
          >
            <ChevronLeft size={18} aria-hidden />
          </Link>
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center text-gray-300" aria-hidden>
            <ChevronLeft size={18} />
          </span>
        )}

        <div
          ref={scrollerRef}
          className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scroll-smooth px-0.5"
        >
          {rounds.map((r) => {
            const active = r === currentRound;
            return (
              <Link
                key={r}
                href={`/giornale/${r}`}
                ref={active ? activeRef : undefined}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'shrink-0 rounded-full border border-gray-900 bg-gray-900 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white'
                    : 'shrink-0 rounded-full border border-gray-300 bg-white/80 px-2.5 py-1 text-[11px] font-medium tracking-wide text-gray-600 hover:border-gray-500 hover:text-gray-900'
                }
              >
                G{r}
              </Link>
            );
          })}
        </div>

        {next !== null ? (
          <Link
            href={`/giornale/${next}`}
            aria-label={`Giornata ${next}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-gray-200/70"
          >
            <ChevronRight size={18} aria-hidden />
          </Link>
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center text-gray-300" aria-hidden>
            <ChevronRight size={18} />
          </span>
        )}
      </div>
    </nav>
  );
}
