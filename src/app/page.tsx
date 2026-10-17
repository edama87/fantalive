'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { MatchCard } from '@/components/match/match-card';
import { TeamLineupCard } from '@/components/match/team-lineup-card';
import { EventLegend } from '@/components/match/event-emoji';
import { LiveStandings } from '@/components/match/live-standings';
import { Badge } from '@/components/ui/badge';
import { FantasyMatchResult, LiveStandingsEntry, PlayerMatchData } from '@/types';
import { getCurrentRound, getRoundByNumber } from '@/data/calendar';
import { getTeamById, USER_TEAM_ID } from '@/data/teams';
import { 
  calculateAllMatches, 
  calculateLiveStandings, 
  getInitialStandings,
  convertProviderDataToPlayerMatchData,
  inferMatchStatuses,
} from '@/lib/live-data';
import { shouldUseMockLiveData } from '@/lib/live-source';
import { fetchRoundPlayerData } from '@/lib/round-player-data-client';
import { teamStatusesFromFixtures, type RoundFixture } from '@/lib/serie-a-fixtures';
import { createLineupProvider, fetchLineupBundle } from '@/lib/lineup-store';
import { createMockProvider } from '@/providers/mock-provider';

const POLLING_INTERVAL = 60000;

export default function GiornataLivePage() {
  const [matches, setMatches] = useState<FantasyMatchResult[]>([]);
  const [standings, setStandings] = useState<LiveStandingsEntry[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [fixtures, setFixtures] = useState<RoundFixture[]>([]);

  const currentRound = getCurrentRound();

  const fetchData = useCallback(async () => {
    try {
      const lineupPromise = fetchLineupBundle(currentRound.number).catch(() => ({
        lineups: {},
        players: {},
      }));

      let playerDataMap: Map<string, PlayerMatchData>;
      let live: boolean;
      let updatedAt: Date;
      let roundFixtures: RoundFixture[] = [];

      if (shouldUseMockLiveData()) {
        const provider = createMockProvider(42);
        await provider.initialize();
        const normalizedData = await provider.fetchLiveData(currentRound.serieAMatchday);
        playerDataMap = convertProviderDataToPlayerMatchData(normalizedData);
        live = normalizedData.isLive;
        updatedAt = normalizedData.lastUpdated;
        provider.dispose();
      } else {
        const roundData = await fetchRoundPlayerData(currentRound.number);
        playerDataMap = roundData.playerData;
        live = roundData.isLive;
        updatedAt = roundData.lastUpdated;
        roundFixtures = roundData.fixtures;
      }

      const { lineups, players } = await lineupPromise;
      const calculatedMatches = calculateAllMatches(
        currentRound.number,
        playerDataMap,
        shouldUseMockLiveData() || roundFixtures.length > 0
          ? undefined
          : inferMatchStatuses(currentRound.pairings, live, playerDataMap),
        createLineupProvider(lineups),
        players,
        roundFixtures.length > 0 ? teamStatusesFromFixtures(roundFixtures) : undefined
      );
      setMatches(calculatedMatches);
      setFixtures(roundFixtures);

      const liveStandings = calculateLiveStandings(calculatedMatches, getInitialStandings());
      setStandings(liveStandings);

      setLastUpdate(updatedAt);
      setIsLive(live);
    } catch (error) {
      console.error('[giornata] voti non disponibili', error);
    }
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

            {userMatch && (
              <TeamLineupCard
                title={getTeamById(USER_TEAM_ID)?.name ?? 'La tua squadra'}
                isUserTeam
                isHome={userMatch.homeTeamId === USER_TEAM_ID}
                playerScores={
                  userMatch.homeTeamId === USER_TEAM_ID
                    ? userMatch.homePlayerScores
                    : userMatch.awayPlayerScores
                }
                fixtures={fixtures}
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

        <div className="py-4">
          <EventLegend className="text-xs text-gray-400" />
        </div>
      </div>
    </div>
  );
}
