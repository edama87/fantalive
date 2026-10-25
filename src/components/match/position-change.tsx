import { cn } from '@/lib/utils';

/** Variazione di posizione rispetto alla giornata precedente: ▲ verde, ▼ rosso, = grigio. Nulla senza confronto. */
export function PositionChange({ change, className }: { change?: number; className?: string }) {
  if (change == null) return <span className={cn('inline-block w-2.5', className)} aria-hidden />;
  const label =
    change > 0
      ? `Guadagnate ${change} ${change === 1 ? 'posizione' : 'posizioni'} rispetto alla giornata precedente`
      : change < 0
        ? `Perse ${-change} ${change === -1 ? 'posizione' : 'posizioni'} rispetto alla giornata precedente`
        : 'Posizione invariata rispetto alla giornata precedente';
  return (
    <span title={label} aria-label={label} role="img" className={cn('inline-flex w-2.5 shrink-0 items-center justify-center', className)}>
      {change > 0 ? (
        <svg viewBox="0 0 8 8" className="h-2 w-2 fill-green-600" aria-hidden><path d="M4 1 7.5 7h-7z" /></svg>
      ) : change < 0 ? (
        <svg viewBox="0 0 8 8" className="h-2 w-2 fill-red-500" aria-hidden><path d="M4 7 .5 1h7z" /></svg>
      ) : (
        <span className="text-[10px] font-semibold leading-none text-gray-400" aria-hidden>=</span>
      )}
    </span>
  );
}
