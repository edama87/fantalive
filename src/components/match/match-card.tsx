'use client';

import { GoalRuleInfo } from '@/components/match/goal-rule-info';
import { useEffect, useRef, useState } from 'react';
import { countOnPitch } from '@/lib/on-pitch';

import { Card } from '@/components/ui/card';
import { VoteSourceSummary } from '@/components/match/vote-source';
import { LinkPendingIcon } from '@/components/ui/link-pending';
import { LiveDot } from '@/components/ui/live-dot';
import { EventEmojis, eventEmojiSequence } from '@/components/match/event-emoji';
import { cn, formatVote } from '@/lib/utils';
import { FantasyMatchResult, PlayerScore } from '@/types';
import { splitBonusSummary } from '@/lib/bonus-summary';
import { getTeamById } from '@/data/teams';
import { GoalsPill, TeamBadge } from '@/components/match/team-badge';
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
  const emojiClass = 'inline-flex flex-wrap items-center gap-1 text-sm leading-none';
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

function hasBonusEvents(scores: PlayerScore[]): boolean {
  const { counted, excluded } = splitBonusSummary(scores);
  return eventEmojiSequence(counted, { includeConceded: false }).length + eventEmojiSequence(excluded, { includeConceded: false }).length > 0;
}

/** Puntino rosso in overlay: al tocco spiega che i voti sono live. Sta dentro il Link, quindi blocca la navigazione. */
function LiveVotesDot() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span ref={ref} className="absolute right-2 top-2 z-10">
      <button
        type="button"
        aria-label="Voti live, giornata in corso"
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        className="flex h-6 w-6 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
      >
        <LiveDot size="md" />
      </button>
      {open && (
        <span role="tooltip" className="absolute right-0 top-7 whitespace-nowrap rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-md ring-1 ring-gray-200">
          Voti live, giornata in corso
        </span>
      )}
    </span>
  );
}

function Side({ id, name, mine, scores, playing, isLive }: { id: string; name: string; mine: boolean; scores: PlayerScore[]; playing: number; isLive: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <TeamBadge id={id} name={name} mine={mine} />
      <div className="mt-1.5 flex min-h-10 items-start justify-center">
        <span className={cn('line-clamp-2 break-words text-sm font-semibold leading-5 text-gray-900', mine && 'text-emerald-700')}>{name}</span>
      </div>
      <VoteSourceSummary scores={scores} align="center" />
      {isLive && playing > 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <LiveDot size="sm" />
          <span>In campo {playing}/11</span>
        </div>
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
    countOnPitch(scores);

  const homePlayingCount = playingCount(match.homePlayerScores);
  const awayPlayingCount = playingCount(match.awayPlayerScores);

  return (
    <Link href={`/sfida/${roundNumber}/${match.homeTeamId}-${match.awayTeamId}`} className={className}>
      <Card className={cn(
        'hover:shadow-md transition-shadow cursor-pointer',
        'relative',
        isUserMatch && 'ring-1 ring-emerald-200 bg-emerald-50/30'
      )}>
        {isLive && <LiveVotesDot />}
        <div className="p-4">
          {isUserMatch && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-emerald-600 font-medium">● LA TUA SFIDA</span>
            </div>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2">
            <Side id={match.homeTeamId} name={homeTeam?.name || match.homeTeamId} mine={isMine(match.homeTeamId)} scores={match.homePlayerScores} playing={homePlayingCount} isLive={isLive} />
            <div className="flex flex-col items-center pt-1">
              <span className="relative inline-flex"><GoalsPill home={match.homeGoals} away={match.awayGoals} /><GoalRuleInfo homeTeamId={match.homeTeamId} awayTeamId={match.awayTeamId} homeTotal={match.homeTotal} awayTotal={match.awayTotal} className="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2" /></span>
              <div className="mt-1.5 flex w-full justify-between gap-4 px-1 text-xs tabular-nums text-gray-400">
                <span title="Fantapunti casa">{formatVote(match.homeTotal)}</span>
                <span title="Fantapunti trasferta">{formatVote(match.awayTotal)}</span>
              </div>
              <LinkPendingIcon size={12} className="mt-1 text-gray-400" />
            </div>
            <Side id={match.awayTeamId} name={awayTeam?.name || match.awayTeamId} mine={isMine(match.awayTeamId)} scores={match.awayPlayerScores} playing={awayPlayingCount} isLive={isLive} />
          </div>

          {showBonusSummary && (hasBonusEvents(match.homePlayerScores) || hasBonusEvents(match.awayPlayerScores)) && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <BonusSummary scores={match.homePlayerScores} side="home" />
              <BonusSummary scores={match.awayPlayerScores} side="away" />
            </div>
          )}

        </div>
      </Card>
    </Link>
  );
}
