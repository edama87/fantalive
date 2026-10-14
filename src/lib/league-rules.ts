/**
 * League Rules Configuration
 * 
 * Configurable rules for the Bundlesliga fantasy league.
 * These can be overridden via environment variables or a config file.
 */

export interface ReleaseRule {
  reason: 'still_in_serie_a' | 'left_serie_a' | 'retired' | 'long_term_injury';
  refundPercentage: number;
  description: string;
}

export interface LoanRule {
  type: 'prestito_out' | 'prestito_in';
  fixedCreditsCost: number;
  durationRounds: number | null;
  autoReturn: boolean;
  description: string;
}

export interface InjuryRule {
  creditEffect: 'none' | 'discount' | 'refund';
  discountPercentage: number;
  description: string;
}

export interface MarketWindowRule {
  openDay: number;
  openHour: number;
  closeDay: number;
  closeHour: number;
  closeMinute: number;
  januaryBlocked: boolean;
}

export interface LeagueRules {
  initialAuctionCredits: number;
  initialMarketCredits: number;
  
  rosterSize: {
    total: number;
    goalkeepers: number;
    defenders: number;
    midfielders: number;
    forwards: number;
  };

  releaseRules: ReleaseRule[];
  
  loanRules: LoanRule[];
  
  injuryRule: InjuryRule;
  
  marketWindow: MarketWindowRule;
  
  scoring: {
    goalBonus: number;
    penaltyGoalBonus: number;
    penaltyMissedMalus: number;
    penaltySavedBonus: number;
    assistBonus: number;
    ownGoalMalus: number;
    yellowCardMalus: number;
    redCardMalus: number;
    goalConcededMalus: number;
    homeBonus: number;
  };

  goalThresholds: number[];
}

export const DEFAULT_LEAGUE_RULES: LeagueRules = {
  initialAuctionCredits: 260,
  initialMarketCredits: 60,

  rosterSize: {
    total: 25,
    goalkeepers: 3,
    defenders: 8,
    midfielders: 8,
    forwards: 6,
  },

  releaseRules: [
    {
      reason: 'still_in_serie_a',
      refundPercentage: 0,
      description: 'Giocatore ancora in Serie A - nessun rimborso',
    },
    {
      reason: 'left_serie_a',
      refundPercentage: 0,
      description: 'Giocatore ceduto fuori Serie A - TODO: rimborso da definire',
    },
    {
      reason: 'retired',
      refundPercentage: 0,
      description: 'Giocatore ritirato - TODO: rimborso da definire',
    },
    {
      reason: 'long_term_injury',
      refundPercentage: 0,
      description: 'Infortunio lungo termine - TODO: rimborso da definire',
    },
  ],

  loanRules: [
    {
      type: 'prestito_out',
      fixedCreditsCost: 0,
      durationRounds: null,
      autoReturn: false,
      description: 'Giocatore dato in prestito ad altra squadra',
    },
    {
      type: 'prestito_in',
      fixedCreditsCost: 10,
      durationRounds: null,
      autoReturn: true,
      description: 'Giocatore preso in prestito - costo fisso 10 crediti',
    },
  ],

  injuryRule: {
    creditEffect: 'none',
    discountPercentage: 0,
    description: 'Giocatore infortunato - TODO: effetto crediti da definire (default: nessun effetto)',
  },

  marketWindow: {
    openDay: 1,
    openHour: 0,
    closeDay: 4,
    closeHour: 18,
    closeMinute: 59,
    januaryBlocked: true,
  },

  scoring: {
    goalBonus: 3,
    penaltyGoalBonus: 2,
    penaltyMissedMalus: -3,
    penaltySavedBonus: 3,
    assistBonus: 1,
    ownGoalMalus: -1,
    yellowCardMalus: -0.5,
    redCardMalus: -1,
    goalConcededMalus: -1,
    homeBonus: 2,
  },

  goalThresholds: [66, 72, 77, 81, 85, 89],
};

export function getLeagueRules(): LeagueRules {
  return DEFAULT_LEAGUE_RULES;
}

export function getReleaseRefund(
  reason: ReleaseRule['reason'],
  originalPrice: number
): number {
  const rules = getLeagueRules();
  const rule = rules.releaseRules.find(r => r.reason === reason);
  if (!rule) return 0;
  return Math.floor(originalPrice * (rule.refundPercentage / 100));
}

export function isMarketOpen(date: Date = new Date()): boolean {
  const rules = getLeagueRules();
  const { marketWindow } = rules;

  if (marketWindow.januaryBlocked && date.getMonth() === 0) {
    return false;
  }

  const day = date.getDay();
  const hour = date.getHours();
  const minute = date.getMinutes();

  if (day === marketWindow.openDay && hour >= marketWindow.openHour) {
    return true;
  }

  if (day > marketWindow.openDay && day < marketWindow.closeDay) {
    return true;
  }

  if (day === marketWindow.closeDay) {
    if (hour < marketWindow.closeHour) {
      return true;
    }
    if (hour === marketWindow.closeHour && minute <= marketWindow.closeMinute) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate the actual cost for a market transaction.
 * Applies loan and injury rules.
 */
export function calculateTransactionCost(
  baseBidPrice: number,
  isLoan: boolean,
  isInjured: boolean
): { totalCost: number; breakdown: string } {
  const rules = getLeagueRules();
  
  if (isLoan) {
    const loanRule = rules.loanRules.find(r => r.type === 'prestito_in');
    const loanCost = loanRule?.fixedCreditsCost ?? 10;
    return {
      totalCost: loanCost,
      breakdown: `Prestito: ${loanCost} crediti (costo fisso)`,
    };
  }
  
  let cost = baseBidPrice;
  let breakdown = `Offerta: ${baseBidPrice}`;
  
  if (isInjured && rules.injuryRule.creditEffect !== 'none') {
    if (rules.injuryRule.creditEffect === 'discount') {
      const discount = Math.floor(baseBidPrice * (rules.injuryRule.discountPercentage / 100));
      cost = baseBidPrice - discount;
      breakdown += ` - sconto infortunio ${rules.injuryRule.discountPercentage}% (${discount}) = ${cost}`;
    }
  }
  
  return { totalCost: cost, breakdown };
}

/**
 * Calculate refund for releasing a player.
 * Currently always 0 for Serie A players, configurable for others.
 */
export function calculateReleaseRefund(
  reason: ReleaseRule['reason'],
  originalAcquisitionPrice: number
): { refund: number; breakdown: string } {
  const rules = getLeagueRules();
  const rule = rules.releaseRules.find(r => r.reason === reason);
  
  if (!rule) {
    return { refund: 0, breakdown: 'Regola non trovata - nessun rimborso' };
  }
  
  if (rule.refundPercentage === 0) {
    return { refund: 0, breakdown: rule.description };
  }
  
  const refund = Math.floor(originalAcquisitionPrice * (rule.refundPercentage / 100));
  return {
    refund,
    breakdown: `${rule.description}: ${rule.refundPercentage}% di ${originalAcquisitionPrice} = ${refund}`,
  };
}

/**
 * Get loan cost (fixed at 10 credits per confirmed rules)
 */
export function getLoanCost(): number {
  const rules = getLeagueRules();
  const loanRule = rules.loanRules.find(r => r.type === 'prestito_in');
  return loanRule?.fixedCreditsCost ?? 10;
}
