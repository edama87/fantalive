'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiveDot } from '@/components/ui/live-dot';
import { EventEmojis } from '@/components/match/event-emoji';
import { cn, formatNumber } from '@/lib/utils';
import { FantasyMatchResult, BonusBreakdown } from '@/types';
import { getTeamById, USER_TEAM_ID } from '@/data/teams';
import Link from 'next/link';

interface MatchCardProps {
  match: FantasyMatchResult;
  roundNumber: number;
  showBonusSummary?: boolean;
  className?: string;
}

function BonusSummary({ bonuses, side }: { bonuses: BonusBreakdown; side: 'home' | 'away' }) {
  return (
    <div className={cn('flex items-center flex-wrap', side === 'away' && 'justify-end')}>
      <EventEmojis bonuses={bonuses} includeConceded={false} className="inline-flex flex-wrap items-center gap-0.5 text-sm leading-none" />
    </div>
  );
}

function aggregateBonuses(scores: { bonuses: BonusBreakdown }[]): BonusBreakdown {
  return scores.reduce((acc, s) => ({
    goals: acc.goals + s.bonuses.goals,
    penaltyGoals: acc.penaltyGoals + s.bonuses.penaltyGoals,
    penaltyMissed: acc.penaltyMissed + s.bonuses.penaltyMissed,
    penaltySaved: acc.penaltySaved + s.bonuses.penaltySaved,
    assists: acc.assists + s.bonuses.assists,
    ownGoals: acc.ownGoals + s.bonuses.ownGoals,
    yellowCards: acc.yellowCards + s.bonuses.yellowCards,
    redCards: acc.redCards + s.bonuses.redCards,
    goalsConceded: acc.goalsConceded + s.bonuses.goalsConceded,
  }), {
    goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
    assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0,
  });
}

export function MatchCard({ match, roundNumber, showBonusSummary = false, className }: MatchCardProps) {
  const homeTeam = getTeamById(match.homeTeamId);
  const awayTeam = getTeamById(match.awayTeamId);
  const isUserMatch = match.homeTeamId === USER_TEAM_ID || match.awayTeamId === USER_TEAM_ID;
  const isLive = match.status === 'live' || match.status === 'halftime';

  const homeBonuses = aggregateBonuses(match.homePlayerScores);
  const awayBonuses = aggregateBonuses(match.awayPlayerScores);

  const playingCount = (scores: typeof match.homePlayerScores) =>
    scores.filter(s => s.status === 'playing').length;

  const homePlayingCount = playingCount(match.homePlayerScores);
  const awayPlayingCount = playingCount(match.awayPlayerScores);

  return (
    <Link href={`/sfida/${roundNumber}/${match.homeTeamId}-${match.awayTeamId}`} className={className}>
      <Card className={cn(
        'hover:shadow-md transition-shadow cursor-pointer',
        isUserMatch && 'ring-1 ring-emerald-200 bg-emerald-50/30'
      )}>
        <div className="p-4">
          {isUserMatch && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-emerald-600 font-medium">● LA TUA SFIDA</span>
              {isLive && (
                <Badge variant="live" className="text-[10px]">
                  Vittoria virtuale
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'font-semibold text-gray-900',
                  match.homeTeamId === USER_TEAM_ID && 'text-emerald-700'
                )}>
                  {homeTeam?.name || match.homeTeamId}
                </span>
                {match.homeTeamId === USER_TEAM_ID && (
                  <Badge variant="userTeam" className="text-[10px]">Tu</Badge>
                )}
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(match.homeTotal)}
                <span className="text-sm font-normal text-gray-500 ml-1">
                  ({match.homeGoals})
                </span>
              </div>
              {isLive && homePlayingCount > 0 && (
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <LiveDot size="sm" />
                  <span>In campo {homePlayingCount}/11</span>
                </div>
              )}
            </div>

            <div className="px-4 text-gray-400 text-sm">vs</div>

            <div className="flex-1 text-right">
              <div className="flex items-center justify-end gap-2">
                {match.awayTeamId === USER_TEAM_ID && (
                  <Badge variant="userTeam" className="text-[10px]">Tu</Badge>
                )}
                <span className={cn(
                  'font-semibold text-gray-900',
                  match.awayTeamId === USER_TEAM_ID && 'text-emerald-700'
                )}>
                  {awayTeam?.name || match.awayTeamId}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                <span className="text-sm font-normal text-gray-500 mr-1">
                  ({match.awayGoals})
                </span>
                {formatNumber(match.awayTotal)}
              </div>
              {isLive && awayPlayingCount > 0 && (
                <div className="flex items-center justify-end gap-1 mt-1 text-xs text-gray-500">
                  <span>In campo {awayPlayingCount}/11</span>
                  <LiveDot size="sm" />
                </div>
              )}
            </div>
          </div>

          {showBonusSummary && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <BonusSummary bonuses={homeBonuses} side="home" />
              <BonusSummary bonuses={awayBonuses} side="away" />
            </div>
          )}

          {!isUserMatch && isLive && (
            <div className="flex items-center justify-center gap-1 mt-3 text-xs text-gray-400">
              <LiveDot size="sm" />
              <span>{match.status === 'halftime' ? 'Intervallo' : 'In corso'}</span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
