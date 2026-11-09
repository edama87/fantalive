'use client';

import { articleParagraphs, MASTHEAD_NAME, type RoundArticle } from '@/lib/round-articles-shared';

export function RoundArticleView({
  article,
  dateLabel,
}: {
  article: RoundArticle;
  dateLabel?: string;
}) {
  const paragraphs = articleParagraphs(article.body);
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
      <div className="mt-6 space-y-4 font-serif text-[15px] leading-[1.7] text-gray-800">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <footer className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] uppercase tracking-wider text-gray-400">
        Fine edizione · {MASTHEAD_NAME}
      </footer>
    </article>
  );
}
