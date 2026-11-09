'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { RouteSkeleton } from '@/components/ui/route-skeleton';
import { GiornaleRoundNav } from '@/components/giornale/giornale-round-nav';
import Link from 'next/link';

/** Indice giornale: reindirizza all'ultima edizione, con fallback elenco. */
export default function GiornaleIndexPage() {
  const router = useRouter();
  const [rounds, setRounds] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/round-articles?list=1')
      .then(async (res) => {
        const json = (await res.json()) as { success?: boolean; rounds?: number[] };
        return json.success && Array.isArray(json.rounds) ? json.rounds : [];
      })
      .then((list) => {
        if (cancelled) return;
        if (list.length > 0) {
          router.replace(`/giornale/${list[list.length - 1]}`);
          return;
        }
        setRounds([]);
      })
      .catch(() => {
        if (!cancelled) setRounds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (rounds === null) {
    return <RouteSkeleton variant="sfida" label="Apro il giornale…" />;
  }

  return (
    <div className="min-h-screen bg-[#f7f5f0] pb-24">
      <Header title="GIORNALE" isLive={false} />
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-gray-500">Nessuna edizione pubblicata.</p>
        <GiornaleRoundNav currentRound={0} />
        <Link href="/" className="mt-4 inline-block text-sm text-emerald-700 underline">
          Torna alla home
        </Link>
      </div>
    </div>
  );
}
