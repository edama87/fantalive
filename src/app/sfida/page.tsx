'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getCurrentRound } from '@/data/calendar';
import { MY_TEAM_COOKIE, parseMyTeam, readCookie } from '@/lib/my-team';

export default function SfidaPage() {
  const router = useRouter();
  const currentRound = getCurrentRound();
  
  useEffect(() => {
    const myTeamId = parseMyTeam(readCookie(document.cookie, MY_TEAM_COOKIE));
    const userMatch = myTeamId
      ? currentRound.pairings.find(p => p.homeTeamId === myTeamId || p.awayTeamId === myTeamId)
      : currentRound.pairings[0];
    
    if (userMatch) {
      router.replace(`/sfida/${currentRound.number}/${userMatch.homeTeamId}-${userMatch.awayTeamId}`);
    } else {
      router.replace('/');
    }
  }, [router, currentRound]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Caricamento sfida...</p>
    </div>
  );
}
