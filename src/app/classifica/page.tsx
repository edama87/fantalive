'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatNumber } from '@/lib/utils';
import { LiveStandingsEntry, FantasyMatchResult } from '@/types';
import { getCurrentRound, calendar } from '@/data/calendar';
import { getTeamById, USER_TEAM_ID, teams } from '@/data/teams';
import { 
  calculateAllMatches, 
  calculateLiveStandings, 
  getInitialStandings,
  convertProviderDataToPlayerMatchData,
} from '@/lib/live-data';
import { createMockProvider } from '@/providers/mock-provider';

type Tab = 'classifica' | 'calendario';

export default function ClassificaPage() {
  const [activeTab, setActiveTab] = useState<Tab>('classifica');
  const [standings, setStandings] = useState<LiveStandingsEntry[]>([]);
  const [isLive, setIsLive] = useState(false);

  const currentRound = getCurrentRound();

  const fetchData = useCallback(async () => {
    const provider = createMockProvider(42);
    await provider.initialize();
    
    const data = await provider.fetchLiveData(currentRound.serieAMatchday);
    const playerDataMap = convertProviderDataToPlayerMatchData(data);
    
    const matches = calculateAllMatches(currentRound.number, playerDataMap);
    const liveStandings = calculateLiveStandings(matches, getInitialStandings());
    
    setStandings(liveStandings);
    setIsLive(data.isLive);
    
    provider.dispose();
  }, [currentRound]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header isLive={isLive} />
      
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('classifica')}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
              activeTab === 'classifica'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Classifica
          </button>
          <button
            onClick={() => setActiveTab('calendario')}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
              activeTab === 'calendario'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            Calendario
          </button>
        </div>

        {activeTab === 'classifica' && (
          <StandingsTable standings={standings} isLive={isLive} />
        )}

        {activeTab === 'calendario' && (
          <CalendarView currentRound={currentRound.number} />
        )}
      </div>
    </div>
  );
}

function StandingsTable({ 
  standings, 
  isLive 
}: { 
  standings: LiveStandingsEntry[];
  isLive: boolean;
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
                const isUserTeam = entry.teamId === USER_TEAM_ID;
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

function CalendarView({ currentRound }: { currentRound: number }) {
  const [selectedRound, setSelectedRound] = useState(currentRound);
  const round = calendar.find(r => r.number === selectedRound);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {calendar.slice(0, 9).map(r => (
          <button
            key={r.number}
            onClick={() => setSelectedRound(r.number)}
            className={cn(
              'px-3 py-1 rounded-full text-sm whitespace-nowrap',
              selectedRound === r.number
                ? 'bg-emerald-600 text-white'
                : r.number === currentRound
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600'
            )}
          >
            {r.number}ª
          </button>
        ))}
      </div>

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
                const isUserMatch = 
                  pairing.homeTeamId === USER_TEAM_ID || 
                  pairing.awayTeamId === USER_TEAM_ID;

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
                      pairing.homeTeamId === USER_TEAM_ID && 'font-semibold text-emerald-700'
                    )}>
                      {homeTeam?.name}
                    </span>
                    <span className="px-3 text-gray-400">vs</span>
                    <span className={cn(
                      'flex-1 text-right',
                      pairing.awayTeamId === USER_TEAM_ID && 'font-semibold text-emerald-700'
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
