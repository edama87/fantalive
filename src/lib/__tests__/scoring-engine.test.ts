import { describe, it, expect } from 'vitest';
import {
  isValidFormation,
  parseFormation,
  calculateBonuses,
  calculateFantavoto,
  calculateDefenseModifier,
  calculateMidfieldModifier,
  calculateAttackModifier,
  calculateGoals,
  applyGoalConversionRules,
  processSubstitutions,
  calculateMatch,
} from '../scoring-engine';
import { PlayerMatchData, Lineup, BonusBreakdown, Player } from '@/types';

describe('Formation Validation', () => {
  it('accepts all valid formations', () => {
    const validFormations = ['6-3-1', '5-3-2', '5-4-1', '4-5-1', '4-4-2', '4-3-3', '3-6-1', '3-5-2', '3-4-3'];
    for (const f of validFormations) {
      expect(isValidFormation(f)).toBe(true);
    }
  });

  it('rejects invalid formations', () => {
    expect(isValidFormation('4-4-3')).toBe(false);
    expect(isValidFormation('5-5-0')).toBe(false);
    expect(isValidFormation('invalid')).toBe(false);
  });
});

describe('Formation Parsing', () => {
  it('parses formation correctly', () => {
    expect(parseFormation('4-4-2')).toEqual({ D: 4, C: 4, A: 2 });
    expect(parseFormation('3-5-2')).toEqual({ D: 3, C: 5, A: 2 });
    expect(parseFormation('6-3-1')).toEqual({ D: 6, C: 3, A: 1 });
  });
});

describe('Bonus Calculation', () => {
  it('calculates bonuses from events', () => {
    const playerData: PlayerMatchData = {
      playerId: 'test',
      estimatedVote: 7,
      minutesPlayed: 90,
      isPlaying: false,
      events: [
        { playerId: 'test', type: 'goal', minute: 25 },
        { playerId: 'test', type: 'assist', minute: 45 },
        { playerId: 'test', type: 'yellow_card', minute: 60 },
      ],
    };

    const player: Player = { id: 'test', name: 'Test', role: 'A', teamId: 'test' };
    const bonuses = calculateBonuses(playerData, player);

    expect(bonuses.goals).toBe(1);
    expect(bonuses.assists).toBe(1);
    expect(bonuses.yellowCards).toBe(1);
    expect(bonuses.penaltyGoals).toBe(0);
  });

  it('counts multiple goals', () => {
    const playerData: PlayerMatchData = {
      playerId: 'test',
      estimatedVote: 8,
      minutesPlayed: 90,
      isPlaying: false,
      events: [
        { playerId: 'test', type: 'goal', minute: 15 },
        { playerId: 'test', type: 'goal', minute: 45 },
        { playerId: 'test', type: 'penalty_scored', minute: 80 },
      ],
    };

    const player: Player = { id: 'test', name: 'Test', role: 'A', teamId: 'test' };
    const bonuses = calculateBonuses(playerData, player);

    expect(bonuses.goals).toBe(2);
    expect(bonuses.penaltyGoals).toBe(1);
  });
});

describe('Fantavoto Calculation', () => {
  it('calculates basic fantavoto without bonuses', () => {
    const bonuses: BonusBreakdown = {
      goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
      assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0,
    };
    expect(calculateFantavoto(6.5, bonuses, false)).toBe(6.5);
  });

  it('adds +3 for goals', () => {
    const bonuses: BonusBreakdown = {
      goals: 1, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
      assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0,
    };
    expect(calculateFantavoto(6.5, bonuses, false)).toBe(9.5);
  });

  it('adds +2 for penalty goals', () => {
    const bonuses: BonusBreakdown = {
      goals: 0, penaltyGoals: 1, penaltyMissed: 0, penaltySaved: 0,
      assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0,
    };
    expect(calculateFantavoto(6.5, bonuses, false)).toBe(8.5);
  });

  it('subtracts -3 for missed penalty', () => {
    const bonuses: BonusBreakdown = {
      goals: 0, penaltyGoals: 0, penaltyMissed: 1, penaltySaved: 0,
      assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0,
    };
    expect(calculateFantavoto(6.5, bonuses, false)).toBe(3.5);
  });

  it('adds +3 for penalty saved (goalkeeper)', () => {
    const bonuses: BonusBreakdown = {
      goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 1,
      assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0,
    };
    expect(calculateFantavoto(6.5, bonuses, true)).toBe(9.5);
  });

  it('adds +1 for assists', () => {
    const bonuses: BonusBreakdown = {
      goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
      assists: 2, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0,
    };
    expect(calculateFantavoto(6.5, bonuses, false)).toBe(8.5);
  });

  it('subtracts -1 for own goals', () => {
    const bonuses: BonusBreakdown = {
      goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
      assists: 0, ownGoals: 1, yellowCards: 0, redCards: 0, goalsConceded: 0,
    };
    expect(calculateFantavoto(6.5, bonuses, false)).toBe(5.5);
  });

  it('subtracts -0.5 for yellow cards', () => {
    const bonuses: BonusBreakdown = {
      goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
      assists: 0, ownGoals: 0, yellowCards: 1, redCards: 0, goalsConceded: 0,
    };
    expect(calculateFantavoto(6.5, bonuses, false)).toBe(6);
  });

  it('subtracts -1 for red cards', () => {
    const bonuses: BonusBreakdown = {
      goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
      assists: 0, ownGoals: 0, yellowCards: 0, redCards: 1, goalsConceded: 0,
    };
    expect(calculateFantavoto(6.5, bonuses, false)).toBe(5.5);
  });

  it('subtracts -1 per goal conceded for goalkeeper', () => {
    const bonuses: BonusBreakdown = {
      goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
      assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 2,
    };
    expect(calculateFantavoto(6.5, bonuses, true)).toBe(4.5);
    expect(calculateFantavoto(6.5, bonuses, false)).toBe(6.5);
  });

  it('handles complex bonus combinations', () => {
    const bonuses: BonusBreakdown = {
      goals: 1, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0,
      assists: 1, ownGoals: 0, yellowCards: 1, redCards: 0, goalsConceded: 0,
    };
    expect(calculateFantavoto(7, bonuses, false)).toBe(10.5);
  });
});

describe('Defense Modifier', () => {
  it('returns +4 for very low average (<5.2)', () => {
    expect(calculateDefenseModifier([4.5, 5, 5, 5], 4)).toBe(4);
  });

  it('returns +3 for average 5.2-5.4', () => {
    expect(calculateDefenseModifier([5.2, 5.3, 5.3, 5.2], 4)).toBe(3);
  });

  it('returns 0 for average around 6', () => {
    expect(calculateDefenseModifier([6, 6, 6, 5.8], 4)).toBe(0);
  });

  it('returns -5 for high average (>=7)', () => {
    expect(calculateDefenseModifier([7.5, 7, 7, 7.5], 4)).toBe(-5);
  });

  it('difesa a 3: modificatore peggiorato di un punto (+1 all\'avversario)', () => {
    const base = calculateDefenseModifier([5.5, 5.5, 5.5], 4);
    const with3 = calculateDefenseModifier([5.5, 5.5, 5.5], 3);
    expect(with3).toBe(base + 1);
  });

  it('oltre 4 difensori: -1 all\'avversario per ogni difensore in più', () => {
    const base = calculateDefenseModifier([5.5, 5.5, 5.5, 5.5], 4);
    const with5 = calculateDefenseModifier([5.5, 5.5, 5.5, 5.5, 5.5], 5);
    expect(with5).toBe(base - 1);
  });

  it('treats 0 votes as 5 for riserva d\'ufficio', () => {
    const withZero = calculateDefenseModifier([6, 6, 6, 0], 4);
    const withFive = calculateDefenseModifier([6, 6, 6, 5], 4);
    expect(withZero).toBe(withFive);
  });
});

describe('Midfield Modifier', () => {
  it('returns 0 for equal midfields', () => {
    const result = calculateMidfieldModifier([6, 6, 6, 6], [6, 6, 6, 6], 4, 4);
    expect(result.homeModifier).toBe(0);
    expect(result.awayModifier).toBe(0);
  });

  it('returns 0 for small difference (<0.75)', () => {
    const result = calculateMidfieldModifier([6, 6, 6, 6], [6, 6, 6, 5.5], 4, 4);
    expect(result.homeModifier).toBe(0);
    expect(result.awayModifier).toBe(0);
  });

  it('returns +/-0.5 for difference 0.75-1.5', () => {
    const result = calculateMidfieldModifier([6.2, 6.2, 6.2, 6.2], [6, 6, 6, 6], 4, 4);
    expect(result.homeModifier).toBe(0.5);
    expect(result.awayModifier).toBe(-0.5);
  });

  it('returns +/-4 for large difference (>=6)', () => {
    const result = calculateMidfieldModifier([8, 8, 8, 8], [6, 6, 6, 6], 4, 4);
    expect(result.homeModifier).toBe(4);
    expect(result.awayModifier).toBe(-4);
  });

  it('pads shorter midfield with 5s', () => {
    const result = calculateMidfieldModifier([6, 6, 6, 6, 6], [6, 6, 6], 5, 3);
    expect(result.homeModifier).toBeGreaterThan(0);
  });

  it('treats 0 votes as 5', () => {
    const withZero = calculateMidfieldModifier([6, 6, 0, 0], [6, 6, 5, 5], 4, 4);
    expect(withZero.homeModifier).toBe(0);
    expect(withZero.awayModifier).toBe(0);
  });
});

describe('Attack Modifier', () => {
  it('returns 0 for forwards who scored', () => {
    const result = calculateAttackModifier([
      { vote: 8, scored: true },
      { vote: 7.5, scored: true },
    ]);
    expect(result).toBe(0);
  });

  it('returns 0 for low-rated forwards', () => {
    const result = calculateAttackModifier([
      { vote: 6, scored: false },
      { vote: 5.5, scored: false },
    ]);
    expect(result).toBe(0);
  });

  it('returns +0.5 for 6.5 rated non-scorer', () => {
    const result = calculateAttackModifier([{ vote: 6.5, scored: false }]);
    expect(result).toBe(0.5);
  });

  it('returns +1 for 7 rated non-scorer', () => {
    const result = calculateAttackModifier([{ vote: 7, scored: false }]);
    expect(result).toBe(1);
  });

  it('returns +1.5 for 7.5 rated non-scorer', () => {
    const result = calculateAttackModifier([{ vote: 7.5, scored: false }]);
    expect(result).toBe(1.5);
  });

  it('returns +2 for 8+ rated non-scorer', () => {
    const result = calculateAttackModifier([{ vote: 8, scored: false }]);
    expect(result).toBe(2);
  });

  it('sums modifiers for multiple forwards', () => {
    const result = calculateAttackModifier([
      { vote: 7, scored: false },
      { vote: 6.5, scored: false },
    ]);
    expect(result).toBe(1.5);
  });
});

describe('Goal Calculation', () => {
  it('returns 0 goals below 66 points', () => {
    expect(calculateGoals(65)).toBe(0);
    expect(calculateGoals(50)).toBe(0);
  });

  it('returns 1 goal for 66-71 points', () => {
    expect(calculateGoals(66)).toBe(1);
    expect(calculateGoals(70)).toBe(1);
    expect(calculateGoals(71.5)).toBe(1);
  });

  it('returns 2 goals for 72-76 points', () => {
    expect(calculateGoals(72)).toBe(2);
    expect(calculateGoals(75)).toBe(2);
  });

  it('returns 3 goals for 77-80 points', () => {
    expect(calculateGoals(77)).toBe(3);
    expect(calculateGoals(80)).toBe(3);
  });

  it('returns 4 goals for 81-84 points', () => {
    expect(calculateGoals(81)).toBe(4);
    expect(calculateGoals(84)).toBe(4);
  });

  it('returns 5 goals for 85-88 points', () => {
    expect(calculateGoals(85)).toBe(5);
    expect(calculateGoals(88)).toBe(5);
  });

  it('returns 6+ goals for 89+ points (every 4 points)', () => {
    expect(calculateGoals(89)).toBe(6);
    expect(calculateGoals(93)).toBe(7);
    expect(calculateGoals(97)).toBe(8);
  });
});

describe('Goal Conversion Rules', () => {
  it('equalizes goals when difference <3 points above 66', () => {
    const result = applyGoalConversionRules(72.5, 70, 2, 1);
    expect(result).toEqual({ homeGoals: 1, awayGoals: 1 });
  });

  it('makes it 0-0 when difference <3 and below 66', () => {
    const result = applyGoalConversionRules(67, 65, 1, 0);
    expect(result).toEqual({ homeGoals: 0, awayGoals: 0 });
  });

  it('gives bonus goal to team above 59 when opponent below 59', () => {
    const result = applyGoalConversionRules(65, 55, 0, 0);
    expect(result).toEqual({ homeGoals: 1, awayGoals: 0 });
  });

  it('does not give bonus when both below 59', () => {
    const result = applyGoalConversionRules(58, 55, 0, 0);
    expect(result).toEqual({ homeGoals: 0, awayGoals: 0 });
  });

  it('gives bonus goal for 4+ point difference in same bracket', () => {
    const result = applyGoalConversionRules(70, 66, 1, 1);
    expect(result).toEqual({ homeGoals: 2, awayGoals: 1 });
  });

  it('does not give bracket bonus below 66', () => {
    const result = applyGoalConversionRules(65, 61, 0, 0);
    expect(result).toEqual({ homeGoals: 0, awayGoals: 0 });
  });

  it('keeps original when difference >= 3', () => {
    const result = applyGoalConversionRules(75, 70, 2, 1);
    expect(result).toEqual({ homeGoals: 2, awayGoals: 1 });
  });
});

describe('Full Match Calculation', () => {
  it('adds home bonus of 2 points', () => {
    const homeLineup: Lineup = {
      teamId: 'home',
      roundNumber: 1,
      formation: '4-4-2',
      starters: [],
      bench: [],
    };
    const awayLineup: Lineup = {
      teamId: 'away',
      roundNumber: 1,
      formation: '4-4-2',
      starters: [],
      bench: [],
    };
    const playerData = new Map<string, PlayerMatchData>();

    const result = calculateMatch(homeLineup, awayLineup, playerData);
    
    expect(result.homeModifiers.homeBonus).toBe(2);
    expect(result.awayModifiers.homeBonus).toBe(0);
  });

  it('keeps imported FMS players that are not in the static seed list', () => {
    const imported: Player = {
      id: 'mctominay-scott-francis-c',
      name: 'MCTOMINAY Scott Francis',
      role: 'C',
      teamId: '',
    };
    const homeLineup: Lineup = {
      teamId: 'ap',
      roundNumber: 1,
      formation: '4-4-2',
      starters: [{ playerId: imported.id, position: 0 }],
      bench: [],
    };
    const awayLineup: Lineup = {
      teamId: 'am',
      roundNumber: 1,
      formation: '4-4-2',
      starters: [],
      bench: [],
    };

    const result = calculateMatch(
      homeLineup,
      awayLineup,
      new Map<string, PlayerMatchData>(),
      'scheduled',
      { [imported.id]: imported }
    );

    expect(result.homePlayerScores.map((score) => score.player.name)).toEqual([
      'MCTOMINAY Scott Francis',
    ]);
  });
});
