'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  articleParagraphs,
  MASTHEAD_NAME,
  type ParagraphImage,
  type RoundArticle,
} from '@/lib/round-articles-shared';

export function RoundArticleAdmin({ round }: { round: number }) {
  const [headline, setHeadline] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [paragraphImages, setParagraphImages] = useState<ParagraphImage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const paragraphs = useMemo(() => articleParagraphs(body), [body]);

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
      setParagraphImages([]);
      setLoaded(true);
      return;
    }
    setHeadline(json.article?.headline ?? '');
    setSubtitle(json.article?.subtitle ?? '');
    setBody(json.article?.body ?? '');
    setParagraphImages(json.article?.paragraphImages ?? []);
    setLoaded(true);
  }, [round]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function updateDescription(paragraphIndex: number, description: string) {
    setParagraphImages((prev) => {
      const existing = prev.find((x) => x.paragraphIndex === paragraphIndex);
      if (existing) {
        return prev.map((x) =>
          x.paragraphIndex === paragraphIndex ? { ...x, description } : x,
        );
      }
      return prev;
    });
  }

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
          headerImageUrl: null,
          paragraphImages,
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

  async function upload(file: File, paragraphIndex: number) {
    const key = `p${paragraphIndex + 1}`;
    setUploading(key);
    setStatus(null);
    try {
      const existing = paragraphImages.find((x) => x.paragraphIndex === paragraphIndex);
      const fd = new FormData();
      fd.set('file', file);
      fd.set('round', String(round));
      fd.set('slot', 'paragraph');
      fd.set('paragraphIndex', String(paragraphIndex));
      fd.set('alt', existing?.alt || `Vignetta del paragrafo ${paragraphIndex + 1}`);
      if (existing?.description) fd.set('description', existing.description);
      const res = await fetch('/api/admin/round-articles/images', { method: 'POST', body: fd });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        url?: string;
        article?: RoundArticle;
      };
      if (!res.ok || !json.success) {
        setStatus(json.error ?? 'Upload fallito');
        return;
      }
      if (json.article) {
        setParagraphImages(json.article.paragraphImages ?? []);
      }
      setStatus(`Vignetta ${key} aggiornata`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Errore upload');
    } finally {
      setUploading(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <h2 className="text-sm font-semibold text-gray-700">
          {MASTHEAD_NAME} · articolo G{round}
        </h2>
        <p className="text-xs text-gray-500">
          Titolo, occhiello, pezzo e vignette per paragrafo (con descrizione).
        </p>
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

            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-600">Vignette per paragrafo</p>
              {paragraphs.map((p, i) => {
                const img = paragraphImages.find((x) => x.paragraphIndex === i);
                return (
                  <div key={i} className="rounded-lg border border-gray-100 bg-white p-3">
                    <p className="mb-1 text-[11px] font-medium text-gray-500">Paragrafo {i + 1}</p>
                    <p className="mb-2 line-clamp-2 text-xs text-gray-600">{p}</p>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt={img.alt || ''} className="mb-2 max-h-24 w-full rounded object-cover" />
                    ) : (
                      <p className="mb-2 text-xs text-gray-400">Nessuna vignetta</p>
                    )}
                    {img ? (
                      <label className="mb-2 block text-[11px] font-medium text-gray-500">
                        Descrizione vignetta
                        <textarea
                          value={img.description ?? ''}
                          onChange={(e) => updateDescription(i, e.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs leading-snug"
                          placeholder="Breve descrizione della scena…"
                        />
                      </label>
                    ) : null}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void upload(f, i);
                        e.target.value = '';
                      }}
                      className="block w-full text-xs"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={saving || !headline.trim() || !body.trim()}
                onClick={() => void save()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Salvo…' : 'Salva articolo'}
              </button>
              {uploading && <span className="text-sm text-gray-500">Upload {uploading}…</span>}
              {status && <span className="text-sm text-gray-500">{status}</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
