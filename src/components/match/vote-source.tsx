import { cn } from '@/lib/utils';
import type { PlayerScore } from '@/types';
import { voteSourceCounts } from '@/lib/vote-source';

export const CONSOLIDATED_TITLE = 'Voto consolidato (Gazzetta, Corriere, Tuttosport via pianetafanta)';
export const CONSOLIDATED_FULL_TITLE = 'Voto consolidato: Gazzetta, Corriere e Tuttosport hanno pubblicato i voti della partita';
export const CONSOLIDATED_PARTIAL_TITLE = 'Voto consolidato con testate mancanti: per la partita manca almeno una testata';

export const ESTIMATED_TITLE = 'Voto stimato: live o fantacalcio.it, può cambiare';

/**
 * Spunte stile WhatsApp accanto a un voto consolidato: ✓✓ se per la partita
 * sono uscite tutte e 3 le testate, ✓ se ne manca almeno una (per tutta la
 * partita, non per il singolo giocatore s.v.). Senza `papers` (badge generici) una sola spunta.
 */
export function ConsolidatedMark({ className, papers }: { className?: string; papers?: number }) {
  const full = papers === 3;
  const title = papers == null ? CONSOLIDATED_TITLE : full ? CONSOLIDATED_FULL_TITLE : CONSOLIDATED_PARTIAL_TITLE;
  return (
    <span
      role="img"
      aria-label={papers == null ? 'Voto consolidato' : full ? 'Voto consolidato, 3 testate' : 'Voto consolidato con testate mancanti'}
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
        <ConsolidatedMark papers={3} /> consolidato
      </span>
      <span className="inline-flex items-center gap-1">
        <ConsolidatedMark papers={2} /> consolidato con testate mancanti
      </span>
      <span>
        <span className="italic">6,5</span> in corsivo = stimato (live / fantacalcio.it)
      </span>
    </div>
  );
}

/** "✓ 8 · 3 stimati" sotto il totale di una squadra (card Live). */
export function VoteSourceSummary({ scores, align = 'left' }: { scores: PlayerScore[]; align?: 'left' | 'right' | 'center' }) {
  const { consolidated, consolidatedFull, estimated } = voteSourceCounts(scores);
  const partial = consolidated - consolidatedFull;
  if (consolidated === 0 && estimated === 0) return null;
  return (
    <div className={cn('mt-1 flex items-center gap-2 text-[11px] text-gray-500', align === 'right' && 'justify-end', align === 'center' && 'justify-center')}>
      {consolidatedFull > 0 && (
        <span className="inline-flex items-center gap-1 text-emerald-700" title={CONSOLIDATED_FULL_TITLE}>
          <ConsolidatedMark papers={3} /> {consolidatedFull}
        </span>
      )}
      {partial > 0 && (
        <span className="inline-flex items-center gap-1 text-emerald-700" title={CONSOLIDATED_PARTIAL_TITLE}>
          <ConsolidatedMark papers={2} /> {partial}
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
