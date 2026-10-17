'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayerRow } from '@/components/match/player-row';
import { cn, formatNumber } from '@/lib/utils';
import { FantasyMatchResult, PlayerMatchData, PlayerScore, ModifiersBreakdown } from '@/types';
import { getRoundByNumber } from '@/data/calendar';
import { getTeamById, USER_TEAM_ID } from '@/data/teams';
import { 
  calculateAllMatches,
  convertProviderDataToPlayerMatchData,
  inferMatchStatuses,
} from '@/lib/live-data';
import { shouldUseMockLiveData } from '@/lib/live-source';
import { fetchRoundPlayerData } from '@/lib/round-player-data-client';
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
      }

      const { lineups, players } = await lineupPromise;
      const matches = calculateAllMatches(
        roundNumber,
        playerDataMap,
        shouldUseMockLiveData()
          ? undefined
          : inferMatchStatuses(round.pairings, live, playerDataMap),
        createLineupProvider(lineups),
        players
      );
      const thisMatch = matches.find(
        m => m.homeTeamId === homeTeamId && m.awayTeamId === awayTeamId
      );

      setMatch(thisMatch || null);
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

        <TeamLineupCard
          title={homeTeam.name}
          isUserTeam={homeTeamId === USER_TEAM_ID}
          playerScores={match.homePlayerScores}
          isHome={true}
        />

        <TeamLineupCard
          title={awayTeam.name}
          isUserTeam={awayTeamId === USER_TEAM_ID}
          playerScores={match.awayPlayerScores}
          isHome={false}
        />

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

function TeamLineupCard({
  title,
  isUserTeam,
  playerScores,
  isHome,
}: {
  title: string;
  isUserTeam: boolean;
  playerScores: PlayerScore[];
  isHome: boolean;
}) {
  // On field: original starters + substitutes who entered (status != to_play)
  const onField = playerScores.filter(
    (ps) => ps.isStarter || ps.status !== 'to_play'
  );
  // Remaining bench: unused substitutes
  const bench = playerScores.filter(
    (ps) => !ps.isStarter && ps.status === 'to_play'
  );
  const total = onField.reduce((sum, ps) => sum + ps.fantavoto, 0);

  return (
    <Card className={cn(isUserTeam && 'ring-1 ring-emerald-200')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isHome ? <Home size={16} className="text-gray-400" /> : <Plane size={16} className="text-gray-400" />}
            <h3 className={cn(
              'font-semibold',
              isUserTeam ? 'text-emerald-700' : 'text-gray-900'
            )}>
              {title}
            </h3>
            {isUserTeam && (
              <Badge variant="userTeam" className="text-[10px]">Tu</Badge>
            )}
          </div>
          <span className="font-bold text-lg">
            {formatNumber(total)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-100">
          {onField.map(ps => (
            <PlayerRow
              key={ps.player.id}
              playerScore={ps}
              isSubstitute={!ps.isStarter}
            />
          ))}
        </div>
        {bench.length > 0 && (
          <>
            <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
              Panchina ({bench.length})
            </div>
            <div className="divide-y divide-gray-100">
              {bench.map(ps => (
                <PlayerRow key={ps.player.id} playerScore={ps} isSubstitute />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function IconLegend() {
  return (
    <Card className="bg-gray-50">
      <CardContent className="py-3">
        <div className="text-xs text-gray-500 text-center space-y-1">
          <p>
            ⚽ Gol +3 · 🅿️ Rig +2 · ❌ Rig sbagliato -3 · 🧤 Rig parato +3
          </p>
          <p>
            👟 Assist +1 · 🟨 Amm. -0,5 · 🟥 Esp. -1 · ⚽↩️ Autogol -1
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
