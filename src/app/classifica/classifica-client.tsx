'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { LiveStandingsEntry, PlayerMatchData } from '@/types';
import { getCurrentRound, calendar } from '@/data/calendar';
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
import { createLineupProvider, fetchLineupBundle } from '@/lib/lineup-store';
import { createMockProvider } from '@/providers/mock-provider';
import { StandingsTable, CalendarView } from './page';

type Tab = 'classifica' | 'calendario';

export function ClassificaClient({
  initialStandings,
  initialIsLive,
}: {
  initialStandings: LiveStandingsEntry[];
  initialIsLive: boolean;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('classifica');
  const [standings, setStandings] = useState<LiveStandingsEntry[]>(initialStandings);
  const [isLive, setIsLive] = useState(initialIsLive);
  const [selectedRound, setSelectedRound] = useState(getCurrentRound().number);

  const currentRound = getCurrentRound();

  const fetchData = useCallback(async () => {
    try {
      const lineupPromise = fetchLineupBundle(currentRound.number).catch(() => ({
        lineups: {},
        players: {},
      }));

      let playerDataMap: Map<string, PlayerMatchData>;
      let live: boolean;

      if (shouldUseMockLiveData()) {
        const provider = createMockProvider(42);
        await provider.initialize();
        const data = await provider.fetchLiveData(currentRound.serieAMatchday);
        playerDataMap = convertProviderDataToPlayerMatchData(data);
        live = data.isLive;
        provider.dispose();
      } else {
        const roundData = await fetchRoundPlayerData(currentRound.number);
        playerDataMap = roundData.playerData;
        live = roundData.isLive;
      }

      const { lineups, players } = await lineupPromise;
      const matchStatuses = shouldUseMockLiveData()
        ? new Map(
            currentRound.pairings.map((pairing) => [
              `${pairing.homeTeamId}-${pairing.awayTeamId}`,
              live ? 'live' as const : 'scheduled' as const,
            ])
          )
        : inferMatchStatuses(currentRound.pairings, live, playerDataMap);

      const matches = calculateAllMatches(
        currentRound.number,
        playerDataMap,
        matchStatuses,
        createLineupProvider(lineups),
        players
      );
      const liveStandings = calculateLiveStandings(matches, getInitialStandings());

      setStandings(liveStandings);
      setIsLive(live);
    } catch (error) {
      console.error('[classifica] voti non disponibili', error);
    }
  }, [currentRound]);

  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <>
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
                    : r.number === currentRound.number
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                )}
              >
                {r.number}ª
              </button>
            ))}
          </div>
          <CalendarView currentRound={currentRound.number} selectedRound={selectedRound} />
        </div>
      )}
    </>
  );
}
