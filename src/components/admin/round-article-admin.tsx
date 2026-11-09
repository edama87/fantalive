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
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
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
      setHeaderImageUrl(null);
      setParagraphImages([]);
      setLoaded(true);
      return;
    }
    setHeadline(json.article?.headline ?? '');
    setSubtitle(json.article?.subtitle ?? '');
    setBody(json.article?.body ?? '');
    setHeaderImageUrl(json.article?.headerImageUrl ?? null);
    setParagraphImages(json.article?.paragraphImages ?? []);
    setLoaded(true);
  }, [round]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
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
          headerImageUrl,
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

  async function upload(slot: 'header' | 'paragraph', file: File, paragraphIndex?: number) {
    const key = slot === 'header' ? 'header' : `p${(paragraphIndex ?? 0) + 1}`;
    setUploading(key);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('round', String(round));
      fd.set('slot', slot);
      if (slot === 'paragraph' && paragraphIndex !== undefined) {
        fd.set('paragraphIndex', String(paragraphIndex));
        fd.set('alt', `Vignetta del paragrafo ${paragraphIndex + 1}`);
      }
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
        setHeaderImageUrl(json.article.headerImageUrl);
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
          Titolo, occhiello, pezzo e vignette (apertura + una per paragrafo).
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

            <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-600">Vignetta di apertura</p>
              {headerImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={headerImageUrl} alt="" className="max-h-28 w-full rounded object-cover" />
              ) : (
                <p className="text-xs text-gray-400">Nessuna</p>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={uploading !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload('header', f);
                  e.target.value = '';
                }}
                className="block w-full text-xs"
              />
            </div>

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
                      <img src={img.url} alt={img.alt} className="mb-2 max-h-24 w-full rounded object-cover" />
                    ) : (
                      <p className="mb-2 text-xs text-gray-400">Nessuna vignetta</p>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void upload('paragraph', f, i);
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
