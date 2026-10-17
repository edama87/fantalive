'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { MatchCard } from '@/components/match/match-card';
import { EventLegend } from '@/components/match/event-emoji';
import { SerieAFixturesCard } from '@/components/match/serie-a-fixtures-card';
import { LiveStandings } from '@/components/match/live-standings';
import { Badge } from '@/components/ui/badge';
import { FantasyMatchResult, LiveStandingsEntry, PlayerMatchData } from '@/types';
import { getCurrentRound, getRoundByNumber } from '@/data/calendar';
import { useMyTeamId } from '@/lib/hooks/use-my-team';
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
  const myTeamId = useMyTeamId();
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
    m => myTeamId !== null && (m.homeTeamId === myTeamId || m.awayTeamId === myTeamId)
  );
  const otherMatches = matches.filter(
    m => m !== userMatch
  );
  const userPlayerScores = userMatch
    ? userMatch.homeTeamId === myTeamId
      ? userMatch.homePlayerScores
      : userMatch.awayPlayerScores
    : [];

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

        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-6 md:items-start md:space-y-0">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Scontri diretti in corso
              </h3>
              <span className="text-xs text-gray-400">{matches.length} partite</span>
            </div>

            {/* flex: i Link delle card sono inline, space-y non li distanzia */}
            <div className="flex flex-col gap-3">
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

          <div className="space-y-4 md:sticky md:top-20">
            {/* Tablet/desktop: partite di Serie A accanto agli scontri diretti */}
            <SerieAFixturesCard
              className="hidden md:block"
              fixtures={fixtures}
              highlightTeams={userPlayerScores
                .map((ps) => ps.player.realTeam)
                .filter((team): team is string => Boolean(team))}
            />

            <LiveStandings standings={standings} />
          </div>
        </div>

        <div className="py-4">
          <EventLegend className="text-xs text-gray-400" />
        </div>
      </div>
    </div>
  );
}
