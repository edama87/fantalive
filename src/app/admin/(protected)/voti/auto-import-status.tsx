'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatVote } from '@/lib/utils';

interface Status {
  success: boolean;
  error?: string;
  runs: number;
  last: {
    startedAt: string;
    status: string;
    saved: number;
    skippedConsolidated: number;
    matches: Array<{ label: string; rows: number; matched: number; error?: string }>;
    error?: string | null;
  } | null;
  rosterCandidates: Array<{
    name: string;
    team: string;
    role: string | null;
    vote: number | null;
    candidates: Array<{ id: string; name: string }>;
    lastSeen: string;
  }>;
}

const romeTime = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Import automatico fantacalcio.it (cron): ultimo run e giocatori della lega non abbinati. */
export function AutoImportStatus({ roundNumber }: { roundNumber: number }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/voti/auto-import?round=${roundNumber}`)
      .then((response) => response.json() as Promise<Status>)
      .then((data) => !cancelled && setStatus(data))
      .catch(() => !cancelled && setStatus({ success: false, error: 'Errore di rete', runs: 0, last: null, rosterCandidates: [] }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [roundNumber, reload]);

  return (
    <Card>
      <CardContent className="py-4 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900">Import automatico fantacalcio.it</div>
            <div className="text-xs text-gray-500">Ogni 2 minuti durante le partite e fino a 6 ore dopo il calcio d’inizio. Non tocca i voti consolidati.</div>
          </div>
          <button
            type="button"
            aria-label="Aggiorna"
            onClick={() => {
              setLoading(true);
              setReload((n) => n + 1);
            }}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>

        {status && !status.success && <p className="text-red-600">{status.error}</p>}
        {status?.success && !status.last && <p className="text-gray-400">Nessun import automatico per questa giornata.</p>}
        {status?.last && (
          <div className="rounded-lg bg-gray-50 px-3 py-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Ultimo run</span>
              <span className={status.last.status === 'error' ? 'text-red-600' : 'text-gray-800'}>
                {romeTime(status.last.startedAt)} (ora di Roma) · {status.last.status === 'error' ? 'errore' : 'ok'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Voti salvati</span>
              <span className="tabular-nums">
                {status.last.saved}
                {status.last.skippedConsolidated > 0 && ` · ${status.last.skippedConsolidated} consolidati lasciati intatti`}
              </span>
            </div>
            {status.last.matches.map((match) => (
              <div key={match.label} className="flex justify-between text-xs text-gray-500">
                <span>{match.label}</span>
                <span className={match.error ? 'text-red-600' : undefined}>
                  {match.error ?? `${match.matched}/${match.rows} abbinati`}
                </span>
              </div>
            ))}
          </div>
        )}

        {status?.success && status.rosterCandidates.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-amber-800">
              <AlertTriangle size={14} /> Giocatori della lega non abbinati
            </div>
            <p className="text-xs text-amber-700">
              Nome su fantacalcio.it simile a un giocatore in rosa ma non abbinato con certezza. Aggiungi un alias solo se il voto
              manca davvero.
            </p>
            {status.rosterCandidates.map((item) => (
              <div key={`${item.team}-${item.name}`} className="flex justify-between gap-2">
                <span>
                  {item.name} <span className="text-gray-500">{item.team} {item.role}</span>
                  <span className="block text-xs text-gray-500">
                    Forse: {item.candidates.map((c) => c.name).join(', ')}
                  </span>
                </span>
                <span className="tabular-nums">{item.vote != null ? formatVote(item.vote) : 's.v.'}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
