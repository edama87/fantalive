'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MatchComment } from '@/lib/match-comments-shared';
import type { MatchPairing } from '@/types';
import { RoundArticleAdmin } from '@/components/admin/round-article-admin';

type TeamOpt = { id: string; name: string };

export function MatchCommentsAdmin({
  rounds,
  teams,
  pairingsByRound,
}: {
  rounds: number[];
  teams: TeamOpt[];
  pairingsByRound: Record<number, MatchPairing[]>;
}) {
  const [round, setRound] = useState(rounds.includes(5) ? 5 : rounds[0] ?? 1);
  const [homeTeamId, setHome] = useState('');
  const [awayTeamId, setAway] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [ironicNote, setIronic] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<MatchComment[]>([]);

  const nameOf = useCallback((id: string) => teams.find((t) => t.id === id)?.name ?? id, [teams]);
  const pairings = useMemo(() => pairingsByRound[round] ?? [], [pairingsByRound, round]);

  const loadRound = useCallback(async (r: number) => {
    setStatus(null);
    const res = await fetch(`/api/admin/match-comments?round=${r}`);
    const json = (await res.json()) as { success?: boolean; comments?: MatchComment[]; error?: string };
    if (!res.ok || !json.success) {
      setExisting([]);
      setStatus(json.error ?? 'Lettura fallita');
      return;
    }
    setExisting(json.comments ?? []);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRound(round);
      const first = pairingsByRound[round]?.[0];
      if (first) {
        setHome(first.homeTeamId);
        setAway(first.awayTeamId);
      }
    });
  }, [round, loadRound, pairingsByRound]);

  useEffect(() => {
    queueMicrotask(() => {
      const found = existing.find((c) => c.homeTeamId === homeTeamId && c.awayTeamId === awayTeamId);
      setAnalysis(found?.analysis ?? '');
      setIronic(found?.ironicNote ?? '');
    });
  }, [existing, homeTeamId, awayTeamId]);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/match-comments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round, homeTeamId, awayTeamId, analysis, ironicNote }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setStatus(json.error ?? 'Salvataggio fallito');
        return;
      }
      setStatus('Salvato');
      await loadRound(round);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <RoundArticleAdmin round={round} />
      <div className="flex flex-wrap gap-2">
        {rounds.filter((r) => r <= 10).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRound(r)}
            className={cn(
              'rounded-full px-3 py-1 text-sm',
              r === round ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600',
            )}
          >
            G{r}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3">
          <h2 className="text-sm font-semibold text-gray-700">Sfide giornata {round}</h2>
        </CardHeader>
        <CardContent className="space-y-2 pb-3">
          {pairings.map((p) => {
            const selected = p.homeTeamId === homeTeamId && p.awayTeamId === awayTeamId;
            const has = existing.some((c) => c.homeTeamId === p.homeTeamId && c.awayTeamId === p.awayTeamId);
            return (
              <button
                key={`${p.homeTeamId}-${p.awayTeamId}`}
                type="button"
                onClick={() => {
                  setHome(p.homeTeamId);
                  setAway(p.awayTeamId);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm',
                  selected ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100 bg-white',
                )}
              >
                <span>
                  {nameOf(p.homeTeamId)} – {nameOf(p.awayTeamId)}
                </span>
                <Badge variant={has ? 'userTeam' : 'role'}>{has ? 'ok' : 'vuoto'}</Badge>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Modifica · {nameOf(homeTeamId)} vs {nameOf(awayTeamId)}
          </h2>
        </CardHeader>
        <CardContent className="space-y-3 pb-3">
          <label className="block text-xs font-medium text-gray-500">
            Analisi
            <textarea
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800"
            />
          </label>
          <label className="block text-xs font-medium text-gray-500">
            Nota ironica (Chiusura)
            <textarea
              value={ironicNote}
              onChange={(e) => setIronic(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm italic text-gray-700"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving || !analysis.trim() || !ironicNote.trim()}
              onClick={() => void save()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Salvo…' : 'Salva commento'}
            </button>
            {status && <span className="text-sm text-gray-500">{status}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
