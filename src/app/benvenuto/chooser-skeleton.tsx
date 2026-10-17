/** Scheletro della scelta squadra (caricamento della pagina /benvenuto). */
export function ChooserSkeleton() {
  return (
    <div className="min-h-screen px-4 py-8 md:py-14" aria-busy="true" aria-label="Caricamento squadre">
      <div className="mx-auto max-w-md md:max-w-2xl">
        <div className="h-4 w-40 rounded bg-emerald-100 animate-pulse" />
        <div className="mt-2 h-7 w-64 rounded bg-gray-200 animate-pulse" />
        <div className="mt-3 h-4 w-full rounded bg-gray-100 animate-pulse" />
        <div className="mt-1.5 h-4 w-3/4 rounded bg-gray-100 animate-pulse" />
        <ul className="mt-6 grid gap-2 md:grid-cols-2">
          {Array.from({ length: 10 }, (_, index) => (
            <li key={index} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
              <div className="h-4 w-36 rounded bg-gray-200 animate-pulse" />
              <div className="mt-1.5 h-3 w-16 rounded bg-gray-100 animate-pulse" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
