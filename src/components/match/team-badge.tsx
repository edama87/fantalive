import { cn } from '@/lib/utils';

const PALETTE = [
  'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700', 'bg-orange-100 text-orange-700', 'bg-lime-100 text-lime-700', 'bg-fuchsia-100 text-fuchsia-700',
];

/** Iniziali: prime lettere delle parole significative ("Football And City" -> "FC"). */
export function teamInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !/^(and|e|di|de|del|la|il|the|\d+)$/i.test(w));
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

export function teamBadgeColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Stemma della squadra fantacalcio: cerchio con le iniziali (non ci sono loghi). */
export function TeamBadge({ id, name, mine = false, size = 'md' }: { id: string; name: string; mine?: boolean; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight',
        size === 'lg' ? 'h-14 w-14 text-lg' : 'h-11 w-11 text-sm',
        teamBadgeColor(id),
        mine && 'ring-2 ring-emerald-400 ring-offset-2'
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
        'inline-flex items-center justify-center whitespace-nowrap rounded-2xl bg-indigo-50 font-bold tabular-nums text-indigo-900 ring-1 ring-indigo-100',
        size === 'lg' ? 'px-5 py-2 text-3xl' : 'px-4 py-1.5 text-2xl'
      )}
      aria-label={`Gol ${home} a ${away}`}
    >
      {home}
      <span className="mx-2 font-medium text-indigo-300">-</span>
      {away}
    </span>
  );
}
