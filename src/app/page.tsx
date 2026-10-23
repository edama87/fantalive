'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { RoundNav } from '@/components/layout/round-nav';
import { parseGiornata, type CumulativeStandingsEntry } from '@/lib/standings';
import { Header } from '@/components/layout/header';
import { MatchCard } from '@/components/match/match-card';
import { EventLegend } from '@/components/match/event-emoji';
import { VoteSourceLegend } from '@/components/match/vote-source';
import { MatchSkeleton, Spinner } from '@/components/ui/spinner';
import { SerieAFixturesCard } from '@/components/match/serie-a-fixtures-card';
import { LiveStandings } from '@/components/match/live-standings';
import { Badge } from '@/components/ui/badge';
import { FantasyMatchResult, PlayerMatchData } from '@/types';
import { calendar, getCurrentRound, getRoundByNumber } from '@/data/calendar';
import { useMyTeamId } from '@/lib/hooks/use-my-team';
import { 
  calculateAllMatches, 
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
  return (
    <Suspense>
      <GiornataLive />
    </Suspense>
  );
}

function GiornataLive() {
  const [matches, setMatches] = useState<FantasyMatchResult[]>([]);
  const [standings, setStandings] = useState<CumulativeStandingsEntry[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  // Primo caricamento (scheletri) e aggiornamenti periodici (spinner piccolo).
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const myTeamId = useMyTeamId();
  const [fixtures, setFixtures] = useState<RoundFixture[]>([]);

  const liveRound = getCurrentRound();
  const searchParams = useSearchParams();
  const giornata = parseGiornata(searchParams.get('giornata'), calendar.length);
  const currentRound = (giornata ? getRoundByNumber(giornata) : undefined) ?? liveRound;
  const [standingsMeta, setStandingsMeta] = useState<{ round: number; partial: boolean }>({ round: 0, partial: false });

  const fetchData = useCallback(async () => {
    setRefreshing(true);
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

      // Classifica cumulata dopo questa giornata (giornate precedenti incluse).
      const standingsRes = await fetch(`/api/standings?giornata=${Math.min(currentRound.number, liveRound.number)}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (standingsRes?.standings) {
        setStandings(standingsRes.standings);
        setStandingsMeta({ round: standingsRes.round, partial: standingsRes.partial });
      }

      setLastUpdate(updatedAt);
      setIsLive(live);
    } catch (error) {
      console.error('[giornata] voti non disponibili', error);
    } finally {
      setRefreshing(false);
      setLoaded(true);
    }
  }, [currentRound, liveRound.number]);

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
        <RoundNav selected={currentRound.number} max={calendar.length} current={liveRound.number} />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Bundlesliga</h2>
            <p className="text-sm text-gray-500">
              {currentRound.number}ª giornata · Serie A {currentRound.serieAMatchday}ª · {currentRound.date}
            </p>
          </div>
          {currentRound.number === liveRound.number && <Badge variant="live">stima live</Badge>}
        </div>

        <div className="text-sm text-gray-500">
          Fasce gol: <span className="font-medium">66 · 72 · 77 · 82</span>
          {refreshing && loaded && (
            <span className="ml-3 inline-flex align-middle" role="status" aria-label="Aggiornamento in corso">
              <Spinner size="sm" />
            </span>
          )}
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
                {currentRound.number === liveRound.number ? 'Scontri diretti in corso' : currentRound.number < liveRound.number ? 'Risultati' : 'Scontri diretti'}
              </h3>
              <span className="text-xs text-gray-400">{loaded ? `${matches.length} partite` : ''}</span>
            </div>

            {/* flex: i Link delle card sono inline, space-y non li distanzia */}
            <div className="flex flex-col gap-3">
              {!loaded && (
                <>
                  <div className="flex items-center gap-2 text-sm text-gray-400" role="status">
                    <Spinner size="sm" /> Carico le sfide…
                  </div>
                  {Array.from({ length: 5 }, (_, i) => <MatchSkeleton key={i} />)}
                </>
              )}
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

            {currentRound.number <= liveRound.number && standingsMeta.round > 0 && (
              <LiveStandings standings={standings} round={standingsMeta.round} partial={standingsMeta.partial} />
            )}
          </div>
        </div>

        <div className="py-4">
          <EventLegend className="text-xs text-gray-400" />
          <VoteSourceLegend className="mt-2" />
        </div>
      </div>
    </div>
  );
}
