import { describe, it, expect } from 'vitest';
import { 
  calculateLiveStandings, 
  calculateAllMatches,
  getInitialStandings 
} from '../live-data';
import { FantasyMatchResult, StandingsEntry } from '@/types';

describe('calculateLiveStandings', () => {
  const mockPreviousStandings: StandingsEntry[] = [
    {
      teamId: 'team-1',
      teamName: 'Team 1',
      played: 2,
      won: 1,
      drawn: 1,
      lost: 0,
      goalsFor: 5,
      goalsAgainst: 3,
      points: 4,
      fantaPoints: 4,
    },
    {
      teamId: 'team-2',
      teamName: 'Team 2',
      played: 2,
      won: 0,
      drawn: 1,
      lost: 1,
      goalsFor: 3,
      goalsAgainst: 5,
      points: 1,
      fantaPoints: 1,
    },
  ];

  it('should not add points for matches with status "scheduled"', () => {
    const scheduledMatch: FantasyMatchResult = {
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      homeTotal: 70,
      awayTotal: 65,
      homeGoals: 1,
      awayGoals: 0,
      homeModifiers: { defenseModifier: 0, midfieldModifier: 0, attackModifier: 0, homeBonus: 2, total: 2 },
      awayModifiers: { defenseModifier: 0, midfieldModifier: 0, attackModifier: 0, homeBonus: 0, total: 0 },
      homePlayerScores: [],
      awayPlayerScores: [],
      status: 'scheduled',
    };

    const standings = calculateLiveStandings([scheduledMatch], mockPreviousStandings);

    const team1 = standings.find(s => s.teamId === 'team-1');
    const team2 = standings.find(s => s.teamId === 'team-2');

    expect(team1?.liveFantaPoints).toBe(4);
    expect(team2?.liveFantaPoints).toBe(1);

    expect(team1?.currentMatchResult).toBeUndefined();
    expect(team2?.currentMatchResult).toBeUndefined();
  });

  it('should add points for matches with status "live"', () => {
    const liveMatch: FantasyMatchResult = {
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      homeTotal: 70,
      awayTotal: 65,
      homeGoals: 1,
      awayGoals: 0,
      homeModifiers: { defenseModifier: 0, midfieldModifier: 0, attackModifier: 0, homeBonus: 2, total: 2 },
      awayModifiers: { defenseModifier: 0, midfieldModifier: 0, attackModifier: 0, homeBonus: 0, total: 0 },
      homePlayerScores: [],
      awayPlayerScores: [],
      status: 'live',
    };

    const standings = calculateLiveStandings([liveMatch], mockPreviousStandings);

    const team1 = standings.find(s => s.teamId === 'team-1');
    const team2 = standings.find(s => s.teamId === 'team-2');

    expect(team1?.liveFantaPoints).toBe(7);
    expect(team2?.liveFantaPoints).toBe(1);

    expect(team1?.currentMatchResult).toBeDefined();
    expect(team1?.currentMatchResult?.fantaPoints).toBe(3);
    expect(team2?.currentMatchResult?.fantaPoints).toBe(0);
  });

  it('should add points for matches with status "finished"', () => {
    const finishedMatch: FantasyMatchResult = {
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      homeTotal: 65,
      awayTotal: 65,
      homeGoals: 0,
      awayGoals: 0,
      homeModifiers: { defenseModifier: 0, midfieldModifier: 0, attackModifier: 0, homeBonus: 2, total: 2 },
      awayModifiers: { defenseModifier: 0, midfieldModifier: 0, attackModifier: 0, homeBonus: 0, total: 0 },
      homePlayerScores: [],
      awayPlayerScores: [],
      status: 'finished',
    };

    const standings = calculateLiveStandings([finishedMatch], mockPreviousStandings);

    const team1 = standings.find(s => s.teamId === 'team-1');
    const team2 = standings.find(s => s.teamId === 'team-2');

    expect(team1?.liveFantaPoints).toBe(5);
    expect(team2?.liveFantaPoints).toBe(2);

    expect(team1?.currentMatchResult?.fantaPoints).toBe(1);
    expect(team2?.currentMatchResult?.fantaPoints).toBe(1);
  });

  it('should add points for matches with status "halftime"', () => {
    const halftimeMatch: FantasyMatchResult = {
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      homeTotal: 72,
      awayTotal: 68,
      homeGoals: 2,
      awayGoals: 1,
      homeModifiers: { defenseModifier: 0, midfieldModifier: 0, attackModifier: 0, homeBonus: 2, total: 2 },
      awayModifiers: { defenseModifier: 0, midfieldModifier: 0, attackModifier: 0, homeBonus: 0, total: 0 },
      homePlayerScores: [],
      awayPlayerScores: [],
      status: 'halftime',
    };

    const standings = calculateLiveStandings([halftimeMatch], mockPreviousStandings);

    const team1 = standings.find(s => s.teamId === 'team-1');
    const team2 = standings.find(s => s.teamId === 'team-2');

    expect(team1?.liveFantaPoints).toBe(7);
    expect(team2?.liveFantaPoints).toBe(1);
  });

  it('should return 0 points for all teams when no matches played (initial state)', () => {
    const initialStandings = getInitialStandings();
    const standings = calculateLiveStandings([], initialStandings);

    for (const entry of standings) {
      expect(entry.liveFantaPoints).toBe(0);
      expect(entry.played).toBe(0);
      expect(entry.won).toBe(0);
      expect(entry.drawn).toBe(0);
      expect(entry.lost).toBe(0);
    }
  });

  it('should NOT incorrectly award 1 point per team when matches are scheduled (bug fix)', () => {
    const initialStandings = getInitialStandings();
    
    const scheduledMatches: FantasyMatchResult[] = initialStandings
      .slice(0, 10)
      .reduce((acc, _, idx, arr) => {
        if (idx % 2 === 0 && idx + 1 < arr.length) {
          acc.push({
            homeTeamId: arr[idx].teamId,
            awayTeamId: arr[idx + 1].teamId,
            homeTotal: 0,
            awayTotal: 0,
            homeGoals: 0,
            awayGoals: 0,
            homeModifiers: { defenseModifier: 0, midfieldModifier: 0, attackModifier: 0, homeBonus: 2, total: 2 },
            awayModifiers: { defenseModifier: 0, midfieldModifier: 0, attackModifier: 0, homeBonus: 0, total: 0 },
            homePlayerScores: [],
            awayPlayerScores: [],
            status: 'scheduled',
          });
        }
        return acc;
      }, [] as FantasyMatchResult[]);

    const standings = calculateLiveStandings(scheduledMatches, initialStandings);

    for (const entry of standings) {
      expect(entry.liveFantaPoints).toBe(0);
    }
  });
});
