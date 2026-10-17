'use client';

import { cn, formatVote } from '@/lib/utils';
import { ConsolidatedMark, CONSOLIDATED_TITLE, ESTIMATED_TITLE } from '@/components/match/vote-source';
import { isConsolidatedVote, isEstimatedVote } from '@/lib/vote-source';
import { PlayerScore } from '@/types';
import { RoleBadge } from '@/components/ui/icons';
import { LiveDot } from '@/components/ui/live-dot';
import { EventEmojis } from '@/components/match/event-emoji';
import { isPlayerMuted } from '@/lib/bonus-summary';
import { fixtureLabel, type RoundFixture } from '@/lib/serie-a-fixtures';

interface PlayerRowProps {
  playerScore: PlayerScore;
  isSubstitute?: boolean;
  /** Partita di Serie A della squadra del giocatore (se nota). */
  fixture?: RoundFixture | null;
}

export { isPlayerMuted };

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

/** Fantavoto da mostrare: tra parentesi per i giocatori in grigio (non conta). */
export function displayFantavoto(playerScore: PlayerScore): string {
  if (playerScore.fantavoto <= 0) return '-';
  const value = formatVote(playerScore.fantavoto);
  return isPlayerMuted(playerScore) ? `(${value})` : value;
}

export function PlayerRow({ playerScore, isSubstitute, fixture }: PlayerRowProps) {
  const { player, baseVote, bonuses, fantavoto, status, minutesPlayed } = playerScore;
  const muted = isPlayerMuted(playerScore);
  const consolidated = baseVote > 0 && isConsolidatedVote(playerScore);
  const estimated = isEstimatedVote(playerScore);

  return (
    <div className={cn(
      'flex items-center justify-between py-2 px-3',
      isSubstitute && 'bg-gray-50/50',
      muted && 'opacity-60'
    )}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <RoleBadge role={player.role} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn(
              'font-medium text-gray-900 truncate',
              muted && 'text-gray-500'
            )}>
              {player.name}
            </span>
            <EventEmojis bonuses={bonuses} parenthesized={muted} />
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
        {/* Su tablet/desktop "da giocare" è già nella riga della partita: si risparmia spazio */}
        {fixture && status === 'to_play' ? (
          <div className="md:hidden">
            <StatusBadge status={status} minutesPlayed={minutesPlayed} />
          </div>
        ) : (
          <StatusBadge status={status} minutesPlayed={minutesPlayed} />
        )}
        
        <div className="flex items-center gap-2 w-24 justify-end">
          {consolidated && <ConsolidatedMark />}
          {baseVote > 0 && (
            <span className={cn('text-sm text-gray-500', estimated && 'italic')}>
              {formatVote(baseVote)}
            </span>
          )}
          <span className={cn(
            estimated && 'italic',
            muted && fantavoto > 0 ? 'font-semibold text-base text-gray-500' : 'font-bold text-lg',
            !muted && (
              fantavoto >= 7 ? 'text-green-600' :
              fantavoto >= 6 ? 'text-gray-900' :
              fantavoto > 0 ? 'text-red-500' :
              'text-gray-400'
            ),
            muted && fantavoto <= 0 && 'font-bold text-lg text-gray-400'
          )}
            title={muted && fantavoto > 0 ? 'Non conta nel totale' : consolidated ? CONSOLIDATED_TITLE : estimated ? ESTIMATED_TITLE : undefined}
          >
            {displayFantavoto(playerScore)}
          </span>
        </div>
      </div>
    </div>
  );
}
