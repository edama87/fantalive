'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TeamLineupCard } from '@/components/match/team-lineup-card';
import { EventLegend } from '@/components/match/event-emoji';
import { VoteSourceLegend } from '@/components/match/vote-source';
import { MatchRecap } from '@/components/match/match-recap';
import { RouteSkeleton } from '@/components/ui/route-skeleton';
import { GoalsPill, TeamBadge } from '@/components/match/team-badge';
import { cn, formatSignedPoints, formatVote } from '@/lib/utils';
import { FantasyMatchResult, PlayerMatchData, ModifiersBreakdown } from '@/types';
import { getRoundByNumber } from '@/data/calendar';
import { getTeamById } from '@/data/teams';
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
import { ArrowLeft, Home, Info, Plane } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { ModifierExplanation, MODIFIER_TITLES, type ModifierKind } from '@/components/match/modifier-explanation';

export function SfidaContent() {
  const router = useRouter();
  const params = useParams();
  const roundNumber = parseInt(params.round as string, 10);
  const matchId = params.matchId as string;
  const [homeTeamId, awayTeamId] = matchId ? matchId.split('-') : ['', ''];
  
  const [match, setMatch] = useState<FantasyMatchResult | null>(null);
  const [isLive, setIsLive] = useState(false);
  const myTeamId = useMyTeamId();
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
    return <RouteSkeleton variant="sfida" label="Carico la sfida…" />;
  }

  const isUserMatch = myTeamId !== null && (homeTeamId === myTeamId || awayTeamId === myTeamId);

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

            {/* Stemmi ai lati, pillola con i gol al centro, fantapunti sotto. Righe condivise: allineato qualunque sia il nome. */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-3 text-center">
              {([['home', homeTeamId, homeTeam.name, Home, 'Casa'], ['away', awayTeamId, awayTeam.name, Plane, 'Trasferta']] as const).map(([side, id, name, Icon, label]) => (
                <div key={side} className={cn('flex min-w-0 flex-col items-center', side === 'home' ? 'col-start-1' : 'col-start-3', 'row-start-1')}>
                  <div className="mb-2 flex items-center justify-center gap-1 text-xs text-gray-500">
                    <Icon size={13} />
                    <span>{label}</span>
                  </div>
                  <TeamBadge id={id} name={name} mine={id === myTeamId} size="lg" />
                  <div title={name} className={cn('mt-2 flex min-h-[3rem] items-start justify-center text-base font-bold leading-6 break-words', id === myTeamId && 'text-emerald-700')}>
                    <span className="line-clamp-2">{name}</span>
                  </div>
                </div>
              ))}
              <div className="col-start-2 row-start-1 flex flex-col items-center pt-9">
                <GoalsPill home={match.homeGoals} away={match.awayGoals} size="lg" />
                <div className="mt-2 flex w-full justify-between gap-6 px-1 text-sm tabular-nums text-gray-400">
                  <span title="Fantapunti casa">{formatVote(match.homeTotal)}</span>
                  <span title="Fantapunti trasferta">{formatVote(match.awayTotal)}</span>
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

        <MatchRecap
          collapsible
          fixtures={fixtures}
          homeName={homeTeam.name}
          awayName={awayTeam.name}
          home={match.homePlayerScores}
          away={match.awayPlayerScores}
        />

        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:items-start md:space-y-0">
          <TeamLineupCard
            title={homeTeam.name}
            isUserTeam={homeTeamId === myTeamId}
            playerScores={match.homePlayerScores}
            isHome={true}
            fixtures={fixtures}
          />

          <TeamLineupCard
            title={awayTeam.name}
            isUserTeam={awayTeamId === myTeamId}
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

function ModifierRow({
  label,
  value,
  onOpen,
  positiveOnly,
}: {
  label: string;
  value: number;
  onOpen?: () => void;
  positiveOnly?: boolean;
}) {
  const color =
    value > 0 ? 'text-green-600' : value < 0 && !positiveOnly ? 'text-red-600' : 'text-gray-600';
  const content = (
    <>
      <span className="text-gray-500 flex items-center gap-1">
        {label}
        {onOpen && <Info size={12} className="text-gray-300" aria-hidden />}
      </span>
      <span className={cn('font-medium', color)}>
        {formatSignedPoints(value)}
      </span>
    </>
  );
  if (!onOpen) return <div className="flex justify-between">{content}</div>;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="-mx-2 flex w-[calc(100%+1rem)] justify-between rounded-lg px-2 py-0.5 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
      aria-haspopup="dialog"
    >
      {content}
    </button>
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
  const [openKind, setOpenKind] = useState<ModifierKind | null>(null);
  const details = modifiers.details;
  const open = (kind: ModifierKind) => (details ? () => setOpenKind(kind) : undefined);
  return (
    <Card>
      <CardHeader className="pb-2">
        <h4 className="text-sm font-medium text-gray-600">{title}</h4>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <ModifierRow label="Mod. Difesa avv." value={modifiers.defenseModifier} onOpen={open('defense')} />
        <ModifierRow label="Mod. Centrocampo" value={modifiers.midfieldModifier} onOpen={open('midfield')} />
        <ModifierRow label="Mod. Attacco" value={modifiers.attackModifier} onOpen={open('attack')} positiveOnly />
        {isHome && (
          <ModifierRow label="Fattore campo" value={modifiers.homeBonus} onOpen={open('home')} />
        )}
        <div className="flex justify-between pt-2 border-t border-gray-100">
          <span className="font-medium">Totale mod.</span>
          <span className={cn(
            'font-bold',
            modifiers.total > 0 ? 'text-green-600' : 
            modifiers.total < 0 ? 'text-red-600' : 'text-gray-900'
          )}>
            {formatSignedPoints(modifiers.total)}
          </span>
        </div>
      </CardContent>
      {details && (
        <Sheet
          open={openKind !== null}
          onClose={() => setOpenKind(null)}
          title={openKind ? `${MODIFIER_TITLES[openKind]} · ${title.replace('Modificatori ', '')}` : ''}
        >
          {openKind && <ModifierExplanation kind={openKind} details={details} />}
        </Sheet>
      )}
    </Card>
  );
}

function IconLegend() {
  return (
    <Card className="bg-gray-50">
      <CardContent className="py-3">
        <EventLegend />
        <VoteSourceLegend className="mt-2" />
      </CardContent>
    </Card>
  );
}
