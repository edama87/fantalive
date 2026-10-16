'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { MatchCard } from '@/components/match/match-card';
import { LiveStandings } from '@/components/match/live-standings';
import { Badge } from '@/components/ui/badge';
import { FantasyMatchResult, LiveStandingsEntry, PlayerMatchData } from '@/types';
import { getCurrentRound, getRoundByNumber } from '@/data/calendar';
import { USER_TEAM_ID } from '@/data/teams';
import { 
  calculateAllMatches, 
  calculateLiveStandings, 
  getInitialStandings,
  convertProviderDataToPlayerMatchData,
} from '@/lib/live-data';
import { createLineupProvider, fetchLineupBundle } from '@/lib/lineup-store';
import { createMockProvider } from '@/providers/mock-provider';

const POLLING_INTERVAL = 60000;

export default function GiornataLivePage() {
  const [matches, setMatches] = useState<FantasyMatchResult[]>([]);
  const [standings, setStandings] = useState<LiveStandingsEntry[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);

  const currentRound = getCurrentRound();

  const fetchData = useCallback(async () => {
    const provider = createMockProvider(42);
    await provider.initialize();
    
    const normalizedData = await provider.fetchLiveData(currentRound.serieAMatchday);
    const playerDataMap = convertProviderDataToPlayerMatchData(normalizedData);
    const { lineups, players } = await fetchLineupBundle(currentRound.number).catch(() => ({
      lineups: {},
      players: {},
    }));
    
    const calculatedMatches = calculateAllMatches(
      currentRound.number,
      playerDataMap,
      undefined,
      createLineupProvider(lineups),
      players
    );
    setMatches(calculatedMatches);
    
    const liveStandings = calculateLiveStandings(calculatedMatches, getInitialStandings());
    setStandings(liveStandings);
    
    setLastUpdate(normalizedData.lastUpdated);
    setIsLive(normalizedData.isLive);
    
    provider.dispose();
  }, [currentRound]);

  useEffect(() => {
    fetchData();
    
    const interval = setInterval(fetchData, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const userMatch = matches.find(
    m => m.homeTeamId === USER_TEAM_ID || m.awayTeamId === USER_TEAM_ID
  );
  const otherMatches = matches.filter(
    m => m.homeTeamId !== USER_TEAM_ID && m.awayTeamId !== USER_TEAM_ID
  );

  return (
    <div className="min-h-screen">
      <Header isLive={isLive} />
      
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Bundlesliga</h2>
            <p className="text-sm text-gray-500">
              {currentRound.number}ª giornata · Serie A {currentRound.serieAMatchday}ª · {currentRound.date}
            </p>
          </div>
          <Badge variant="live">stima live</Badge>
        </div>

        <div className="text-sm text-gray-500">
          Fasce gol: <span className="font-medium">66 · 72 · 77 · 82</span>
          {lastUpdate && (
            <span className="ml-4 text-gray-400">
              Aggiornato {lastUpdate.toLocaleTimeString('it-IT', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Scontri diretti in corso
            </h3>
            <span className="text-xs text-gray-400">{matches.length} partite</span>
          </div>

          <div className="space-y-3">
            {userMatch && (
              <MatchCard 
                match={userMatch} 
                roundNumber={currentRound.number}
                showBonusSummary
              />
            )}
            
            {otherMatches.map(match => (
              <MatchCard
                key={`${match.homeTeamId}-${match.awayTeamId}`}
                match={match}
                roundNumber={currentRound.number}
                showBonusSummary
              />
            ))}
          </div>
        </div>

        <LiveStandings standings={standings} />

        <div className="text-center text-xs text-gray-400 py-4">
          <p>Gol +3 · Assist +1 · Giallo -0,5 · Rosso -1 · Rig. segnato +2 · Rig. sbagliato -3 · Rig.</p>
          <p>parato +3 · Autogol -1 · Gol subito (P) -1</p>
        </div>
      </div>
    </div>
  );
}
