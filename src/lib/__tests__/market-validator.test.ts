import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateTransaction,
  validateAllTransactions,
  createValidatedTransaction,
  discardTransaction,
  restoreTransaction,
  updateTransaction,
  ValidatedTransaction,
  getTeamRostersFromSeed,
  getTeamCreditsFromSeed,
} from '../market-validator';
import { ParsedMarketRow } from '../market-email-parser';
import { Player } from '@/types';
import { getAllPlayers } from '@/data/teams';

function createMockRow(overrides: Partial<ParsedMarketRow> = {}): ParsedMarketRow {
  return {
    rawLine: 'test line',
    lineNumber: 1,
    playerFullName: 'Test Player',
    role: 'A',
    serieAClub: 'MIL',
    fantasyTeamName: 'Yellow Mustard',
    releasedPlayerName: '-',
    isInjured: false,
    isLoan: false,
    price: 5,
    timestamp: '2026-03-26 18:00:00',
    matchedPlayerId: 'new-player-1',
    matchedPlayerConfidence: 0.95,
    matchedReleasedId: null,
    matchedReleasedConfidence: 1,
    matchedTeamId: 'ym',
    matchedTeamConfidence: 1,
    errors: [],
    warnings: [],
    ...overrides,
  };
}

describe('Market Validator', () => {
  let allPlayers: Player[];
  let teamRosters: Map<string, Player[]>;
  let teamCredits: Map<string, number>;

  beforeEach(() => {
    allPlayers = [
      ...getAllPlayers(),
      { id: 'new-player-1', name: 'New Player 1', role: 'A', teamId: '' },
      { id: 'new-player-2', name: 'New Player 2', role: 'C', teamId: '' },
      { id: 'new-player-3', name: 'New Player 3', role: 'D', teamId: '' },
    ];
    
    teamRosters = getTeamRostersFromSeed();
    teamCredits = getTeamCreditsFromSeed();
  });

  describe('createValidatedTransaction', () => {
    it('creates a transaction from a parsed row', () => {
      const row = createMockRow();
      const tx = createValidatedTransaction(row, 2);
      
      expect(tx.teamId).toBe('ym');
      expect(tx.playerInId).toBe('new-player-1');
      expect(tx.bidPrice).toBe(5);
      expect(tx.effectiveRound).toBe(2);
      expect(tx.isDiscarded).toBe(false);
    });

    it('calculates loan cost correctly', () => {
      const row = createMockRow({ isLoan: true, price: 5 });
      const tx = createValidatedTransaction(row, 2);
      
      expect(tx.effectiveCost).toBe(10);
    });

    it('uses bid price for non-loan transactions', () => {
      const row = createMockRow({ isLoan: false, price: 7 });
      const tx = createValidatedTransaction(row, 2);
      
      expect(tx.effectiveCost).toBe(7);
    });
  });

  describe('validateTransaction', () => {
    it('returns error when team not found', () => {
      const row = createMockRow({ matchedTeamId: null });
      const tx = createValidatedTransaction(row, 2);
      
      const validated = validateTransaction(tx, allPlayers, teamRosters, []);
      
      expect(validated.hasBlockingErrors).toBe(true);
      expect(validated.issues.some(i => i.code === 'TEAM_NOT_FOUND')).toBe(true);
    });

    it('returns error when player in not found', () => {
      const row = createMockRow({ matchedPlayerId: null });
      const tx = createValidatedTransaction(row, 2);
      
      const validated = validateTransaction(tx, allPlayers, teamRosters, []);
      
      expect(validated.hasBlockingErrors).toBe(true);
      expect(validated.issues.some(i => i.code === 'PLAYER_IN_NOT_FOUND')).toBe(true);
    });

    it('returns error when released player not found', () => {
      const row = createMockRow({ 
        releasedPlayerName: 'Unknown Player',
        matchedReleasedId: null,
      });
      const tx = createValidatedTransaction(row, 2);
      
      const validated = validateTransaction(tx, allPlayers, teamRosters, []);
      
      expect(validated.hasBlockingErrors).toBe(true);
      expect(validated.issues.some(i => i.code === 'PLAYER_OUT_NOT_FOUND')).toBe(true);
    });

    it('returns error when player already owned', () => {
      const existingPlayer = teamRosters.get('ym')![0];
      const row = createMockRow({ 
        matchedPlayerId: existingPlayer.id,
      });
      const tx = createValidatedTransaction(row, 2);
      
      const validated = validateTransaction(tx, allPlayers, teamRosters, []);
      
      expect(validated.hasBlockingErrors).toBe(true);
      expect(validated.issues.some(i => i.code === 'PLAYER_ALREADY_OWNED')).toBe(true);
    });

    it('returns error when released player not on roster', () => {
      const otherTeamPlayer = teamRosters.get('ap')![0];
      const row = createMockRow({ 
        releasedPlayerName: 'Some Player',
        matchedReleasedId: otherTeamPlayer.id,
      });
      const tx = createValidatedTransaction(row, 2);
      
      const validated = validateTransaction(tx, allPlayers, teamRosters, []);
      
      expect(validated.hasBlockingErrors).toBe(true);
      expect(validated.issues.some(i => i.code === 'PLAYER_OUT_NOT_ON_ROSTER')).toBe(true);
    });

    it('returns error for duplicate purchases', () => {
      const row = createMockRow();
      const tx1 = createValidatedTransaction(row, 2);
      const tx2 = createValidatedTransaction(row, 2);
      
      const validated = validateTransaction(tx2, allPlayers, teamRosters, [tx1]);
      
      expect(validated.hasBlockingErrors).toBe(true);
      expect(validated.issues.some(i => i.code === 'DUPLICATE_PURCHASE')).toBe(true);
    });

    it('returns warning for zero price', () => {
      const row = createMockRow({ price: 0, isLoan: false });
      const tx = createValidatedTransaction(row, 2);
      
      const validated = validateTransaction(tx, allPlayers, teamRosters, []);
      
      expect(validated.issues.some(i => 
        i.code === 'ZERO_PRICE' && i.severity === 'warning'
      )).toBe(true);
    });

    it('returns warning for missing role', () => {
      const row = createMockRow({ role: null });
      const tx = createValidatedTransaction(row, 2);
      
      const validated = validateTransaction(tx, allPlayers, teamRosters, []);
      
      expect(validated.issues.some(i => 
        i.code === 'ROLE_MISSING' && i.severity === 'warning'
      )).toBe(true);
    });

    it('passes validation for valid transaction', () => {
      const ymRoster = teamRosters.get('ym')!;
      const ymAttacker = ymRoster.find(p => p.role === 'A')!;
      
      const row = createMockRow({
        matchedPlayerId: 'new-player-1',
        matchedTeamId: 'ym',
        matchedReleasedId: ymAttacker.id,
        releasedPlayerName: ymAttacker.name,
        role: 'A',
      });
      const tx = createValidatedTransaction(row, 2);
      
      const validated = validateTransaction(tx, allPlayers, teamRosters, []);
      
      const errors = validated.issues.filter(i => i.severity === 'error');
      expect(errors).toHaveLength(0);
      expect(validated.hasBlockingErrors).toBe(false);
    });
  });

  describe('validateAllTransactions', () => {
    it('calculates team summaries correctly', () => {
      const row1 = createMockRow({ price: 10 });
      const row2 = createMockRow({ 
        price: 15,
        matchedPlayerId: 'new-player-2',
      });
      
      const tx1 = createValidatedTransaction(row1, 2);
      const tx2 = createValidatedTransaction(row2, 2);
      
      const result = validateAllTransactions(
        [tx1, tx2],
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      const ymSummary = result.teamSummaries.find(s => s.teamId === 'ym');
      expect(ymSummary).toBeDefined();
      expect(ymSummary!.creditsBefore).toBe(60);
      expect(ymSummary!.totalSpent).toBe(25);
      expect(ymSummary!.creditsAfter).toBe(35);
      expect(ymSummary!.transactionCount).toBe(2);
    });

    it('detects insufficient credits', () => {
      const row = createMockRow({ price: 100 });
      const tx = createValidatedTransaction(row, 2);
      
      const result = validateAllTransactions(
        [tx],
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      expect(result.canConfirm).toBe(false);
      expect(result.teamSummaries[0].hasInsufficientCredits).toBe(true);
      expect(result.transactions[0].issues.some(
        i => i.code === 'INSUFFICIENT_CREDITS'
      )).toBe(true);
    });

    it('allows confirmation when all valid', () => {
      const ymRoster = teamRosters.get('ym')!;
      const ymAttacker = ymRoster.find(p => p.role === 'A')!;
      
      const row = createMockRow({ 
        price: 5,
        matchedPlayerId: 'new-player-1',
        matchedTeamId: 'ym',
        matchedReleasedId: ymAttacker.id,
        releasedPlayerName: ymAttacker.name,
        role: 'A',
      });
      const tx = createValidatedTransaction(row, 2);
      
      const result = validateAllTransactions(
        [tx],
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      expect(result.totalErrors).toBe(0);
      expect(result.canConfirm).toBe(true);
    });

    it('counts errors and warnings', () => {
      const validRow = createMockRow({ price: 5 });
      const invalidRow = createMockRow({ 
        matchedTeamId: null,
        price: 0,
      });
      
      const tx1 = createValidatedTransaction(validRow, 2);
      const tx2 = createValidatedTransaction(invalidRow, 2);
      
      const result = validateAllTransactions(
        [tx1, tx2],
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      expect(result.totalErrors).toBeGreaterThan(0);
      expect(result.canConfirm).toBe(false);
    });

    it('excludes discarded transactions from summaries', () => {
      const row = createMockRow({ price: 50 });
      const tx = createValidatedTransaction(row, 2);
      tx.isDiscarded = true;
      
      const result = validateAllTransactions(
        [tx],
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      const ymSummary = result.teamSummaries.find(s => s.teamId === 'ym');
      expect(ymSummary).toBeUndefined();
    });
  });

  describe('discardTransaction', () => {
    it('marks transaction as discarded', () => {
      const row = createMockRow();
      const tx = createValidatedTransaction(row, 2);
      
      const result = discardTransaction(
        [tx],
        tx.id,
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      expect(result.transactions[0].isDiscarded).toBe(true);
    });

    it('recalculates credits without discarded transactions', () => {
      const row1 = createMockRow({ price: 30 });
      const row2 = createMockRow({ 
        price: 40,
        matchedPlayerId: 'new-player-2',
      });
      
      const tx1 = createValidatedTransaction(row1, 2);
      const tx2 = createValidatedTransaction(row2, 2);
      
      const beforeDiscard = validateAllTransactions(
        [tx1, tx2],
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      expect(beforeDiscard.teamSummaries[0].hasInsufficientCredits).toBe(true);
      
      const afterDiscard = discardTransaction(
        beforeDiscard.transactions,
        tx2.id,
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      const ymSummary = afterDiscard.teamSummaries.find(s => s.teamId === 'ym');
      expect(ymSummary!.hasInsufficientCredits).toBe(false);
      expect(ymSummary!.totalSpent).toBe(30);
    });
  });

  describe('restoreTransaction', () => {
    it('restores a discarded transaction', () => {
      const row = createMockRow();
      const tx = createValidatedTransaction(row, 2);
      tx.isDiscarded = true;
      
      const result = restoreTransaction(
        [tx],
        tx.id,
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      expect(result.transactions[0].isDiscarded).toBe(false);
    });
  });

  describe('updateTransaction', () => {
    it('updates transaction fields', () => {
      const row = createMockRow({ price: 5 });
      const tx = createValidatedTransaction(row, 2);
      
      const result = updateTransaction(
        [tx],
        tx.id,
        { bidPrice: 10 },
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      expect(result.transactions[0].bidPrice).toBe(10);
      expect(result.transactions[0].effectiveCost).toBe(10);
    });

    it('recalculates loan cost when isLoan changes', () => {
      const row = createMockRow({ price: 5, isLoan: false });
      const tx = createValidatedTransaction(row, 2);
      
      const result = updateTransaction(
        [tx],
        tx.id,
        { isLoan: true },
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      expect(result.transactions[0].effectiveCost).toBe(10);
    });

    it('revalidates after update', () => {
      const row = createMockRow({ matchedTeamId: null });
      const tx = createValidatedTransaction(row, 2);
      
      const result = updateTransaction(
        [tx],
        tx.id,
        { teamId: 'ym' },
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      expect(result.transactions[0].issues.some(
        i => i.code === 'TEAM_NOT_FOUND'
      )).toBe(false);
    });
  });

  describe('Role slot overflow', () => {
    it('detects when adding too many players of same role', () => {
      const ymRoster = teamRosters.get('ym')!;
      const attackers = ymRoster.filter(p => p.role === 'A');
      
      const row1 = createMockRow({ role: 'A', matchedPlayerId: 'new-attacker-1' });
      const row2 = createMockRow({ role: 'A', matchedPlayerId: 'new-attacker-2' });
      const row3 = createMockRow({ role: 'A', matchedPlayerId: 'new-attacker-3' });
      
      allPlayers.push(
        { id: 'new-attacker-1', name: 'New Attacker 1', role: 'A', teamId: '' },
        { id: 'new-attacker-2', name: 'New Attacker 2', role: 'A', teamId: '' },
        { id: 'new-attacker-3', name: 'New Attacker 3', role: 'A', teamId: '' },
      );
      
      const tx1 = createValidatedTransaction(row1, 2);
      const tx2 = createValidatedTransaction(row2, 2);
      const tx3 = createValidatedTransaction(row3, 2);
      
      const result = validateAllTransactions(
        [tx1, tx2, tx3],
        allPlayers,
        teamRosters,
        teamCredits
      );
      
      const overflowErrors = result.transactions.filter(
        tx => tx.issues.some(i => i.code === 'ROLE_SLOT_OVERFLOW')
      );
      
      expect(overflowErrors.length).toBeGreaterThan(0);
    });
  });
});
