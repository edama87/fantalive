'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeNextPath, saveMyTeamChoice } from '@/lib/my-team';
import { useMyTeamId } from '@/lib/hooks/use-my-team';

export interface ChooserTeam {
  id: string;
  name: string;
  managerName: string;
}

export function TeamChooser({ teams, next }: { teams: ChooserTeam[]; next: string }) {
  const current = useMyTeamId();
  const [isPending, startTransition] = useTransition();
  // Scelta in corso ('none' = Salta): resta finché la pagina successiva non è pronta.
  const [chosen, setChosen] = useState<string | null>(null);
  const busy = isPending || chosen !== null;

  const choose = (teamId: string | null) => {
    if (busy) return;
    setChosen(teamId ?? 'none');
    saveMyTeamChoice(teamId);
    // Navigazione completa: il router client ha in cache il redirect del proxy
    // verso /benvenuto (prefetch fatto senza cookie) e con replace resteremmo qui.
    // La card resta in "Apro…" finché la nuova pagina non sostituisce questa.
    startTransition(() => {
      window.location.replace(safeNextPath(next));
    });
  };

  return (
    <div className="min-h-screen px-4 py-8 md:py-14">
      <div className="mx-auto max-w-md md:max-w-2xl">
        <p className="text-sm font-medium text-emerald-600">FantaLive · Bundlesliga</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">Qual è la tua squadra?</h1>
        <p className="mt-2 text-sm text-gray-500">
          La useremo per mettere in evidenza la tua sfida e i tuoi giocatori. Vale solo su questo
          dispositivo e puoi cambiarla quando vuoi.
        </p>

        <ul className="mt-6 grid gap-2 md:grid-cols-2">
          {teams.map((team) => {
            const loading = chosen === team.id;
            const selected = loading || (chosen === null && current === team.id);
            return (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => choose(team.id)}
                  disabled={busy && !loading}
                  aria-busy={loading}
                  className={cn(
                    'flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-[colors,opacity]',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500',
                    !busy && 'hover:border-emerald-300 hover:bg-emerald-50/40',
                    selected ? 'border-emerald-400 bg-emerald-50/60' : 'border-gray-100',
                    busy && !loading && 'opacity-50 cursor-not-allowed',
                    loading && 'cursor-wait'
                  )}
                  aria-pressed={selected}
                >
                  <span>
                    <span className="block font-semibold text-gray-900">{team.name}</span>
                    {team.managerName && <span className="block text-xs text-gray-400">{team.managerName}</span>}
                  </span>
                  {loading ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
                      Apro…
                    </span>
                  ) : (
                    selected && <Check size={18} className="text-emerald-600" aria-label="Selezionata" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => choose(null)}
          disabled={busy && chosen !== 'none'}
          aria-busy={chosen === 'none'}
          className={cn(
            'mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-gray-500',
            !busy && 'hover:bg-gray-100 hover:text-gray-800',
            busy && chosen !== 'none' && 'opacity-50 cursor-not-allowed'
          )}
        >
          {chosen === 'none' && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />}
          Salta, guardo e basta
        </button>
      </div>
    </div>
  );
}
