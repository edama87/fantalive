import { CardSkeleton, MatchSkeleton, Spinner, TableSkeleton } from '@/components/ui/spinner';

type Variant = 'matches' | 'sfida' | 'table' | 'cards' | 'votes';

function Bar({ className }: { className: string }) {
  return <div className={`rounded bg-gray-200 animate-pulse ${className}`} />;
}

function VotesSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <Bar className="h-5 w-28" />
      <div className="mt-3 divide-y divide-gray-50">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <div className="h-5 w-5 rounded bg-gray-100 animate-pulse" />
            <div className="h-4 flex-1 rounded bg-gray-100 animate-pulse" />
            <div className="h-4 w-9 rounded bg-gray-200 animate-pulse" />
            <div className="h-4 w-9 rounded bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Scheletro di caricamento per le pagine (loading.tsx): header leggero, uno
 * spinner piccolo e la forma del contenuto. La navigazione resta quella del layout.
 */
export function RouteSkeleton({ variant, label = 'Caricamento…' }: { variant: Variant; label?: string }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20" aria-busy="true">
      <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between md:max-w-3xl lg:max-w-6xl">
          <Bar className="h-6 w-40" />
          <div className="h-5 w-24 rounded-full bg-gray-100 animate-pulse" />
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-3 px-4 py-4 md:max-w-3xl lg:max-w-6xl">
        <div className="flex items-center gap-2 text-sm text-gray-400" role="status">
          <Spinner size="sm" />
          <span>{label}</span>
        </div>

        {variant === 'matches' && (
          <>
            <MatchSkeleton />
            <MatchSkeleton />
            <MatchSkeleton />
          </>
        )}
        {variant === 'sfida' && (
          <>
            <MatchSkeleton />
            <div className="grid gap-3 md:grid-cols-2">
              <VotesSkeleton rows={6} />
              <VotesSkeleton rows={6} />
            </div>
          </>
        )}
        {variant === 'table' && <TableSkeleton rows={10} />}
        {variant === 'cards' && (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        )}
        {variant === 'votes' && (
          <>
            <Bar className="h-7 w-56" />
            <VotesSkeleton />
            <VotesSkeleton />
          </>
        )}
      </div>
    </div>
  );
}
