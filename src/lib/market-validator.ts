/**
 * Market Transaction Validator
 * 
 * Validates parsed market transactions before applying them.
 * Checks for:
 * - Player already owned by the team
 * - Released player not on the team's roster
 * - Role slot overflow (max per role)
 * - Insufficient credits
 * - Duplicate transactions
 * - Unmatched player/team names
 */

import { Player, PlayerRole } from '@/types';
import { ValidatedMarketImport, ParsedMarketRow } from './market-email-parser';
import { getLeagueRules, calculateTransactionCost } from './league-rules';
import { teams, getTeamById } from '@/data/teams';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: ValidationSeverity;
  code: string;
}

export interface ValidatedTransaction {
  id: string;
  original: ParsedMarketRow;
  
  teamId: string | null;
  teamName: string;
  playerInId: string | null;
  playerInName: string;
  playerInRole: PlayerRole | null;
  playerInClub: string;
  playerOutId: string | null;
  playerOutName: string;
  isLoan: boolean;
  isInjured: boolean;
  bidPrice: number;
  effectiveCost: number;
  timestamp: string;
  effectiveRound: number;
  
  issues: ValidationIssue[];
  hasBlockingErrors: boolean;
  isDiscarded: boolean;
}

export interface TeamCreditsSummary {
  teamId: string;
  teamName: string;
  creditsBefore: number;
  creditsAfter: number;
  transactionCount: number;
  totalSpent: number;
  hasInsufficientCredits: boolean;
}

export interface ValidationResult {
  transactions: ValidatedTransaction[];
  teamSummaries: TeamCreditsSummary[];
  totalErrors: number;
  totalWarnings: number;
  canConfirm: boolean;
}

let transactionIdCounter = 0;
function generateTransactionId(): string {
  return `tx-${Date.now()}-${++transactionIdCounter}`;
}

export function createValidatedTransaction(
  row: ParsedMarketRow,
  effectiveRound: number
): ValidatedTransaction {
  const { totalCost } = calculateTransactionCost(row.price, row.isLoan, row.isInjured);
  
  return {
    id: generateTransactionId(),
    original: row,
    teamId: row.matchedTeamId,
    teamName: row.fantasyTeamName,
    playerInId: row.matchedPlayerId,
    playerInName: row.playerFullName,
    playerInRole: row.role,
    playerInClub: row.serieAClub,
    playerOutId: row.matchedReleasedId,
    playerOutName: row.releasedPlayerName,
    isLoan: row.isLoan,
    isInjured: row.isInjured,
    bidPrice: row.price,
    effectiveCost: totalCost,
    timestamp: row.timestamp,
    effectiveRound,
    issues: [],
    hasBlockingErrors: false,
    isDiscarded: false,
  };
}

export function validateTransaction(
  tx: ValidatedTransaction,
  allPlayers: Player[],
  teamRosters: Map<string, Player[]>,
  otherTransactions: ValidatedTransaction[]
): ValidatedTransaction {
  const issues: ValidationIssue[] = [];

  if (!tx.teamId) {
    issues.push({
      field: 'team',
      message: `Squadra "${tx.teamName}" non trovata`,
      severity: 'error',
      code: 'TEAM_NOT_FOUND',
    });
  }

  if (!tx.playerInId) {
    issues.push({
      field: 'playerIn',
      message: `Giocatore "${tx.playerInName}" non trovato nel database`,
      severity: 'error',
      code: 'PLAYER_IN_NOT_FOUND',
    });
  }

  if (tx.playerOutName && tx.playerOutName !== '-' && !tx.playerOutId) {
    issues.push({
      field: 'playerOut',
      message: `Giocatore ceduto "${tx.playerOutName}" non trovato`,
      severity: 'error',
      code: 'PLAYER_OUT_NOT_FOUND',
    });
  }

  if (tx.teamId && tx.playerInId) {
    const roster = teamRosters.get(tx.teamId) || [];
    const alreadyOwned = roster.some(p => p.id === tx.playerInId);
    
    if (alreadyOwned) {
      issues.push({
        field: 'playerIn',
        message: `Giocatore già in rosa`,
        severity: 'error',
        code: 'PLAYER_ALREADY_OWNED',
      });
    }
  }

  if (tx.teamId && tx.playerOutId) {
    const roster = teamRosters.get(tx.teamId) || [];
    const isOnRoster = roster.some(p => p.id === tx.playerOutId);
    
    if (!isOnRoster) {
      issues.push({
        field: 'playerOut',
        message: `Giocatore ceduto non presente in rosa`,
        severity: 'error',
        code: 'PLAYER_OUT_NOT_ON_ROSTER',
      });
    }
  }

  if (tx.teamId && tx.playerInRole) {
    const rules = getLeagueRules();
    const roster = teamRosters.get(tx.teamId) || [];
    
    const maxSlots: Record<PlayerRole, number> = {
      P: rules.rosterSize.goalkeepers,
      D: rules.rosterSize.defenders,
      C: rules.rosterSize.midfielders,
      A: rules.rosterSize.forwards,
    };
    
    const currentCount = roster.filter(p => p.role === tx.playerInRole).length;
    const releasingSameRole = tx.playerOutId 
      ? roster.find(p => p.id === tx.playerOutId)?.role === tx.playerInRole
      : false;
    
    const otherTxSameTeamRole = otherTransactions.filter(
      t => !t.isDiscarded && 
           t.id !== tx.id && 
           t.teamId === tx.teamId && 
           t.playerInRole === tx.playerInRole
    ).length;
    
    const projectedCount = currentCount 
      + 1 
      - (releasingSameRole ? 1 : 0) 
      + otherTxSameTeamRole;
    
    if (projectedCount > maxSlots[tx.playerInRole]) {
      issues.push({
        field: 'playerInRole',
        message: `Slot ${tx.playerInRole} esauriti (max ${maxSlots[tx.playerInRole]})`,
        severity: 'error',
        code: 'ROLE_SLOT_OVERFLOW',
      });
    }
  }

  const duplicates = otherTransactions.filter(
    t => !t.isDiscarded &&
         t.id !== tx.id &&
         t.teamId === tx.teamId &&
         t.playerInId === tx.playerInId
  );
  
  if (duplicates.length > 0) {
    issues.push({
      field: 'playerIn',
      message: `Acquisto duplicato per lo stesso giocatore`,
      severity: 'error',
      code: 'DUPLICATE_PURCHASE',
    });
  }

  if (!tx.playerInRole) {
    issues.push({
      field: 'playerInRole',
      message: `Ruolo non specificato`,
      severity: 'warning',
      code: 'ROLE_MISSING',
    });
  }

  if (tx.bidPrice === 0 && !tx.isLoan) {
    issues.push({
      field: 'bidPrice',
      message: `Prezzo a 0 crediti`,
      severity: 'warning',
      code: 'ZERO_PRICE',
    });
  }

  const hasBlockingErrors = issues.some(i => i.severity === 'error');

  return {
    ...tx,
    issues,
    hasBlockingErrors,
  };
}

export function validateAllTransactions(
  transactions: ValidatedTransaction[],
  allPlayers: Player[],
  teamRosters: Map<string, Player[]>,
  teamCredits: Map<string, number>
): ValidationResult {
  const validated = transactions.map(tx => 
    validateTransaction(tx, allPlayers, teamRosters, transactions)
  );

  const teamSummaries: TeamCreditsSummary[] = [];
  const teamSpending = new Map<string, number>();

  for (const tx of validated) {
    if (tx.isDiscarded || !tx.teamId) continue;
    
    const current = teamSpending.get(tx.teamId) || 0;
    teamSpending.set(tx.teamId, current + tx.effectiveCost);
  }

  for (const team of teams) {
    const creditsBefore = teamCredits.get(team.id) || 60;
    const spent = teamSpending.get(team.id) || 0;
    const creditsAfter = creditsBefore - spent;
    const txCount = validated.filter(
      t => !t.isDiscarded && t.teamId === team.id
    ).length;

    if (txCount > 0 || spent > 0) {
      const hasInsufficientCredits = creditsAfter < 0;
      
      teamSummaries.push({
        teamId: team.id,
        teamName: team.name,
        creditsBefore,
        creditsAfter,
        transactionCount: txCount,
        totalSpent: spent,
        hasInsufficientCredits,
      });

      if (hasInsufficientCredits) {
        for (const tx of validated) {
          if (tx.teamId === team.id && !tx.isDiscarded) {
            tx.issues.push({
              field: 'credits',
              message: `Crediti insufficienti (${creditsBefore} disponibili, ${spent} richiesti)`,
              severity: 'error',
              code: 'INSUFFICIENT_CREDITS',
            });
            tx.hasBlockingErrors = true;
          }
        }
      }
    }
  }

  const totalErrors = validated.reduce(
    (sum, tx) => sum + tx.issues.filter(i => i.severity === 'error').length,
    0
  );
  const totalWarnings = validated.reduce(
    (sum, tx) => sum + tx.issues.filter(i => i.severity === 'warning').length,
    0
  );

  const canConfirm = validated
    .filter(tx => !tx.isDiscarded)
    .every(tx => !tx.hasBlockingErrors);

  return {
    transactions: validated,
    teamSummaries,
    totalErrors,
    totalWarnings,
    canConfirm,
  };
}

export function updateTransaction(
  transactions: ValidatedTransaction[],
  txId: string,
  updates: Partial<ValidatedTransaction>,
  allPlayers: Player[],
  teamRosters: Map<string, Player[]>,
  teamCredits: Map<string, number>
): ValidationResult {
  const updated = transactions.map(tx => {
    if (tx.id !== txId) return tx;
    
    const merged = { ...tx, ...updates };
    
    if (updates.isLoan !== undefined || updates.bidPrice !== undefined) {
      const { totalCost } = calculateTransactionCost(
        updates.bidPrice ?? tx.bidPrice,
        updates.isLoan ?? tx.isLoan,
        updates.isInjured ?? tx.isInjured
      );
      merged.effectiveCost = totalCost;
    }
    
    return merged;
  });

  return validateAllTransactions(updated, allPlayers, teamRosters, teamCredits);
}

export function discardTransaction(
  transactions: ValidatedTransaction[],
  txId: string,
  allPlayers: Player[],
  teamRosters: Map<string, Player[]>,
  teamCredits: Map<string, number>
): ValidationResult {
  return updateTransaction(
    transactions,
    txId,
    { isDiscarded: true },
    allPlayers,
    teamRosters,
    teamCredits
  );
}

export function restoreTransaction(
  transactions: ValidatedTransaction[],
  txId: string,
  allPlayers: Player[],
  teamRosters: Map<string, Player[]>,
  teamCredits: Map<string, number>
): ValidationResult {
  return updateTransaction(
    transactions,
    txId,
    { isDiscarded: false },
    allPlayers,
    teamRosters,
    teamCredits
  );
}

export function getTeamRostersFromSeed(): Map<string, Player[]> {
  const rosters = new Map<string, Player[]>();
  for (const team of teams) {
    rosters.set(team.id, team.players);
  }
  return rosters;
}

export function getTeamCreditsFromSeed(): Map<string, number> {
  const credits = new Map<string, number>();
  for (const team of teams) {
    credits.set(team.id, 60);
  }
  return credits;
}
