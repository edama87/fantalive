import { cn } from '@/lib/utils';

/** Iniziali: prime lettere delle parole significative ("Football And City" -> "FC"). */
export function teamInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !/^(and|e|di|de|del|la|il|the|\d+)$/i.test(w));
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

/** Stemma della squadra fantacalcio: cerchio con le iniziali (non ci sono loghi). */
export function TeamBadge({ id, name, mine = false, size = 'md' }: { id: string; name: string; mine?: boolean; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight',
        size === 'lg' ? 'h-14 w-14 text-lg' : 'h-11 w-11 text-sm',
        mine ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400 ring-offset-2' : 'bg-gray-100 text-gray-600'
      )}
    >
      {teamInitials(name)}
    </span>
  );
}

/** Pillola centrale con il risultato in gol. */
export function GoalsPill({ home, away, size = 'md' }: { home: number; away: number; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-2xl bg-slate-100 font-bold tabular-nums text-gray-900 ring-1 ring-slate-200',
        size === 'lg' ? 'px-5 py-2 text-3xl' : 'px-4 py-1.5 text-2xl'
      )}
      aria-label={`Gol ${home} a ${away}`}
    >
      {home}
      <span className="mx-2 font-medium text-gray-400">-</span>
      {away}
    </span>
  );
}
