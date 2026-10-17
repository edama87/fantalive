'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiveDot } from '@/components/ui/live-dot';
import { EventEmojis, eventEmojiSequence } from '@/components/match/event-emoji';
import { cn, formatNumber } from '@/lib/utils';
import { FantasyMatchResult, PlayerScore } from '@/types';
import { splitBonusSummary } from '@/lib/bonus-summary';
import { getTeamById } from '@/data/teams';
import { useMyTeamId } from '@/lib/hooks/use-my-team';
import Link from 'next/link';

interface MatchCardProps {
  match: FantasyMatchResult;
  roundNumber: number;
  showBonusSummary?: boolean;
  className?: string;
}

function BonusSummary({ scores, side }: { scores: PlayerScore[]; side: 'home' | 'away' }) {
  const { counted, excluded } = splitBonusSummary(scores);
  const emojiClass = 'inline-flex flex-wrap items-center gap-0.5 text-sm leading-none';
  return (
    <div className={cn('flex items-center flex-wrap gap-1', side === 'away' && 'justify-end')}>
      <EventEmojis bonuses={counted} includeConceded={false} className={emojiClass} />
      {/* Eventi di giocatori che non contano (in grigio o in panchina) */}
      {eventEmojiSequence(excluded, { includeConceded: false }).length > 0 && (
        <span className="opacity-60" title="Non contano nel totale">
          <EventEmojis bonuses={excluded} includeConceded={false} parenthesized className={emojiClass} />
        </span>
      )}
    </div>
  );
}

export function MatchCard({ match, roundNumber, showBonusSummary = false, className }: MatchCardProps) {
  const homeTeam = getTeamById(match.homeTeamId);
  const awayTeam = getTeamById(match.awayTeamId);
  const myTeamId = useMyTeamId();
  const isMine = (teamId: string) => myTeamId !== null && teamId === myTeamId;
  const isUserMatch = isMine(match.homeTeamId) || isMine(match.awayTeamId);
  const isLive = match.status === 'live' || match.status === 'halftime';


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
                  isMine(match.homeTeamId) && 'text-emerald-700'
                )}>
                  {homeTeam?.name || match.homeTeamId}
                </span>
                {isMine(match.homeTeamId) && (
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
                {isMine(match.awayTeamId) && (
                  <Badge variant="userTeam" className="text-[10px]">Tu</Badge>
                )}
                <span className={cn(
                  'font-semibold text-gray-900',
                  isMine(match.awayTeamId) && 'text-emerald-700'
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
              <BonusSummary scores={match.homePlayerScores} side="home" />
              <BonusSummary scores={match.awayPlayerScores} side="away" />
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
