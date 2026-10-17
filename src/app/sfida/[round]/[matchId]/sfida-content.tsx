'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TeamLineupCard } from '@/components/match/team-lineup-card';
import { EventLegend } from '@/components/match/event-emoji';
import { cn, formatNumber } from '@/lib/utils';
import { FantasyMatchResult, PlayerMatchData, ModifiersBreakdown } from '@/types';
import { getRoundByNumber } from '@/data/calendar';
import { getTeamById, USER_TEAM_ID } from '@/data/teams';
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
import { ArrowLeft, Home, Plane } from 'lucide-react';

export function SfidaContent() {
  const router = useRouter();
  const params = useParams();
  const roundNumber = parseInt(params.round as string, 10);
  const matchId = params.matchId as string;
  const [homeTeamId, awayTeamId] = matchId ? matchId.split('-') : ['', ''];
  
  const [match, setMatch] = useState<FantasyMatchResult | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [fixtures, setFixtures] = useState<RoundFixture[]>([]);

  const round = getRoundByNumber(roundNumber);
  const homeTeam = getTeamById(homeTeamId);
  const awayTeam = getTeamById(awayTeamId);

  const fetchData = useCallback(async () => {
    if (!round) return;

    try {
      const lineupPromise = fetchLineupBundle(roundNumber).catch(() => ({
        lineups: {},
        players: {},
      }));

      let playerDataMap: Map<string, PlayerMatchData>;
      let live: boolean;
      let roundFixtures: RoundFixture[] = [];

      if (shouldUseMockLiveData()) {
        const provider = createMockProvider(42);
        await provider.initialize();
        const normalizedData = await provider.fetchLiveData(round.serieAMatchday);
        playerDataMap = convertProviderDataToPlayerMatchData(normalizedData);
        live = normalizedData.isLive;
        provider.dispose();
      } else {
        const roundData = await fetchRoundPlayerData(roundNumber);
        playerDataMap = roundData.playerData;
        live = roundData.isLive;
        roundFixtures = roundData.fixtures;
      }

      const { lineups, players } = await lineupPromise;
      const matches = calculateAllMatches(
        roundNumber,
        playerDataMap,
        shouldUseMockLiveData() || roundFixtures.length > 0
          ? undefined
          : inferMatchStatuses(round.pairings, live, playerDataMap),
        createLineupProvider(lineups),
        players,
        roundFixtures.length > 0 ? teamStatusesFromFixtures(roundFixtures) : undefined
      );
      const thisMatch = matches.find(
        m => m.homeTeamId === homeTeamId && m.awayTeamId === awayTeamId
      );

      setMatch(thisMatch || null);
      setFixtures(roundFixtures);
      setIsLive(live);
    } catch (error) {
      console.error('[sfida] voti non disponibili', error);
    }
  }, [roundNumber, homeTeamId, awayTeamId, round]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!match || !homeTeam || !awayTeam) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header isLive={false} />
        <div className="p-4 text-center text-gray-500">
          Caricamento...
        </div>
      </div>
    );
  }

  const isUserMatch = homeTeamId === USER_TEAM_ID || awayTeamId === USER_TEAM_ID;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header isLive={isLive} />
      
      <div className="px-4 py-4 space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} />
          <span>Torna alla giornata</span>
        </button>

        <Card className={cn(
          isUserMatch && 'ring-2 ring-emerald-200'
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="default">
                {roundNumber}ª giornata
              </Badge>
              {isLive && (
                <Badge variant="live">
                  {match.status === 'halftime' ? 'Intervallo' : 'Live'}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-sm text-gray-500 mb-1">
                  <Home size={14} />
                  <span>Casa</span>
                </div>
                <div className={cn(
                  'font-bold text-lg',
                  homeTeamId === USER_TEAM_ID && 'text-emerald-700'
                )}>
                  {homeTeam.name}
                </div>
                <div className="text-3xl font-bold mt-2">
                  {formatNumber(match.homeTotal)}
                </div>
                <div className="text-xl text-gray-600">
                  {match.homeGoals} gol
                </div>
              </div>

              <div className="flex flex-col items-center justify-center">
                <span className="text-2xl text-gray-400">vs</span>
                <div className="text-sm text-gray-500 mt-2">
                  {match.homeGoals} - {match.awayGoals}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-center gap-1 text-sm text-gray-500 mb-1">
                  <Plane size={14} />
                  <span>Trasferta</span>
                </div>
                <div className={cn(
                  'font-bold text-lg',
                  awayTeamId === USER_TEAM_ID && 'text-emerald-700'
                )}>
                  {awayTeam.name}
                </div>
                <div className="text-3xl font-bold mt-2">
                  {formatNumber(match.awayTotal)}
                </div>
                <div className="text-xl text-gray-600">
                  {match.awayGoals} gol
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <ModifiersCard 
            title="Modificatori Casa" 
            modifiers={match.homeModifiers}
            isHome={true}
          />
          <ModifiersCard 
            title="Modificatori Trasferta" 
            modifiers={match.awayModifiers}
            isHome={false}
          />
        </div>

        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:items-start md:space-y-0">
          <TeamLineupCard
            title={homeTeam.name}
            isUserTeam={homeTeamId === USER_TEAM_ID}
            playerScores={match.homePlayerScores}
            isHome={true}
            fixtures={fixtures}
          />

          <TeamLineupCard
            title={awayTeam.name}
            isUserTeam={awayTeamId === USER_TEAM_ID}
            playerScores={match.awayPlayerScores}
            isHome={false}
            fixtures={fixtures}
          />
        </div>

        <IconLegend />
      </div>
    </div>
  );
}

function ModifiersCard({ 
  title, 
  modifiers, 
  isHome 
}: { 
  title: string; 
  modifiers: ModifiersBreakdown;
  isHome: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h4 className="text-sm font-medium text-gray-600">{title}</h4>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Mod. Difesa avv.</span>
          <span className={cn(
            'font-medium',
            modifiers.defenseModifier > 0 ? 'text-green-600' : 
            modifiers.defenseModifier < 0 ? 'text-red-600' : 'text-gray-600'
          )}>
            {modifiers.defenseModifier > 0 ? '+' : ''}{modifiers.defenseModifier}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Mod. Centrocampo</span>
          <span className={cn(
            'font-medium',
            modifiers.midfieldModifier > 0 ? 'text-green-600' : 
            modifiers.midfieldModifier < 0 ? 'text-red-600' : 'text-gray-600'
          )}>
            {modifiers.midfieldModifier > 0 ? '+' : ''}{modifiers.midfieldModifier}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Mod. Attacco</span>
          <span className={cn(
            'font-medium',
            modifiers.attackModifier > 0 ? 'text-green-600' : 'text-gray-600'
          )}>
            {modifiers.attackModifier > 0 ? '+' : ''}{modifiers.attackModifier}
          </span>
        </div>
        {isHome && (
          <div className="flex justify-between">
            <span className="text-gray-500">Fattore campo</span>
            <span className="font-medium text-green-600">+2</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-gray-100">
          <span className="font-medium">Totale mod.</span>
          <span className={cn(
            'font-bold',
            modifiers.total > 0 ? 'text-green-600' : 
            modifiers.total < 0 ? 'text-red-600' : 'text-gray-900'
          )}>
            {modifiers.total > 0 ? '+' : ''}{modifiers.total}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function IconLegend() {
  return (
    <Card className="bg-gray-50">
      <CardContent className="py-3">
        <EventLegend />
      </CardContent>
    </Card>
  );
}
