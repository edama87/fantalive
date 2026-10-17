import { Suspense } from 'react';
import { connection } from 'next/server';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LiveStandingsEntry, PlayerMatchData } from '@/types';
import { getCurrentRound, calendar } from '@/data/calendar';
import { getTeamById, teams } from '@/data/teams';
import { 
  calculateAllMatches, 
  calculateLiveStandings, 
  getInitialStandings,
  convertProviderDataToPlayerMatchData,
  inferMatchStatuses,
} from '@/lib/live-data';
import { shouldUseMockLiveData } from '@/lib/live-source';
import { getRoundPlayerState } from '@/lib/round-player-data';
import { teamStatusesFromFixtures, type RoundFixture } from '@/lib/serie-a-fixtures';
import {
  createLineupProviderFromMap,
  fetchLineupsForRound,
  fetchPlayersByIds,
  playerIdsFromLineups,
} from '@/lib/lineups-db';
import { createMockProvider } from '@/providers/mock-provider';
import { ClassificaClient } from './classifica-client';

export const instant = false;

async function getStandingsData(): Promise<{ standings: LiveStandingsEntry[]; isLive: boolean }> {
  await connection();
  const currentRound = getCurrentRound();
  
  const lineupsPromise = fetchLineupsForRound(currentRound.number).catch(() => ({}));

  let playerDataMap: Map<string, PlayerMatchData>;
  let isLive: boolean;
  let fixtures: RoundFixture[] = [];

  if (shouldUseMockLiveData()) {
    const provider = createMockProvider(42);
    await provider.initialize();
    const data = await provider.fetchLiveData(currentRound.serieAMatchday);
    playerDataMap = convertProviderDataToPlayerMatchData(data);
    isLive = data.isLive;
    provider.dispose();
  } else {
    const state = await getRoundPlayerState(currentRound.number);
    playerDataMap = state.playerData;
    isLive = state.isLive;
    fixtures = state.fixtures;
  }

  const lineups = await lineupsPromise;
  const players = await fetchPlayersByIds(playerIdsFromLineups(lineups)).catch(() => ({}));

  const matchStatuses = shouldUseMockLiveData()
    ? new Map(
        currentRound.pairings.map((pairing) => [
          `${pairing.homeTeamId}-${pairing.awayTeamId}`,
          isLive ? 'live' as const : 'scheduled' as const,
        ])
      )
    : fixtures.length > 0
      ? undefined
      : inferMatchStatuses(currentRound.pairings, isLive, playerDataMap);

  const matches = calculateAllMatches(
    currentRound.number,
    playerDataMap,
    matchStatuses,
    createLineupProviderFromMap(lineups),
    players,
    fixtures.length > 0 ? teamStatusesFromFixtures(fixtures) : undefined
  );
  const standings = calculateLiveStandings(matches, getInitialStandings());

  return { standings, isLive };
}

export default async function ClassificaPage() {
  const { standings: initialStandings, isLive: initialIsLive } = await getStandingsData();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header isLive={initialIsLive} />
      
      <div className="px-4 py-4 space-y-4">
        <ClassificaClient 
          initialStandings={initialStandings}
          initialIsLive={initialIsLive}
        />
      </div>
    </div>
  );
}

export function StandingsTable({ 
  standings, 
  isLive,
  myTeamId = null,
}: { 
  standings: LiveStandingsEntry[];
  isLive: boolean;
  myTeamId?: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Classifica</h3>
          {isLive && (
            <Badge variant="live" className="text-[10px]">
              Tempo reale
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-xs">
                <th className="text-left py-2 w-8">#</th>
                <th className="text-left py-2">Squadra</th>
                <th className="text-center py-2 w-8">G</th>
                <th className="text-center py-2 w-8">V</th>
                <th className="text-center py-2 w-8">P</th>
                <th className="text-center py-2 w-8">S</th>
                <th className="text-center py-2 w-12">GF</th>
                <th className="text-center py-2 w-12">GS</th>
                <th className="text-center py-2 w-12 font-bold">Pt</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((entry, idx) => {
                const isUserTeam = myTeamId !== null && entry.teamId === myTeamId;
                const team = getTeamById(entry.teamId);
                
                return (
                  <tr 
                    key={entry.teamId}
                    className={cn(
                      'border-b border-gray-50',
                      isUserTeam && 'bg-emerald-50'
                    )}
                  >
                    <td className="py-2 font-medium text-gray-600">
                      {idx + 1}
                    </td>
                    <td className={cn(
                      'py-2',
                      isUserTeam ? 'font-semibold text-emerald-700' : 'text-gray-900'
                    )}>
                      <div className="flex items-center gap-2">
                        {team?.name || entry.teamName}
                        {isUserTeam && (
                          <Badge variant="userTeam" className="text-[10px]">Tu</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-center text-gray-600">{entry.played}</td>
                    <td className="py-2 text-center text-gray-600">{entry.won}</td>
                    <td className="py-2 text-center text-gray-600">{entry.drawn}</td>
                    <td className="py-2 text-center text-gray-600">{entry.lost}</td>
                    <td className="py-2 text-center text-gray-600">{entry.liveGoalsFor}</td>
                    <td className="py-2 text-center text-gray-600">{entry.goalsAgainst}</td>
                    <td className={cn(
                      'py-2 text-center font-bold',
                      isUserTeam ? 'text-emerald-700' : 'text-gray-900'
                    )}>
                      {entry.liveFantaPoints}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function CalendarView({ 
  currentRound,
  selectedRound: initialSelectedRound,
  myTeamId = null,
}: { 
  currentRound: number;
  selectedRound?: number;
  myTeamId?: string | null;
}) {
  const round = calendar.find(r => r.number === (initialSelectedRound || currentRound));

  return (
    <div className="space-y-4">
      {round && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {round.number}ª Giornata
              </h3>
              <span className="text-sm text-gray-500">
                Serie A {round.serieAMatchday}ª · {round.date}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {round.pairings.map((pairing, idx) => {
                const homeTeam = getTeamById(pairing.homeTeamId);
                const awayTeam = getTeamById(pairing.awayTeamId);
                const isUserMatch = myTeamId !== null &&
                  (pairing.homeTeamId === myTeamId || pairing.awayTeamId === myTeamId);

                return (
                  <div 
                    key={idx}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg',
                      isUserMatch ? 'bg-emerald-50' : 'bg-gray-50'
                    )}
                  >
                    <span className={cn(
                      'flex-1',
                      myTeamId !== null && pairing.homeTeamId === myTeamId && 'font-semibold text-emerald-700'
                    )}>
                      {homeTeam?.name}
                    </span>
                    <span className="px-3 text-gray-400">vs</span>
                    <span className={cn(
                      'flex-1 text-right',
                      myTeamId !== null && pairing.awayTeamId === myTeamId && 'font-semibold text-emerald-700'
                    )}>
                      {awayTeam?.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
