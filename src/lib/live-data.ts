'use client';

import { 
  FantasyMatchResult, 
  PlayerMatchData, 
  LiveStandingsEntry,
  Lineup,
  StandingsEntry,
} from '@/types';
import { teams, getTeamById } from '@/data/teams';
import { getRoundByNumber } from '@/data/calendar';
import { calculateMatch } from './scoring-engine';
import { getOrCreateLineup, initializeAllLineups } from './lineup-store';
import { NormalizedMatchData } from '@/providers/types';

export function convertProviderDataToPlayerMatchData(
  normalizedData: NormalizedMatchData
): Map<string, PlayerMatchData> {
  const result = new Map<string, PlayerMatchData>();

  for (const [playerId, playerData] of normalizedData.playerData) {
    result.set(playerId, {
      playerId: playerData.playerId,
      estimatedVote: playerData.estimatedVote,
      minutesPlayed: playerData.minutesPlayed,
      isPlaying: playerData.isPlaying,
      events: playerData.events.map(e => ({
        playerId: e.playerId,
        type: e.type,
        minute: e.minute,
        relatedPlayerId: e.relatedPlayerId,
      })),
    });
  }

  return result;
}

export function calculateAllMatches(
  roundNumber: number,
  playerDataMap: Map<string, PlayerMatchData>
): FantasyMatchResult[] {
  const round = getRoundByNumber(roundNumber);
  if (!round) return [];

  initializeAllLineups(roundNumber);

  const results: FantasyMatchResult[] = [];

  for (const pairing of round.pairings) {
    const homeLineup = getOrCreateLineup(pairing.homeTeamId, roundNumber);
    const awayLineup = getOrCreateLineup(pairing.awayTeamId, roundNumber);

    const anyLive = [...playerDataMap.values()].some(p => p.isPlaying);
    const status = anyLive ? 'live' : 'finished';

    const result = calculateMatch(homeLineup, awayLineup, playerDataMap, status);
    results.push(result);
  }

  return results;
}

function calculatePoints(goalsFor: number, goalsAgainst: number): number {
  if (goalsFor > goalsAgainst) return 3;
  if (goalsFor === goalsAgainst) return 1;
  return 0;
}

export function calculateLiveStandings(
  matches: FantasyMatchResult[],
  previousStandings: StandingsEntry[]
): LiveStandingsEntry[] {
  const standingsMap = new Map<string, LiveStandingsEntry>();

  for (const team of teams) {
    const prev = previousStandings.find(s => s.teamId === team.id) || {
      teamId: team.id,
      teamName: team.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      fantaPoints: 0,
    };

    standingsMap.set(team.id, {
      ...prev,
      liveFantaPoints: prev.fantaPoints,
      liveGoalsFor: prev.goalsFor,
    });
  }

  for (const match of matches) {
    const homeEntry = standingsMap.get(match.homeTeamId);
    const awayEntry = standingsMap.get(match.awayTeamId);

    if (homeEntry) {
      const pts = calculatePoints(match.homeGoals, match.awayGoals);
      homeEntry.liveFantaPoints = homeEntry.fantaPoints + pts;
      homeEntry.liveGoalsFor = homeEntry.goalsFor + match.homeGoals;
      homeEntry.currentMatchResult = {
        opponentId: match.awayTeamId,
        goalsFor: match.homeGoals,
        goalsAgainst: match.awayGoals,
        fantaPoints: pts,
      };
    }

    if (awayEntry) {
      const pts = calculatePoints(match.awayGoals, match.homeGoals);
      awayEntry.liveFantaPoints = awayEntry.fantaPoints + pts;
      awayEntry.liveGoalsFor = awayEntry.goalsFor + match.awayGoals;
      awayEntry.currentMatchResult = {
        opponentId: match.homeTeamId,
        goalsFor: match.awayGoals,
        goalsAgainst: match.homeGoals,
        fantaPoints: pts,
      };
    }
  }

  const entries = Array.from(standingsMap.values());
  
  entries.sort((a, b) => {
    if (b.liveFantaPoints !== a.liveFantaPoints) {
      return b.liveFantaPoints - a.liveFantaPoints;
    }
    return b.liveGoalsFor - a.liveGoalsFor;
  });

  return entries;
}

export function getInitialStandings(): StandingsEntry[] {
  return teams.map(team => ({
    teamId: team.id,
    teamName: team.name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    fantaPoints: 0,
  }));
}
