'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  articleParagraphs,
  MASTHEAD_NAME,
  paragraphImageMap,
  type ParagraphImage,
  type RoundArticle,
} from '@/lib/round-articles-shared';

function VignetteFigure({ image }: { image: ParagraphImage }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  const description = (image.description || image.alt || '').trim();
  const alt = (image.alt || image.description || 'Vignetta').trim();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onPointer(e: MouseEvent | TouchEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [open]);

  return (
    <figure
      ref={rootRef}
      className="relative -mx-4 overflow-hidden border-y border-gray-200 bg-gray-50 sm:mx-0 sm:rounded-sm sm:border"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={alt}
        width={1000}
        height={700}
        loading="lazy"
        decoding="async"
        className="h-auto w-full object-cover"
      />
      {description ? (
        <>
          <button
            type="button"
            aria-label="Descrizione vignetta"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-gray-300/80 bg-white/90 text-[12px] font-semibold italic text-gray-700 shadow-sm backdrop-blur-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
          >
            i
          </button>
          {open ? (
            <div
              id={panelId}
              role="dialog"
              aria-label="Descrizione vignetta"
              className="absolute inset-x-2 bottom-2 rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-left shadow-md backdrop-blur-sm sm:inset-x-auto sm:right-2 sm:max-w-sm"
            >
              <p className="font-sans text-[12px] leading-snug text-gray-700">{description}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </figure>
  );
}

export function RoundArticleView({
  article,
  dateLabel,
}: {
  article: RoundArticle;
  dateLabel?: string;
}) {
  const paragraphs = articleParagraphs(article.body);
  const byIndex = paragraphImageMap(article.paragraphImages ?? []);

  return (
    <article className="mx-auto max-w-2xl">
      <header className="border-b-2 border-gray-900 pb-3 text-center">
        <p className="font-serif text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
          {MASTHEAD_NAME}
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-gray-500">
          Bundlesliga · {article.round}ª giornata
          {dateLabel ? ` · ${dateLabel}` : ''}
        </p>
      </header>

      <div className="mt-5 space-y-3">
        <h1 className="font-serif text-2xl font-bold leading-snug text-gray-950 sm:text-[1.75rem]">
          {article.headline}
        </h1>
        {article.subtitle ? (
          <p className="text-base leading-relaxed text-gray-600">{article.subtitle}</p>
        ) : null}
      </div>

      <div className="mt-6 space-y-6 font-serif text-[15px] leading-[1.7] text-gray-800">
        {paragraphs.map((p, i) => {
          const img = byIndex.get(i);
          return (
            <section key={i} className="space-y-3">
              {img ? <VignetteFigure image={img} /> : null}
              <p>{p}</p>
            </section>
          );
        })}
      </div>

      <footer className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] uppercase tracking-wider text-gray-400">
        Fine edizione · {MASTHEAD_NAME}
      </footer>
    </article>
  );
}
