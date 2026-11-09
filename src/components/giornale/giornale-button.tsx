'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import { MASTHEAD_NAME } from '@/lib/round-articles-shared';

/** Pulsante testata: nascosto se la giornata non ha articolo. */
export function GiornaleButton({ round }: { round: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/round-articles?round=${round}`)
      .then(async (res) => {
        if (!res.ok) return false;
        const json = (await res.json()) as { success?: boolean; article?: unknown };
        return Boolean(json.success && json.article);
      })
      .then((ok) => {
        if (!cancelled) setVisible(ok);
      })
      .catch(() => {
        if (!cancelled) setVisible(false);
      });
    return () => {
      cancelled = true;
    };
  }, [round]);

  if (!visible) return null;

  return (
    <Link
      href={`/giornale/${round}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-gray-800 shadow-sm hover:border-emerald-400 hover:text-emerald-800"
      title={`${MASTHEAD_NAME} · ${round}ª giornata`}
    >
      <Newspaper size={13} className="text-gray-700" aria-hidden />
      <span className="font-serif italic">{MASTHEAD_NAME}</span>
    </Link>
  );
}
