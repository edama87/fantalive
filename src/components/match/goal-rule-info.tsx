'use client';

import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { explainGoalConversion } from '@/lib/goal-rules';
import { getTeamById } from '@/data/teams';

/** Icona (solo se una regola di conversione ha cambiato il risultato) con popover esplicativo. */
export function GoalRuleInfo({
  homeTeamId,
  awayTeamId,
  homeTotal,
  awayTotal,
  className,
}: {
  homeTeamId: string;
  awayTeamId: string;
  homeTotal: number;
  awayTotal: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const info = explainGoalConversion(
    getTeamById(homeTeamId)?.name ?? homeTeamId,
    getTeamById(awayTeamId)?.name ?? awayTeamId,
    homeTotal,
    awayTotal
  );
  if (!info) return null;

  return (
    <span ref={ref} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label="Regola applicata al risultato"
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        className="inline-flex items-center justify-center rounded-full p-0.5 text-gray-400 hover:text-gray-600"
      >
        <Info size={12} aria-hidden />
      </button>
      {open && (
        <span
          role="tooltip"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 rounded-md border border-gray-200 bg-white p-2 text-left text-[11px] font-normal leading-snug text-gray-700 shadow-md"
        >
          {info.text}
        </span>
      )}
    </span>
  );
}
