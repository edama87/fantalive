'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiveDot } from '@/components/ui/live-dot';
import { cn } from '@/lib/utils';
import { NormalizedSerieAMatch, NormalizedPlayerData } from '@/providers/types';
import { getCurrentRound } from '@/data/calendar';
import { USER_TEAM_ID, getTeamById } from '@/data/teams';
import { createMockProvider } from '@/providers/mock-provider';

export default function PartiteSerieAPage() {
  const [matches, setMatches] = useState<NormalizedSerieAMatch[]>([]);
  const [playerData, setPlayerData] = useState<Map<string, NormalizedPlayerData>>(new Map());
  const [isLive, setIsLive] = useState(false);

  const currentRound = getCurrentRound();
  const userTeam = getTeamById(USER_TEAM_ID);

  const fetchData = useCallback(async () => {
    const provider = createMockProvider(42);
    await provider.initialize();
    
    const data = await provider.fetchLiveData(currentRound.serieAMatchday);
    setMatches(data.serieAMatches);
    setPlayerData(data.playerData);
    setIsLive(data.isLive);
    
    provider.dispose();
  }, [currentRound]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const countMyPlayers = (realTeam: string): number => {
    if (!userTeam) return 0;
    
    let count = 0;
    for (const [_, data] of playerData) {
      if (data.realTeam === realTeam) {
        const isMyPlayer = userTeam.players.some(p => p.id === data.playerId);
        if (isMyPlayer && data.minutesPlayed > 0) {
          count++;
        }
      }
    }
    return count;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header isLive={isLive} />
      
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Partite Serie A</h2>
            <p className="text-sm text-gray-500">
              {currentRound.serieAMatchday}ª giornata · {currentRound.date}
            </p>
          </div>
          {isLive && (
            <Badge variant="live">
              <LiveDot size="sm" className="mr-1" />
              Live
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          {matches.map((match, idx) => {
            const homeCount = countMyPlayers(match.homeTeam);
            const awayCount = countMyPlayers(match.awayTeam);
            const hasMyPlayers = homeCount > 0 || awayCount > 0;

            return (
              <Card 
                key={match.matchId}
                className={cn(
                  hasMyPlayers && 'ring-1 ring-emerald-200 bg-emerald-50/30'
                )}
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {match.homeTeam}
                        </span>
                        {homeCount > 0 && (
                          <Badge variant="userTeam" className="text-[10px]">
                            {homeCount} miei
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="px-4 text-center">
                      {match.status === 'scheduled' ? (
                        <span className="text-gray-400 text-sm">vs</span>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-lg">
                            {match.homeScore} - {match.awayScore}
                          </span>
                          {match.status === 'live' && (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <LiveDot size="sm" />
                              <span>{match.minute}'</span>
                            </div>
                          )}
                          {match.status === 'halftime' && (
                            <span className="text-xs text-amber-600">Intervallo</span>
                          )}
                          {match.status === 'finished' && (
                            <span className="text-xs text-gray-400">Finita</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {awayCount > 0 && (
                          <Badge variant="userTeam" className="text-[10px]">
                            {awayCount} miei
                          </Badge>
                        )}
                        <span className="font-medium text-gray-900">
                          {match.awayTeam}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {matches.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nessuna partita disponibile
          </div>
        )}
      </div>
    </div>
  );
}
