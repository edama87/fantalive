'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { analysisParagraphs, type MatchComment } from '@/lib/match-comments-shared';
import { MessageSquareText } from 'lucide-react';

export function MatchCommentSection({
  round,
  homeTeamId,
  awayTeamId,
}: {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}) {
  const [comment, setComment] = useState<MatchComment | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({
      round: String(round),
      home: homeTeamId,
      away: awayTeamId,
    });
    fetch(`/api/match-comments?${qs}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const json = (await res.json()) as { success?: boolean; comment?: MatchComment | null };
        return json.success ? (json.comment ?? null) : null;
      })
      .then((c) => {
        if (!cancelled) setComment(c);
      })
      .catch(() => {
        if (!cancelled) setComment(null);
      });
    return () => {
      cancelled = true;
    };
  }, [round, homeTeamId, awayTeamId]);

  if (comment === undefined || comment === null) return null;

  const paragraphs = analysisParagraphs(comment.analysis);

  return (
    <Card className="border-gray-200 bg-white">
      <CardHeader className="px-3 pb-1.5 pt-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <MessageSquareText size={15} className="text-emerald-600" aria-hidden />
          Commento
        </h3>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <div className="space-y-2 text-sm leading-relaxed text-gray-700">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="border-t border-gray-100 pt-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Chiusura
          </p>
          <p className="text-sm italic leading-relaxed text-gray-600">{comment.ironicNote}</p>
        </div>
      </CardContent>
    </Card>
  );
}
