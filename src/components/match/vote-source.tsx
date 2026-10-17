import { cn } from '@/lib/utils';
import type { PlayerScore } from '@/types';
import { voteSourceCounts } from '@/lib/vote-source';

export const CONSOLIDATED_TITLE = 'Voto consolidato (Gazzetta, Corriere, Tuttosport via pianetafanta)';
export const ESTIMATED_TITLE = 'Voto stimato: live o fantacalcio.it, può cambiare';

/** Piccolo ✓ verde accanto a un voto consolidato. */
export function ConsolidatedMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Voto consolidato"
      title={CONSOLIDATED_TITLE}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold leading-none text-emerald-700',
        className
      )}
    >
      ✓
    </span>
  );
}

/** Riga leggenda: ✓ consolidato · corsivo = stimato. */
export function VoteSourceLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-500', className)}>
      <span className="inline-flex items-center gap-1">
        <ConsolidatedMark /> voto consolidato
      </span>
      <span>
        <span className="italic">6,5</span> in corsivo = stimato (live / fantacalcio.it)
      </span>
    </div>
  );
}

/** "✓ 8 · 3 stimati" sotto il totale di una squadra (card Live). */
export function VoteSourceSummary({ scores, align = 'left' }: { scores: PlayerScore[]; align?: 'left' | 'right' }) {
  const { consolidated, estimated } = voteSourceCounts(scores);
  if (consolidated === 0 && estimated === 0) return null;
  return (
    <div className={cn('mt-1 flex items-center gap-2 text-[11px] text-gray-500', align === 'right' && 'justify-end')}>
      {consolidated > 0 && (
        <span className="inline-flex items-center gap-1 text-emerald-700" title={CONSOLIDATED_TITLE}>
          <ConsolidatedMark /> {consolidated}
        </span>
      )}
      {estimated > 0 && (
        <span className="italic" title={ESTIMATED_TITLE}>
          {estimated} stimat{estimated === 1 ? 'o' : 'i'}
        </span>
      )}
    </div>
  );
}
