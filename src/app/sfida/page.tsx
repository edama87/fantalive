'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getCurrentRound } from '@/data/calendar';
import { USER_TEAM_ID } from '@/data/teams';

export default function SfidaPage() {
  const router = useRouter();
  const currentRound = getCurrentRound();
  
  useEffect(() => {
    const userMatch = currentRound.pairings.find(
      p => p.homeTeamId === USER_TEAM_ID || p.awayTeamId === USER_TEAM_ID
    );
    
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
