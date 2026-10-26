'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getCurrentRound, getRoundByNumber } from '@/data/calendar';
import { useActiveRound } from '@/lib/use-active-round';
import { MY_TEAM_COOKIE, parseMyTeam, readCookie } from '@/lib/my-team';

export default function SfidaPage() {
  const router = useRouter();
  const active = useActiveRound();
  const currentRound = getRoundByNumber(active.round) ?? getCurrentRound();

  useEffect(() => {
    if (!active.ready) return;
    const myTeamId = parseMyTeam(readCookie(document.cookie, MY_TEAM_COOKIE));
    const userMatch = myTeamId
      ? currentRound.pairings.find(p => p.homeTeamId === myTeamId || p.awayTeamId === myTeamId)
      : currentRound.pairings[0];
    
    if (userMatch) {
      router.replace(`/sfida/${currentRound.number}/${userMatch.homeTeamId}-${userMatch.awayTeamId}`);
    } else {
      router.replace('/');
    }
  }, [router, currentRound, active.ready]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Caricamento sfida...</p>
    </div>
  );
}
