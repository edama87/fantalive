'use client';

import {
  articleParagraphs,
  MASTHEAD_NAME,
  paragraphImageMap,
  type RoundArticle,
} from '@/lib/round-articles-shared';

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

      {article.headerImageUrl ? (
        <figure className="-mx-4 mt-4 overflow-hidden border-y border-gray-300 bg-gray-100 sm:mx-0 sm:rounded-sm sm:border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.headerImageUrl}
            alt="Vignetta di apertura de Il Bundle Quotidiano"
            width={1600}
            height={900}
            loading="eager"
            decoding="async"
            className="h-auto w-full object-cover"
          />
        </figure>
      ) : null}

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
              {img ? (
                <figure className="-mx-4 overflow-hidden border-y border-gray-200 bg-gray-50 sm:mx-0 sm:rounded-sm sm:border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt}
                    width={1000}
                    height={700}
                    loading="lazy"
                    decoding="async"
                    className="h-auto w-full object-cover"
                  />
                  <figcaption className="px-3 py-1.5 text-center text-[10px] uppercase tracking-wider text-gray-400">
                    Vignetta
                  </figcaption>
                </figure>
              ) : null}
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
