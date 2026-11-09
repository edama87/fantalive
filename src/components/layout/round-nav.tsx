'use client';

/**
 * Navigazione tra giornate: frecce precedente/successiva e selettore.
 * Aggiorna ?giornata=N mantenendo gli altri parametri (URL condivisibile).
 */
import { useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function giornataHref(pathname: string, params: URLSearchParams | null, n: number): string {
  const next = new URLSearchParams(params?.toString() ?? '');
  next.set('giornata', String(n));
  return `${pathname}?${next.toString()}`;
}

export function RoundNav({
  selected,
  max,
  current,
  currentClosed = false,
  label = (n) => `${n}ª giornata`,
  className,
}: {
  selected: number;
  max: number;
  /** Giornata in corso (evidenziata nel selettore). */
  current?: number;
  /** La giornata in corso è chiusa (import FMS): niente " · in corso". */
  currentClosed?: boolean;
  label?: (n: number) => string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const href = (n: number) => giornataHref(pathname, params, n);
  const go = (n: number) => {
    if (n === selected || n < 1 || n > max) return;
    startTransition(() => {
      router.push(href(n), { scroll: false });
    });
  };
  const arrow =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700';
  const disabled = 'pointer-events-none opacity-40';

  return (
    <nav
      aria-label="Navigazione giornate"
      aria-busy={isPending}
      className={cn('flex items-center gap-2', className)}
      data-pending={isPending ? '1' : '0'}
    >
      <Link
        href={href(Math.max(1, selected - 1))}
        aria-label="Giornata precedente"
        aria-disabled={selected <= 1 || isPending}
        className={cn(arrow, (selected <= 1 || isPending) && disabled)}
        scroll={false}
        onClick={(e) => {
          e.preventDefault();
          go(selected - 1);
        }}
      >
        <ChevronLeft size={18} />
      </Link>
      <div className="relative min-w-0 flex-1 sm:flex-none sm:min-w-44">
        <select
          aria-label="Scegli la giornata"
          value={selected}
          disabled={isPending}
          onChange={(e) => go(Number(e.target.value))}
          className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-center text-sm font-medium text-gray-900 focus:border-emerald-400 focus:outline-none disabled:opacity-70"
        >
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {label(n)}
              {n === current && !currentClosed ? ' · in corso' : ''}
            </option>
          ))}
        </select>
        {isPending ? (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-emerald-600">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            <span className="sr-only">Caricamento giornata…</span>
          </span>
        ) : null}
      </div>
      <Link
        href={href(Math.min(max, selected + 1))}
        aria-label="Giornata successiva"
        aria-disabled={selected >= max || isPending}
        className={cn(arrow, (selected >= max || isPending) && disabled)}
        scroll={false}
        onClick={(e) => {
          e.preventDefault();
          go(selected + 1);
        }}
      >
        <ChevronRight size={18} />
      </Link>
    </nav>
  );
}
