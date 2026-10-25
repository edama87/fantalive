import { cn } from '@/lib/utils';
import type { PlayerScore } from '@/types';
import { voteSourceCounts } from '@/lib/vote-source';

export const CONSOLIDATED_TITLE = 'Voto consolidato (Gazzetta, Corriere, Tuttosport via pianetafanta)';
export const CONSOLIDATED_FULL_TITLE = 'Voto consolidato con tutte e 3 le testate (Gazzetta, Corriere, Tuttosport)';
export const CONSOLIDATED_PARTIAL_TITLE = 'Voto consolidato con solo 1 o 2 testate su 3';

/** Testate con un voto reale (0/s.v. esclusi). */
export function paperCountOf(votes: { gazzetta?: number | null; corriere?: number | null; tuttosport?: number | null } | null | undefined): number {
  if (!votes) return 0;
  return [votes.gazzetta, votes.corriere, votes.tuttosport].filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0).length;
}
export const ESTIMATED_TITLE = 'Voto stimato: live o fantacalcio.it, può cambiare';

/**
 * Spunte stile WhatsApp accanto a un voto consolidato: ✓✓ con tutte e 3 le
 * testate, ✓ con 1 o 2. Senza `papers` (badge generici) una sola spunta.
 */
export function ConsolidatedMark({ className, papers }: { className?: string; papers?: number }) {
  const full = papers === 3;
  const title = papers == null ? CONSOLIDATED_TITLE : full ? CONSOLIDATED_FULL_TITLE : CONSOLIDATED_PARTIAL_TITLE;
  return (
    <span
      role="img"
      aria-label={papers == null ? 'Voto consolidato' : full ? 'Voto consolidato, 3 testate' : `Voto consolidato, ${papers} testat${papers === 1 ? 'a' : 'e'} su 3`}
      title={title}
      className={cn(
        'inline-flex h-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold leading-none text-emerald-700',
        full ? 'w-5 tracking-[-0.35em] pr-[0.35em]' : 'w-4',
        className
      )}
    >
      {full ? '✓✓' : '✓'}
    </span>
  );
}

/** Riga leggenda: ✓ consolidato · corsivo = stimato. */
export function VoteSourceLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-500', className)}>
      <span className="inline-flex items-center gap-1">
        <ConsolidatedMark papers={3} /> consolidato (3 testate)
      </span>
      <span className="inline-flex items-center gap-1">
        <ConsolidatedMark papers={2} /> consolidato (1–2 testate)
      </span>
      <span>
        <span className="italic">6,5</span> in corsivo = stimato (live / fantacalcio.it)
      </span>
    </div>
  );
}

/** "✓ 8 · 3 stimati" sotto il totale di una squadra (card Live). */
export function VoteSourceSummary({ scores, align = 'left' }: { scores: PlayerScore[]; align?: 'left' | 'right' | 'center' }) {
  const { consolidated, estimated } = voteSourceCounts(scores);
  if (consolidated === 0 && estimated === 0) return null;
  return (
    <div className={cn('mt-1 flex items-center gap-2 text-[11px] text-gray-500', align === 'right' && 'justify-end', align === 'center' && 'justify-center')}>
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
