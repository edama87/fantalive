'use client';

/**
 * Navigazione tra giornate: frecce precedente/successiva e selettore.
 * Aggiorna ?giornata=N mantenendo gli altri parametri (URL condivisibile).
 */
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const href = (n: number) => giornataHref(pathname, params, n);
  const arrow = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700';
  const disabled = 'pointer-events-none opacity-40';

  return (
    <nav aria-label="Navigazione giornate" className={cn('flex items-center gap-2', className)}>
      <Link href={href(Math.max(1, selected - 1))} aria-label="Giornata precedente" aria-disabled={selected <= 1}
        className={cn(arrow, selected <= 1 && disabled)} scroll={false}>
        <ChevronLeft size={18} />
      </Link>
      <select
        aria-label="Scegli la giornata"
        value={selected}
        onChange={(e) => router.push(href(Number(e.target.value)), { scroll: false })}
        className="h-9 min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-3 text-center text-sm font-medium text-gray-900 focus:border-emerald-400 focus:outline-none sm:flex-none sm:min-w-44"
      >
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {label(n)}{n === current && !currentClosed ? ' · in corso' : ''}
          </option>
        ))}
      </select>
      <Link href={href(Math.min(max, selected + 1))} aria-label="Giornata successiva" aria-disabled={selected >= max}
        className={cn(arrow, selected >= max && disabled)} scroll={false}>
        <ChevronRight size={18} />
      </Link>
    </nav>
  );
}
