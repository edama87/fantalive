import { describe, it, expect } from 'vitest';
import {
  parseMarketEmail,
  fuzzyMatchPlayer,
  fuzzyMatchTeam,
  validateParsedRows,
  ParsedMarketRow,
} from '../market-email-parser';
import { Player } from '@/types';

const mockPlayers: Player[] = [
  { id: 'ym-gimenez', name: 'Gimenez', role: 'A', teamId: 'ym' },
  { id: 'ym-cheddira', name: 'Cheddira', role: 'A', teamId: 'ym' },
  { id: 'rp-vaz', name: 'Vaz', role: 'A', teamId: 'rp' },
  { id: 'rp-dominguez', name: 'Dominguez', role: 'C', teamId: 'rp' },
  { id: 'ap-mctominay', name: 'McTominay', role: 'C', teamId: 'ap' },
  { id: 'ap-dimarco', name: 'Dimarco', role: 'D', teamId: 'ap' },
  { id: 'le-kean', name: 'Kean', role: 'A', teamId: 'le' },
  { id: 'dc-dybala', name: 'Dybala', role: 'A', teamId: 'dc' },
];

describe('Market Email Parser', () => {
  const sampleEmail = `
CHIAMATE AGGIUDICATE ALL'APERTURA DELLE BUSTE:
=========================================================================
Giocatore			FantaSquadra	Taglio	Inf	Pre	$	Data
GIMENEZ Santiago Tomas	A	MIL	Yellow Mustard	Cheddira W.	no	no	2	2026-03-26 18:45:01
VAZ Robinio	A	ROM	Real Pedrotte	Dominguez B.	no	no	1	2026-03-26 16:32:00
=========================================================================
`;

  describe('parseMarketEmail', () => {
    it('parses the sample email correctly', () => {
      const result = parseMarketEmail(sampleEmail, mockPlayers);
      
      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(2);
      expect(result.rows.length).toBe(2);
    });

    it('extracts player names correctly', () => {
      const result = parseMarketEmail(sampleEmail, mockPlayers);
      
      expect(result.rows[0].playerFullName).toBe('GIMENEZ Santiago Tomas');
      expect(result.rows[1].playerFullName).toBe('VAZ Robinio');
    });

    it('extracts roles correctly', () => {
      const result = parseMarketEmail(sampleEmail, mockPlayers);
      
      expect(result.rows[0].role).toBe('A');
      expect(result.rows[1].role).toBe('A');
    });

    it('extracts Serie A club codes', () => {
      const result = parseMarketEmail(sampleEmail, mockPlayers);
      
      expect(result.rows[0].serieAClub).toBe('MIL');
      expect(result.rows[1].serieAClub).toBe('ROM');
    });

    it('extracts fantasy team names', () => {
      const result = parseMarketEmail(sampleEmail, mockPlayers);
      
      expect(result.rows[0].fantasyTeamName).toBe('Yellow Mustard');
      expect(result.rows[1].fantasyTeamName).toBe('Real Pedrotte');
    });

    it('extracts released player names', () => {
      const result = parseMarketEmail(sampleEmail, mockPlayers);
      
      expect(result.rows[0].releasedPlayerName).toBe('Cheddira W.');
      expect(result.rows[1].releasedPlayerName).toBe('Dominguez B.');
    });

    it('parses Inf and Pre flags', () => {
      const result = parseMarketEmail(sampleEmail, mockPlayers);
      
      expect(result.rows[0].isInjured).toBe(false);
      expect(result.rows[0].isLoan).toBe(false);
    });

    it('parses prices correctly', () => {
      const result = parseMarketEmail(sampleEmail, mockPlayers);
      
      expect(result.rows[0].price).toBe(2);
      expect(result.rows[1].price).toBe(1);
    });

    it('extracts timestamps', () => {
      const result = parseMarketEmail(sampleEmail, mockPlayers);
      
      expect(result.rows[0].timestamp).toBe('2026-03-26 18:45:01');
      expect(result.rows[1].timestamp).toBe('2026-03-26 16:32:00');
    });

    it('handles email with yes flags', () => {
      const emailWithFlags = `
=========================================================================
ROSSI Mario	D	JUV	Amatori ProSecco	Bianchi G.	yes	yes	5	2026-03-26 12:00:00
=========================================================================
`;
      const result = parseMarketEmail(emailWithFlags, mockPlayers);
      
      expect(result.rows[0].isInjured).toBe(true);
      expect(result.rows[0].isLoan).toBe(true);
    });

    it('handles missing delimiter gracefully', () => {
      const badEmail = `Some random text without delimiters`;
      const result = parseMarketEmail(badEmail, mockPlayers);
      
      expect(result.success).toBe(false);
      expect(result.parseErrors.length).toBeGreaterThan(0);
    });

    it('skips header row', () => {
      const result = parseMarketEmail(sampleEmail, mockPlayers);
      
      const headerRow = result.rows.find(r => 
        r.playerFullName.toLowerCase().includes('giocatore')
      );
      expect(headerRow).toBeUndefined();
    });
  });

  describe('fuzzyMatchPlayer', () => {
    it('matches exact names', () => {
      const result = fuzzyMatchPlayer('Gimenez', mockPlayers);
      expect(result.player?.id).toBe('ym-gimenez');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('matches uppercase surnames', () => {
      const result = fuzzyMatchPlayer('GIMENEZ Santiago Tomas', mockPlayers);
      expect(result.player?.id).toBe('ym-gimenez');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('matches short format names', () => {
      const result = fuzzyMatchPlayer('Cheddira W.', mockPlayers, true);
      expect(result.player?.id).toBe('ym-cheddira');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('returns null for empty string', () => {
      const result = fuzzyMatchPlayer('', mockPlayers);
      expect(result.player).toBeNull();
      expect(result.confidence).toBe(1);
    });

    it('returns null for dash', () => {
      const result = fuzzyMatchPlayer('-', mockPlayers);
      expect(result.player).toBeNull();
      expect(result.confidence).toBe(1);
    });

    it('handles accent normalization', () => {
      const playersWithAccents: Player[] = [
        { id: 'test-perez', name: 'Pérez', role: 'C', teamId: 'test' },
      ];
      const result = fuzzyMatchPlayer('Perez', playersWithAccents);
      expect(result.player?.id).toBe('test-perez');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('fuzzyMatchTeam', () => {
    it('matches exact team names', () => {
      const result = fuzzyMatchTeam('Yellow Mustard');
      expect(result.teamId).toBe('ym');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('matches partial team names', () => {
      const result = fuzzyMatchTeam('Amatori ProSecco');
      expect(result.teamId).toBe('ap');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('matches Real Pedrotte', () => {
      const result = fuzzyMatchTeam('Real Pedrotte');
      expect(result.teamId).toBe('rp');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('returns null for empty string', () => {
      const result = fuzzyMatchTeam('');
      expect(result.teamId).toBeNull();
    });
  });

  describe('validateParsedRows', () => {
    it('validates rows with all matches above threshold', () => {
      const rows: ParsedMarketRow[] = [{
        rawLine: 'test',
        lineNumber: 1,
        playerFullName: 'Gimenez',
        role: 'A',
        serieAClub: 'MIL',
        fantasyTeamName: 'Yellow Mustard',
        releasedPlayerName: 'Cheddira W.',
        isInjured: false,
        isLoan: false,
        price: 2,
        timestamp: '2026-03-26 18:45:01',
        matchedPlayerId: 'ym-gimenez',
        matchedPlayerConfidence: 0.9,
        matchedReleasedId: 'ym-cheddira',
        matchedReleasedConfidence: 0.8,
        matchedTeamId: 'ym',
        matchedTeamConfidence: 1.0,
        errors: [],
        warnings: [],
      }];

      const { valid, invalid } = validateParsedRows(rows);
      
      expect(valid.length).toBe(1);
      expect(invalid.length).toBe(0);
      expect(valid[0].teamId).toBe('ym');
      expect(valid[0].playerInId).toBe('ym-gimenez');
      expect(valid[0].playerOutId).toBe('ym-cheddira');
    });

    it('rejects rows with low player confidence', () => {
      const rows: ParsedMarketRow[] = [{
        rawLine: 'test',
        lineNumber: 1,
        playerFullName: 'Unknown Player',
        role: 'A',
        serieAClub: 'MIL',
        fantasyTeamName: 'Yellow Mustard',
        releasedPlayerName: '-',
        isInjured: false,
        isLoan: false,
        price: 2,
        timestamp: '',
        matchedPlayerId: 'ym-gimenez',
        matchedPlayerConfidence: 0.3,
        matchedReleasedId: null,
        matchedReleasedConfidence: 1,
        matchedTeamId: 'ym',
        matchedTeamConfidence: 1.0,
        errors: [],
        warnings: [],
      }];

      const { valid, invalid } = validateParsedRows(rows);
      
      expect(valid.length).toBe(0);
      expect(invalid.length).toBe(1);
    });

    it('rejects rows with errors', () => {
      const rows: ParsedMarketRow[] = [{
        rawLine: 'test',
        lineNumber: 1,
        playerFullName: 'Test',
        role: 'A',
        serieAClub: 'MIL',
        fantasyTeamName: 'Yellow Mustard',
        releasedPlayerName: '-',
        isInjured: false,
        isLoan: false,
        price: 0,
        timestamp: '',
        matchedPlayerId: 'ym-gimenez',
        matchedPlayerConfidence: 0.9,
        matchedReleasedId: null,
        matchedReleasedConfidence: 1,
        matchedTeamId: 'ym',
        matchedTeamConfidence: 1.0,
        errors: ['Some error'],
        warnings: [],
      }];

      const { valid, invalid } = validateParsedRows(rows);
      
      expect(valid.length).toBe(0);
      expect(invalid.length).toBe(1);
    });

    it('handles rows without released player', () => {
      const rows: ParsedMarketRow[] = [{
        rawLine: 'test',
        lineNumber: 1,
        playerFullName: 'Gimenez',
        role: 'A',
        serieAClub: 'MIL',
        fantasyTeamName: 'Yellow Mustard',
        releasedPlayerName: '-',
        isInjured: false,
        isLoan: false,
        price: 2,
        timestamp: '',
        matchedPlayerId: 'ym-gimenez',
        matchedPlayerConfidence: 0.9,
        matchedReleasedId: null,
        matchedReleasedConfidence: 1,
        matchedTeamId: 'ym',
        matchedTeamConfidence: 1.0,
        errors: [],
        warnings: [],
      }];

      const { valid, invalid } = validateParsedRows(rows);
      
      expect(valid.length).toBe(1);
      expect(valid[0].playerOutId).toBeNull();
    });
  });

  describe('Integration: Full email parsing', () => {
    it('parses and validates the complete sample email', () => {
      const result = parseMarketEmail(sampleEmail, mockPlayers);
      
      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(2);

      expect(result.rows[0].matchedTeamId).toBe('ym');
      expect(result.rows[1].matchedTeamId).toBe('rp');
    });

    it('handles multi-line email with various formats', () => {
      const complexEmail = `
Buongiorno,
ecco i risultati del mercato settimanale.

CHIAMATE AGGIUDICATE ALL'APERTURA DELLE BUSTE:
=========================================================================
Giocatore			FantaSquadra	Taglio	Inf	Pre	$	Data
GIMENEZ Santiago Tomas	A	MIL	Yellow Mustard	Cheddira W.	no	no	2	2026-03-26 18:45:01
MCTOMINAY Scott	C	NAP	Amatori ProSecco	-	no	no	15	2026-03-26 17:00:00
DYBALA Paulo	A	ROM	Dinamo Cecchignola 1927	Kean M.	yes	no	8	2026-03-26 16:00:00
=========================================================================

Cordiali saluti,
FMS Revo
`;
      const result = parseMarketEmail(complexEmail, mockPlayers);
      
      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(3);
      
      const mcTominayRow = result.rows.find(r => 
        r.playerFullName.includes('MCTOMINAY')
      );
      expect(mcTominayRow).toBeDefined();
      expect(mcTominayRow?.releasedPlayerName).toBe('-');
      expect(mcTominayRow?.price).toBe(15);
      
      const dybalaRow = result.rows.find(r => 
        r.playerFullName.includes('DYBALA')
      );
      expect(dybalaRow).toBeDefined();
      expect(dybalaRow?.isInjured).toBe(true);
    });
  });
});

describe('League Rules', () => {
  it('should be tested separately in league-rules.test.ts', () => {
    expect(true).toBe(true);
  });
});
