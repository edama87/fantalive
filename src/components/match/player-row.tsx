'use client';

import { cn, formatNumber } from '@/lib/utils';
import { PlayerScore } from '@/types';
import { RoleBadge } from '@/components/ui/icons';
import { LiveDot } from '@/components/ui/live-dot';
import { EventEmojis } from '@/components/match/event-emoji';
import { fixtureLabel, type RoundFixture } from '@/lib/serie-a-fixtures';

interface PlayerRowProps {
  playerScore: PlayerScore;
  isSubstitute?: boolean;
  /** Partita di Serie A della squadra del giocatore (se nota). */
  fixture?: RoundFixture | null;
}

function StatusBadge({ status, minutesPlayed }: { status: PlayerScore['status']; minutesPlayed?: number }) {
  switch (status) {
    case 'playing':
      return (
        <div className="flex items-center gap-1 text-xs text-green-600">
          <LiveDot size="sm" />
          <span>in campo {minutesPlayed ? `${minutesPlayed}'` : ''}</span>
        </div>
      );
    case 'played':
      return (
        <span className="text-xs text-gray-500">
          {minutesPlayed ? `${minutesPlayed}'` : 'finita'}
        </span>
      );
    case 'to_play':
      return <span className="text-xs text-gray-400">da giocare</span>;
    case 'sv':
      return <span className="text-xs text-orange-500">s.v.</span>;
    case 'substituted':
      return (
        <span className="text-xs text-gray-500">
          ↓ {minutesPlayed ? `${minutesPlayed}'` : ''}
        </span>
      );
    default:
      return null;
  }
}

export function PlayerRow({ playerScore, isSubstitute, fixture }: PlayerRowProps) {
  const { player, baseVote, bonuses, fantavoto, status, minutesPlayed } = playerScore;

  return (
    <div className={cn(
      'flex items-center justify-between py-2 px-3',
      isSubstitute && 'bg-gray-50/50',
      status === 'sv' && 'opacity-60'
    )}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <RoleBadge role={player.role} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn(
              'font-medium text-gray-900 truncate',
              status === 'sv' && 'text-gray-500'
            )}>
              {player.name}
            </span>
            <EventEmojis bonuses={bonuses} />
          </div>
          {(player.realTeam || fixture) && (
            <div className={cn(
              'text-[11px] truncate',
              fixture?.status === 'live' || fixture?.status === 'halftime'
                ? 'text-green-600'
                : 'text-gray-400'
            )}>
              {fixture ? fixtureLabel(fixture) : player.realTeam}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <StatusBadge status={status} minutesPlayed={minutesPlayed} />
        
        <div className="flex items-center gap-2 w-20 justify-end">
          {baseVote > 0 && (
            <span className="text-sm text-gray-500">
              {formatNumber(baseVote)}
            </span>
          )}
          <span className={cn(
            'font-bold text-lg',
            fantavoto >= 7 ? 'text-green-600' :
            fantavoto >= 6 ? 'text-gray-900' :
            fantavoto > 0 ? 'text-red-500' :
            'text-gray-400'
          )}>
            {fantavoto > 0 ? formatNumber(fantavoto) : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}
