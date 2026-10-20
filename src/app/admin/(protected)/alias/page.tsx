'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { calendar, getCurrentRound } from '@/data/calendar';
import { getTeamById } from '@/data/teams';
import { formatVote } from '@/lib/utils';
import type { AliasRow, UnmatchedName } from '@/lib/alias-admin';
import { Check, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';

interface CatalogPlayer {
  id: string;
  name: string;
  role: string;
  realTeam: string | null;
  fantaTeam: string | null;
}

interface ApiData {
  unmatched: UnmatchedName[];
  aliases: AliasRow[];
  players: CatalogPlayer[];
}

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

async function fetchAliasData(round: number): Promise<ApiData> {
  const response = await fetch(`/api/admin/alias?round=${round}`, { cache: 'no-store' });
  const json = await response.json();
  if (!json.success) throw new Error(json.error ?? 'Errore');
  return json;
}

function fantaLabel(teamId: string | null) {
  return teamId ? getTeamById(teamId)?.name ?? teamId : null;
}

function PlayerPicker({
  players,
  initialQuery,
  onPick,
  onCancel,
}: {
  players: CatalogPlayer[];
  initialQuery: string;
  onPick: (player: CatalogPlayer) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return players
      .filter((player) => {
        const haystack = normalize(`${player.name} ${player.realTeam ?? ''}`);
        return words.every((word) => haystack.includes(word));
      })
      .sort((a, b) => Number(Boolean(b.fantaTeam)) - Number(Boolean(a.fantaTeam)) || a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [players, query]);

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2">
      <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2">
        <Search size={16} className="text-gray-400" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca giocatore o club…"
          aria-label="Cerca giocatore"
          className="w-full py-2 text-sm outline-none"
        />
        <button type="button" onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Chiudi ricerca">
          <X size={16} />
        </button>
      </div>
      <ul className="mt-2 max-h-64 overflow-y-auto">
        {results.map((player) => (
          <li key={player.id}>
            <button
              type="button"
              onClick={() => onPick(player)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-white"
            >
              <span>
                <span className="font-medium text-gray-900">{player.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {player.role} · {player.realTeam ?? '—'}
                </span>
              </span>
              {player.fantaTeam && (
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                  {fantaLabel(player.fantaTeam)}
                </span>
              )}
            </button>
          </li>
        ))}
        {query.trim() && results.length === 0 && <li className="px-2 py-2 text-sm text-gray-500">Nessun giocatore</li>}
      </ul>
    </div>
  );
}

export default function AliasAdminPage() {
  const [roundNumber, setRoundNumber] = useState(() => getCurrentRound().number);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyRostered, setOnlyRostered] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [aliasQuery, setAliasQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await fetchAliasData(roundNumber));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore');
    } finally {
      setLoading(false);
    }
  }, [roundNumber]);

  useEffect(() => {
    let active = true;
    fetchAliasData(roundNumber)
      .then((json) => {
        if (!active) return;
        setData(json);
        setError(null);
      })
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : 'Errore'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [roundNumber]);

  const save = async (key: string, payload: { id?: string; alias: string; playerId: string; source: string }) => {
    setSaving(key);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/alias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, round: roundNumber }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? 'Salvataggio non riuscito');
      const saved = json.reapplied?.pianetafanta?.saved;
      setMessage(
        `Alias salvato. Voti della giornata ${roundNumber} riapplicati${typeof saved === 'number' ? ` (${saved} voti consolidati)` : ''}.`
      );
      setPicking(null);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Errore');
    } finally {
      setSaving(null);
    }
  };

  const remove = async (alias: AliasRow) => {
    if (!window.confirm(`Eliminare l'alias "${alias.alias}"?`)) return;
    setSaving(alias.id);
    try {
      const response = await fetch(`/api/admin/alias?id=${alias.id}&round=${roundNumber}`, { method: 'DELETE' });
      const json = await response.json();
      if (!json.success) throw new Error(json.error ?? 'Eliminazione non riuscita');
      setMessage('Alias eliminato e voti riapplicati.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Errore');
    } finally {
      setSaving(null);
    }
  };

  const unmatched = (data?.unmatched ?? []).filter((item) => !onlyRostered || item.rostered);
  const aliases = (data?.aliases ?? []).filter((alias) => {
    const words = normalize(aliasQuery).split(/\s+/).filter(Boolean);
    const haystack = normalize(`${alias.alias} ${alias.playerName ?? ''} ${alias.source}`);
    return words.every((word) => haystack.includes(word));
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="ALIAS" isLive={false} />
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Alias giocatori</h2>
            <p className="text-sm text-gray-500">Abbina i nomi dei file voti ai giocatori: al salvataggio i voti vengono riapplicati.</p>
          </div>
          <label className="text-sm text-gray-600">
            Giornata{' '}
            <select
              value={roundNumber}
              onChange={(event) => {
                setLoading(true);
                setRoundNumber(Number(event.target.value));
              }}
              className="ml-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm"
            >
              {calendar.map((round) => (
                <option key={round.number} value={round.number}>
                  {round.number}ª (Serie A {round.serieAMatchday}ª)
                </option>
              ))}
            </select>
          </label>
        </div>

        {message && (
          <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </div>
        )}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="min-w-0">
            <CardContent className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900">
                  Non abbinati <span className="text-sm font-normal text-gray-500">({unmatched.length}/{data?.unmatched.length ?? 0})</span>
                </h3>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={onlyRostered} onChange={(event) => setOnlyRostered(event.target.checked)} />
                  Solo probabili giocatori in rosa
                </label>
              </div>
              {loading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
                  <Loader2 size={16} className="animate-spin" /> Caricamento…
                </div>
              ) : unmatched.length === 0 ? (
                <p className="py-6 text-sm text-gray-500">Nessun nome da abbinare per questa giornata.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {unmatched.map((item) => {
                    const key = `${item.source}|${item.team}|${item.name}`;
                    return (
                      <li key={key} className="py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              {item.teamCode ?? item.team} · {item.role ?? '—'} · voto {item.vote == null ? 's.v.' : formatVote(item.vote)} ·{' '}
                              {item.source === 'pianetafanta' ? 'pianetafanta' : 'fantacalcio.it'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPicking(picking === key ? null : key)}
                            className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Scegli giocatore
                          </button>
                        </div>
                        {item.suggestions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.suggestions.slice(0, 4).map((suggestion) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                disabled={saving === key}
                                onClick={() => save(key, { alias: item.name, playerId: suggestion.id, source: item.source })}
                                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs disabled:opacity-60 ${
                                  suggestion.best
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {saving === key ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                {suggestion.name}
                                {suggestion.fantaTeam && <span className="text-gray-500">· {fantaLabel(suggestion.fantaTeam)}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                        {picking === key && data && (
                          <PlayerPicker
                            players={data.players}
                            initialQuery={item.name.split(' ')[0] ?? ''}
                            onCancel={() => setPicking(null)}
                            onPick={(player) => save(key, { alias: item.name, playerId: player.id, source: item.source })}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardContent className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900">
                  Alias salvati <span className="text-sm font-normal text-gray-500">({data?.aliases.length ?? 0})</span>
                </h3>
                <input
                  value={aliasQuery}
                  onChange={(event) => setAliasQuery(event.target.value)}
                  placeholder="Filtra…"
                  aria-label="Filtra alias"
                  className="w-40 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm"
                />
              </div>
              <ul className="max-h-[70vh] divide-y divide-gray-100 overflow-y-auto">
                {aliases.map((alias) => {
                  const key = `alias|${alias.id}`;
                  return (
                    <li key={alias.id} className="py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{alias.alias}</div>
                          <div className="truncate text-xs text-gray-500">
                            → {alias.playerName ?? alias.playerId} · {alias.realTeam ?? '—'} · {alias.source}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => setPicking(picking === key ? null : key)}
                            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                            aria-label={`Modifica ${alias.alias}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={saving === alias.id}
                            onClick={() => remove(alias)}
                            className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                            aria-label={`Elimina ${alias.alias}`}
                          >
                            {saving === alias.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </div>
                      {picking === key && data && (
                        <PlayerPicker
                          players={data.players}
                          initialQuery={alias.playerName?.split(' ')[0] ?? ''}
                          onCancel={() => setPicking(null)}
                          onPick={(player) =>
                            save(key, { id: alias.id, alias: alias.alias, playerId: player.id, source: alias.source })
                          }
                        />
                      )}
                    </li>
                  );
                })}
                {!loading && aliases.length === 0 && <li className="py-4 text-sm text-gray-500">Nessun alias.</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
