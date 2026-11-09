'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MASTHEAD_NAME, type RoundArticle } from '@/lib/round-articles-shared';

export function RoundArticleAdmin({ round }: { round: number }) {
  const [headline, setHeadline] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setStatus(null);
    setLoaded(false);
    const res = await fetch(`/api/admin/round-articles?round=${round}`);
    const json = (await res.json()) as { success?: boolean; article?: RoundArticle | null; error?: string };
    if (!res.ok || !json.success) {
      setStatus(json.error ?? 'Lettura fallita');
      setHeadline('');
      setSubtitle('');
      setBody('');
      setLoaded(true);
      return;
    }
    setHeadline(json.article?.headline ?? '');
    setSubtitle(json.article?.subtitle ?? '');
    setBody(json.article?.body ?? '');
    setLoaded(true);
  }, [round]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/round-articles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round,
          headline,
          subtitle: subtitle.trim() ? subtitle : null,
          body,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setStatus(json.error ?? 'Salvataggio fallito');
        return;
      }
      setStatus('Articolo salvato');
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Errore');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <h2 className="text-sm font-semibold text-gray-700">
          {MASTHEAD_NAME} · articolo G{round}
        </h2>
        <p className="text-xs text-gray-500">Titolo ad effetto, occhiello e pezzo unico sulla giornata.</p>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        {!loaded ? (
          <p className="text-sm text-gray-400">Carico…</p>
        ) : (
          <>
            <label className="block text-xs font-medium text-gray-500">
              Titolo
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-gray-500">
              Occhiello (opzionale)
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-gray-500">
              Articolo
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-serif text-sm leading-relaxed"
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={saving || !headline.trim() || !body.trim()}
                onClick={() => void save()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Salvo…' : 'Salva articolo'}
              </button>
              {status && <span className="text-sm text-gray-500">{status}</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
