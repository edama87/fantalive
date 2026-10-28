'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSimulation } from '@/lib/use-simulation';
import { SIMULATION_COOKIE } from '@/lib/simulation';

/** Interruttore Reale / Simulato nell'header. */
export function SimulationToggle() {
  const [simulated, setSimulated] = useSimulation();
  const router = useRouter();

  // Allinea il cookie (letto dalle pagine server) al valore salvato in locale.
  useEffect(() => {
    const cookieOn = document.cookie.split('; ').some((c) => c === `${SIMULATION_COOKIE}=1`);
    if (cookieOn !== simulated) {
      document.cookie = `${SIMULATION_COOKIE}=${simulated ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [simulated, router]);

  return (
    <button
      type="button"
      role="switch"
      aria-label="Simula risultato"
      aria-checked={simulated}
      onClick={() => {
        setSimulated(!simulated);
        router.refresh();
      }}
      title={simulated ? "Simulato: voto d'ufficio 6 a chi deve ancora giocare" : 'Reale: solo voti reali'}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors',
        simulated ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
      )}
    >
      <span className={cn('relative inline-block h-3.5 w-6 rounded-full transition-colors', simulated ? 'bg-amber-500' : 'bg-gray-300')}>
        <span className={cn('absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all', simulated ? 'left-3' : 'left-0.5')} />
      </span>
      <span className="hidden min-[380px]:inline">{simulated ? 'Simulato' : 'Reale'}</span>
    </button>
  );
}
