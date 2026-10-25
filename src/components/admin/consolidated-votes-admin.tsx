'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw, Trash2 } from 'lucide-react';

interface Summary {
  matchKey: string;
  homeTeam: string;
  awayTeam: string | null;
  players: Array<{
    playerId: string;
    name: string;
    role: string | null;
    votes: { gazzetta: number | null; corriere: number | null; tuttosport: number | null };
    average: number | null;
    zeroVotes: number;
  }>;
}

type Pending = { matchKey: string; playerId?: string; label: string };

const fmt = (value: number | null) => (value == null ? 's.v.' : String(value).replace('.', ','));

/**
 * Voti consolidati della giornata con "Cancella" per partita o giocatore
 * (conferma obbligatoria). Con matchKey mostra solo quella partita.
 */
export function ConsolidatedVotesAdmin({ roundNumber, matchKey }: { roundNumber: number; matchKey?: string }) {
  const [matches, setMatches] = useState<Summary[] | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/voti/consolidated?round=${roundNumber}`)
      .then((response) => response.json() as Promise<{ success: boolean; matches?: Summary[]; error?: string }>)
      .then((data) => {
        if (cancelled) return;
        if (!data.success) throw new Error(data.error);
        setMatches((data.matches ?? []).filter((m) => !matchKey || m.matchKey === matchKey));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMatches([]);
        setError(err instanceof Error && err.message ? err.message : 'Voti consolidati non disponibili');
      });
    return () => {
      cancelled = true;
    };
  }, [roundNumber, matchKey, version]);

  const confirmDelete = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/voti/consolidated', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round: roundNumber, matchKey: pending.matchKey, playerId: pending.playerId, confirm: 'delete' }),
      });
      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        deleted?: number;
        restoredFromFantacalcio?: number;
        fantacalcioError?: string;
      };
      if (!response.ok || !data.success) {
        setError(data.error || 'Cancellazione non riuscita');
        return;
      }
      setMessage(
        `${pending.label}: cancellati ${data.deleted ?? 0} voti consolidati, ripresi ${data.restoredFromFantacalcio ?? 0} voti da fantacalcio.it` +
          (data.fantacalcioError ? ` (fantacalcio.it non raggiungibile: ${data.fantacalcioError})` : '')
      );
      setPending(null);
      setVersion((v) => v + 1);
    } catch {
      setError('Errore di rete');
    } finally {
      setBusy(false);
    }
  };

  if (matches == null) {
    return (
      <p className="flex items-center gap-1 text-sm text-gray-500">
        <Loader2 size={14} className="animate-spin" aria-hidden /> Carico i voti consolidati…
      </p>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">{message}</div>}
      {matches.length === 0 && !error && <p className="text-gray-500">Nessuna partita con voti consolidati in questa giornata.</p>}
      <ul className="space-y-2">
        {matches.map((match) => {
          const zeroPlayers = match.players.filter((p) => p.zeroVotes > 0).length;
          const label = `${match.homeTeam}${match.awayTeam ? ` – ${match.awayTeam}` : ''}`;
          return (
            <li key={match.matchKey} className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block font-medium text-gray-900">{label}</span>
                  <span className="block text-xs text-gray-500">
                    {match.players.length} voti consolidati
                    {zeroPlayers > 0 && <span className="text-amber-700"> · {zeroPlayers} con uno 0 nel file (ora ignorato)</span>}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setPending({ matchKey: match.matchKey, label })}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700"
                >
                  <RotateCcw size={13} aria-hidden /> Cancella voti consolidati
                </button>
              </div>
              {pending?.matchKey === match.matchKey && (
                <div role="alertdialog" aria-label="Conferma cancellazione" className="mx-3 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  <p className="flex items-start gap-1">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      {pending.playerId
                        ? `Cancelli il voto consolidato di ${pending.label}?`
                        : `Cancelli tutti i ${match.players.length} voti consolidati di ${label}?`}{' '}
                      Si torna ai voti di fantacalcio.it e i punteggi della giornata si aggiornano.
                    </span>
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={confirmDelete}
                      disabled={busy}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-red-600 py-1.5 font-medium text-white disabled:opacity-60"
                    >
                      {busy && <Loader2 size={13} className="animate-spin" aria-hidden />} Sì, cancella
                    </button>
                    <button
                      type="button"
                      onClick={() => setPending(null)}
                      disabled={busy}
                      className="flex-1 rounded-md border border-gray-300 bg-white py-1.5 font-medium text-gray-700"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
              <details className="border-t border-gray-100 px-3 py-2 text-xs text-gray-600">
                <summary className="cursor-pointer text-gray-500">Giocatori (cancella un singolo voto)</summary>
                <ul className="mt-1.5 space-y-1">
                  {match.players.map((player) => (
                    <li
                      key={player.playerId}
                      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 ${player.zeroVotes > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-800">
                          {player.name} <span className="font-normal text-gray-400">{player.role ?? ''}</span>
                        </span>
                        <span className="tabular-nums text-gray-500">
                          G {fmt(player.votes.gazzetta)} · CS {fmt(player.votes.corriere)} · TS {fmt(player.votes.tuttosport)} ={' '}
                          <b className="text-gray-800">{fmt(player.average)}</b>
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Cancella voto consolidato di ${player.name}`}
                        onClick={() => setPending({ matchKey: match.matchKey, playerId: player.playerId, label: player.name })}
                        className="shrink-0 rounded-md p-1.5 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
