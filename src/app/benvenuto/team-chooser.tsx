'use client';

import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeNextPath, saveMyTeamChoice } from '@/lib/my-team';
import { useMyTeamId } from '@/lib/hooks/use-my-team';

export interface ChooserTeam {
  id: string;
  name: string;
  managerName: string;
}

export function TeamChooser({ teams, next }: { teams: ChooserTeam[]; next: string }) {
  const router = useRouter();
  const current = useMyTeamId();

  const choose = (teamId: string | null) => {
    saveMyTeamChoice(teamId);
    router.replace(safeNextPath(next));
    router.refresh();
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
            const selected = current === team.id;
            return (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => choose(team.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-colors',
                    'hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500',
                    selected ? 'border-emerald-400 bg-emerald-50/60' : 'border-gray-100'
                  )}
                  aria-pressed={selected}
                >
                  <span>
                    <span className="block font-semibold text-gray-900">{team.name}</span>
                    {team.managerName && <span className="block text-xs text-gray-400">{team.managerName}</span>}
                  </span>
                  {selected && <Check size={18} className="text-emerald-600" aria-label="Selezionata" />}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => choose(null)}
          className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          Salta, guardo e basta
        </button>
      </div>
    </div>
  );
}
