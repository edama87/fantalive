'use client';

import { cn, formatNumber } from '@/lib/utils';
import { PlayerScore } from '@/types';
import { RoleBadge } from '@/components/ui/icons';
import {
  GoalIcon,
  AssistIcon,
  YellowCardIcon,
  RedCardIcon,
  PenaltyMissedIcon,
  PenaltySavedIcon,
  OwnGoalIcon,
} from '@/components/ui/icons';
import { LiveDot } from '@/components/ui/live-dot';

interface PlayerRowProps {
  playerScore: PlayerScore;
  isSubstitute?: boolean;
}

function EventIcons({ bonuses }: { bonuses: PlayerScore['bonuses'] }) {
  const icons = [];
  
  for (let i = 0; i < bonuses.goals; i++) {
    icons.push(<GoalIcon key={`g${i}`} size={14} />);
  }
  for (let i = 0; i < bonuses.penaltyGoals; i++) {
    icons.push(<span key={`pg${i}`} className="text-green-600 text-[10px] font-bold">R⚽</span>);
  }
  for (let i = 0; i < bonuses.assists; i++) {
    icons.push(<AssistIcon key={`a${i}`} size={14} />);
  }
  for (let i = 0; i < bonuses.yellowCards; i++) {
    icons.push(<YellowCardIcon key={`y${i}`} size={14} />);
  }
  for (let i = 0; i < bonuses.redCards; i++) {
    icons.push(<RedCardIcon key={`r${i}`} size={14} />);
  }
  for (let i = 0; i < bonuses.penaltyMissed; i++) {
    icons.push(<PenaltyMissedIcon key={`pm${i}`} size={14} />);
  }
  for (let i = 0; i < bonuses.penaltySaved; i++) {
    icons.push(<PenaltySavedIcon key={`ps${i}`} size={14} />);
  }
  for (let i = 0; i < bonuses.ownGoals; i++) {
    icons.push(<OwnGoalIcon key={`og${i}`} size={14} />);
  }

  return icons.length > 0 ? (
    <div className="flex items-center gap-0.5">{icons}</div>
  ) : null;
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

export function PlayerRow({ playerScore, isSubstitute }: PlayerRowProps) {
  const { player, baseVote, bonuses, fantavoto, status, minutesPlayed } = playerScore;

  return (
    <div className={cn(
      'flex items-center justify-between py-2 px-3',
      isSubstitute && 'bg-gray-50/50',
      status === 'sv' && 'opacity-60'
    )}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <RoleBadge role={player.role} />
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn(
            'font-medium text-gray-900 truncate',
            status === 'sv' && 'text-gray-500'
          )}>
            {player.name}
          </span>
          <EventIcons bonuses={bonuses} />
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
