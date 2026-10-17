'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { pianetafantaVotesUrl } from '@/lib/pianetafanta-url';

interface PreviewMatch {
  key: string;
  homeTeam: string;
  awayTeam: string | null;
  players: number;
  matched: number;
  withVote: number;
  partialVotes: number;
  alreadyConsolidated: number;
  unmatched: Array<{ name: string; team: string; role: string | null; average: number | null }>;
}

interface PreviewResponse {
  success: boolean;
  error?: string;
  message?: string;
  serieAMatchday?: number;
  fileMatchday?: number | null;
  matchdayMismatch?: boolean;
  matches?: PreviewMatch[];
}

export function PianetafantaUpload({ roundNumber, serieAMatchday }: { roundNumber: number; serieAMatchday: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reset = () => {
    setPreview(null);
    setSelected([]);
    setConfirmed(false);
    setMessage(null);
    setError(null);
  };

  const send = async (mode: 'preview' | 'import') => {
    if (!file) return;
    setBusy(mode);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('roundNumber', String(roundNumber));
      form.set('mode', mode);
      if (mode === 'import') {
        form.set('matches', JSON.stringify(selected));
        form.set('confirm', 'overwrite');
      }
      const response = await fetch('/api/admin/voti/pianetafanta', { method: 'POST', body: form });
      const data = (await response.json()) as PreviewResponse;
      if (!response.ok || !data.success) {
        setError(data.error || 'Operazione non riuscita');
        return;
      }
      setPreview(data);
      if (mode === 'preview') {
        setSelected((data.matches ?? []).filter((m) => m.matched > 0).map((m) => m.key));
        setConfirmed(false);
      } else {
        setMessage(data.message ?? 'Voti consolidati');
        setConfirmed(false);
      }
    } catch {
      setError('Errore di rete');
    } finally {
      setBusy(null);
    }
  };

  const matches = preview?.matches ?? [];
  const selectedMatches = matches.filter((m) => selected.includes(m.key));
  const toImport = selectedMatches.reduce((sum, m) => sum + m.matched, 0);

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div>
          <h3 className="font-semibold text-gray-900">Voti consolidati pianetafanta</h3>
          <p className="text-sm text-gray-500">Gazzetta, Corriere e Tuttosport: hanno la precedenza sui voti live e fantacalcio.it.</p>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 space-y-1">
          <a
            href={pianetafantaVotesUrl(serieAMatchday)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
          >
            Apri voti su pianetafanta <ExternalLink size={14} aria-hidden />
          </a>
          <p className="text-xs text-gray-500">
            Serie A {serieAMatchday}ª. Lì clicca &lsquo;Esporta Excel&rsquo;, poi carica qui il file.
          </p>
        </div>

        <label className="block">
          <span className="sr-only">File Excel pianetafanta</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              reset();
            }}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-700"
          />
        </label>

        <button
          type="button"
          onClick={() => send('preview')}
          disabled={!file || busy != null}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {busy === 'preview' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Analizza file
        </button>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {message && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 size={16} aria-hidden /> {message}
          </div>
        )}

        {preview && matches.length > 0 && (
          <div className="space-y-3">
            {preview.matchdayMismatch && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Il file è della Serie A {preview.fileMatchday}ª, la giornata scelta è la {serieAMatchday}ª: cambia giornata o file.
              </div>
            )}
            <div className="text-sm font-medium text-gray-700">Partite nel file</div>
            <ul className="space-y-2">
              {matches.map((match) => {
                const checked = selected.includes(match.key);
                return (
                  <li key={match.key} className="rounded-lg border border-gray-200 bg-white">
                    <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-emerald-600"
                        checked={checked}
                        disabled={match.matched === 0}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked ? [...current, match.key] : current.filter((key) => key !== match.key)
                          )
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-gray-900">
                          {match.homeTeam}
                          {match.awayTeam ? ` – ${match.awayTeam}` : ''}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {match.players} giocatori · {match.matched} in rosa · {match.unmatched.length} non abbinati
                          {match.partialVotes > 0 && ` · ${match.partialVotes} con voti parziali`}
                          {match.alreadyConsolidated > 0 && ` · ${match.alreadyConsolidated} già consolidati`}
                        </span>
                      </span>
                    </label>
                    {match.unmatched.length > 0 && (
                      <details className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                        <summary className="cursor-pointer">Non abbinati (non in nessuna rosa o nome diverso)</summary>
                        <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                          {match.unmatched.map((player) => (
                            <li key={`${player.team}-${player.name}`}>
                              {player.name} <span className="text-gray-400">{player.role ?? ''} {player.average ?? 's.v.'}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>

            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-amber-600"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                <AlertTriangle size={14} className="mr-1 inline -mt-0.5" aria-hidden />
                Sovrascrive i voti live e fantacalcio.it di {toImport} giocatori ({selectedMatches.map((m) => m.key).join(', ') || 'nessuna partita'}).
                Diventano voti consolidati: lo scraping non li cambierà più.
              </span>
            </label>

            <button
              type="button"
              onClick={() => send('import')}
              disabled={!confirmed || selected.length === 0 || busy != null || preview.matchdayMismatch}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-white text-emerald-700 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {busy === 'import' && <Loader2 size={16} className="animate-spin" />}
              Importa {toImport} voti consolidati
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
