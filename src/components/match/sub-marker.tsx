import { ArrowDown, ArrowUp } from 'lucide-react';

/** Indicatore di sostituzione: "entrato … al posto di X" (verde) / "uscito … per X" (rosso). */
export function SubMarker({ kind, minute, partner }: { kind: 'in' | 'out'; minute: number | null; partner?: string }) {
  const base = `${kind === 'in' ? 'entrato' : 'uscito'}${minute != null ? ` ${minute}′` : ''}`;
  const label = partner ? `${base} ${kind === 'in' ? 'al posto di' : 'per'} ${partner}` : base;
  return kind === 'in' ? (
    <span className="inline-flex items-center gap-0.5 font-medium text-emerald-600">
      <ArrowUp aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
      {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 font-medium text-red-600">
      <ArrowDown aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
      {label}
    </span>
  );
}
