'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { RoundArticleView } from '@/components/giornale/round-article-view';
import { RouteSkeleton } from '@/components/ui/route-skeleton';
import { getRoundByNumber } from '@/data/calendar';
import type { RoundArticle } from '@/lib/round-articles-shared';

export default function GiornaleRoundPage() {
  const params = useParams();
  const router = useRouter();
  const round = parseInt(params.round as string, 10);
  const [article, setArticle] = useState<RoundArticle | null | undefined>(undefined);
  const roundMeta = getRoundByNumber(round);

  useEffect(() => {
    let cancelled = false;
    if (!Number.isInteger(round) || round <= 0) {
      queueMicrotask(() => {
        if (!cancelled) setArticle(null);
      });
      return () => {
        cancelled = true;
      };
    }
    fetch(`/api/round-articles?round=${round}`)
      .then(async (res) => {
        const json = (await res.json()) as { success?: boolean; article?: RoundArticle | null };
        return json.success ? (json.article ?? null) : null;
      })
      .then((a) => {
        if (!cancelled) setArticle(a);
      })
      .catch(() => {
        if (!cancelled) setArticle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [round]);

  if (article === undefined) {
    return <RouteSkeleton variant="sfida" label="Apro il giornale…" />;
  }

  return (
    <div className="min-h-screen bg-[#f7f5f0] pb-24">
      <Header title="GIORNALE" isLive={false} />
      <div className="px-4 py-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={18} />
          <span>Indietro</span>
        </button>
        {article ? (
          <RoundArticleView article={article} dateLabel={roundMeta?.date} />
        ) : (
          <p className="text-center text-sm text-gray-500">Nessuna edizione per questa giornata.</p>
        )}
      </div>
    </div>
  );
}
