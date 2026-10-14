import { describe, it, expect } from 'vitest';
import { 
  fuzzyMatchPlayer, 
  extractSurnameFromPDFName,
  getFMSClubRealTeam 
} from '../fmsrevo-lineup-parser';
import { Player, PlayerRole } from '@/types';

describe('extractSurnameFromPDFName', () => {
  it('extracts surname when followed by single initial', () => {
    expect(extractSurnameFromPDFName('Frendrup M.')).toBe('Frendrup');
    expect(extractSurnameFromPDFName('Modric L.')).toBe('Modric');
  });

  it('extracts surname when followed by multiple initials', () => {
    expect(extractSurnameFromPDFName('Frendrup M. W.')).toBe('Frendrup');
    expect(extractSurnameFromPDFName('Martinez L. J.')).toBe('Martinez');
    expect(extractSurnameFromPDFName('Ederson J. D. S.')).toBe('Ederson');
  });

  it('handles surnames without initials', () => {
    expect(extractSurnameFromPDFName('Pessina')).toBe('Pessina');
    expect(extractSurnameFromPDFName('Skorupski')).toBe('Skorupski');
  });

  it('handles multi-word surnames', () => {
    expect(extractSurnameFromPDFName('De Ketelaere C.')).toBe('De Ketelaere');
    expect(extractSurnameFromPDFName('Di Lorenzo G.')).toBe('Di Lorenzo');
  });

  it('handles initials without dots', () => {
    expect(extractSurnameFromPDFName('Frendrup M W')).toBe('Frendrup');
  });
});

describe('getFMSClubRealTeam', () => {
  it('maps common FMS club codes to real team names', () => {
    expect(getFMSClubRealTeam('BOL')).toBe('Bologna');
    expect(getFMSClubRealTeam('INT')).toBe('Inter');
    expect(getFMSClubRealTeam('MIL')).toBe('Milan');
    expect(getFMSClubRealTeam('ATA')).toBe('Atalanta');
    expect(getFMSClubRealTeam('GEN')).toBe('Genoa');
    expect(getFMSClubRealTeam('NAP')).toBe('Napoli');
    expect(getFMSClubRealTeam('CAG')).toBe('Cagliari');
    expect(getFMSClubRealTeam('LAZ')).toBe('Lazio');
    expect(getFMSClubRealTeam('SAS')).toBe('Sassuolo');
    expect(getFMSClubRealTeam('MON')).toBe('Monza');
    expect(getFMSClubRealTeam('JUV')).toBe('Juventus');
  });

  it('handles lowercase codes', () => {
    expect(getFMSClubRealTeam('bol')).toBe('Bologna');
    expect(getFMSClubRealTeam('int')).toBe('Inter');
  });

  it('returns null for unknown codes', () => {
    expect(getFMSClubRealTeam('XXX')).toBeNull();
    expect(getFMSClubRealTeam('')).toBeNull();
  });
});

describe('fuzzyMatchPlayer with Parisso San Gennaro lineup', () => {
  const mockPlayers: Player[] = [
    { id: 'pessina', name: 'Pessina', role: 'P', teamId: 'parisso', realTeam: 'Bologna' },
    { id: 'akanji', name: 'Akanji', role: 'D', teamId: 'parisso', realTeam: 'Inter' },
    { id: 'obert', name: 'Obert', role: 'D', teamId: 'parisso', realTeam: 'Cagliari' },
    { id: 'rrahmani', name: 'Rrahmani', role: 'D', teamId: 'parisso', realTeam: 'Napoli' },
    { id: 'scalvini', name: 'Scalvini', role: 'D', teamId: 'parisso', realTeam: 'Atalanta' },
    { id: 'ferguson', name: 'Ferguson', role: 'C', teamId: 'parisso', realTeam: 'Bologna' },
    { id: 'frendrup', name: 'Frendrup', role: 'C', teamId: 'parisso', realTeam: 'Genoa' },
    { id: 'modric', name: 'Modric', role: 'C', teamId: 'parisso', realTeam: 'Milan' },
    { id: 'taylor', name: 'Taylor', role: 'C', teamId: 'parisso', realTeam: 'Lazio' },
    { id: 'martinez-l', name: 'Lautaro Martinez', role: 'A', teamId: 'parisso', realTeam: 'Inter' },
    { id: 'ramos', name: 'Ramos', role: 'A', teamId: 'parisso', realTeam: 'Milan' },
    { id: 'skorupski', name: 'Skorupski', role: 'P', teamId: 'parisso', realTeam: 'Bologna' },
    { id: 'muric', name: 'Muric', role: 'P', teamId: 'parisso', realTeam: 'Sassuolo' },
    { id: 'deketelaere', name: 'De Ketelaere', role: 'A', teamId: 'parisso', realTeam: 'Atalanta' },
    { id: 'giovane', name: 'Giovane', role: 'A', teamId: 'parisso', realTeam: 'Napoli' },
    { id: 'dovbyk', name: 'Dovbyk', role: 'A', teamId: 'parisso', realTeam: 'Bologna' },
    { id: 'cutrone', name: 'Cutrone', role: 'A', teamId: 'parisso', realTeam: 'Monza' },
    { id: 'elmas', name: 'Elmas', role: 'C', teamId: 'parisso', realTeam: 'Atalanta' },
    { id: 'pasalic', name: 'Pasalic', role: 'C', teamId: 'parisso', realTeam: 'Atalanta' },
    { id: 'ellertsson', name: 'Ellertsson', role: 'C', teamId: 'parisso', realTeam: 'Genoa' },
    { id: 'zappacosta', name: 'Zappacosta', role: 'D', teamId: 'parisso', realTeam: 'Atalanta' },
    { id: 'cambiaso', name: 'Cambiaso', role: 'D', teamId: 'parisso', realTeam: 'Juventus' },
    { id: 'ederson', name: 'Ederson', role: 'C', teamId: 'parisso', realTeam: 'Atalanta' },
  ];

  describe('starters (11 players)', () => {
    const starterTestCases: Array<{
      pdfName: string;
      role: PlayerRole;
      club: string;
      expectedId: string;
    }> = [
      { pdfName: 'Pessina M.', role: 'P', club: 'BOL', expectedId: 'pessina' },
      { pdfName: 'Akanji M. O.', role: 'D', club: 'INT', expectedId: 'akanji' },
      { pdfName: 'Obert A.', role: 'D', club: 'CAG', expectedId: 'obert' },
      { pdfName: 'Rrahmani A.', role: 'D', club: 'NAP', expectedId: 'rrahmani' },
      { pdfName: 'Scalvini G.', role: 'D', club: 'ATA', expectedId: 'scalvini' },
      { pdfName: 'Ferguson L.', role: 'C', club: 'BOL', expectedId: 'ferguson' },
      { pdfName: 'Frendrup M. W.', role: 'C', club: 'GEN', expectedId: 'frendrup' },
      { pdfName: 'Modric L.', role: 'C', club: 'MIL', expectedId: 'modric' },
      { pdfName: 'Taylor K. I.', role: 'C', club: 'LAZ', expectedId: 'taylor' },
      { pdfName: 'Martinez L. J.', role: 'A', club: 'INT', expectedId: 'martinez-l' },
      { pdfName: 'Ramos G. M.', role: 'A', club: 'MIL', expectedId: 'ramos' },
    ];

    starterTestCases.forEach(({ pdfName, role, club, expectedId }) => {
      it(`matches "${pdfName}" (${role}, ${club}) to ${expectedId}`, () => {
        const result = fuzzyMatchPlayer(pdfName, mockPlayers, role, club);
        expect(result.playerId).toBe(expectedId);
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });
  });

  describe('bench (12 players)', () => {
    const benchTestCases: Array<{
      pdfName: string;
      role: PlayerRole;
      club: string;
      expectedId: string;
    }> = [
      { pdfName: 'Skorupski L.', role: 'P', club: 'BOL', expectedId: 'skorupski' },
      { pdfName: 'Muric A. A.', role: 'P', club: 'SAS', expectedId: 'muric' },
      { pdfName: 'De Ketelaere C.', role: 'A', club: 'ATA', expectedId: 'deketelaere' },
      { pdfName: 'Giovane S. D. N.', role: 'A', club: 'NAP', expectedId: 'giovane' },
      { pdfName: 'Dovbyk A.', role: 'A', club: 'BOL', expectedId: 'dovbyk' },
      { pdfName: 'Cutrone P.', role: 'A', club: 'MON', expectedId: 'cutrone' },
      { pdfName: 'Elmas E.', role: 'C', club: 'ATA', expectedId: 'elmas' },
      { pdfName: 'Pasalic M.', role: 'C', club: 'ATA', expectedId: 'pasalic' },
      { pdfName: 'Ellertsson M. E.', role: 'C', club: 'GEN', expectedId: 'ellertsson' },
      { pdfName: 'Zappacosta D.', role: 'D', club: 'ATA', expectedId: 'zappacosta' },
      { pdfName: 'Cambiaso A.', role: 'D', club: 'JUV', expectedId: 'cambiaso' },
      { pdfName: 'Ederson J. D. S.', role: 'C', club: 'ATA', expectedId: 'ederson' },
    ];

    benchTestCases.forEach(({ pdfName, role, club, expectedId }) => {
      it(`matches "${pdfName}" (${role}, ${club}) to ${expectedId}`, () => {
        const result = fuzzyMatchPlayer(pdfName, mockPlayers, role, club);
        expect(result.playerId).toBe(expectedId);
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });
  });

  describe('disambiguation scenarios', () => {
    it('disambiguates by role when surname matches multiple players', () => {
      const playersWithSameSurname: Player[] = [
        { id: 'martinez-a', name: 'A Martinez', role: 'A', teamId: 't1', realTeam: 'Inter' },
        { id: 'martinez-d', name: 'D Martinez', role: 'D', teamId: 't1', realTeam: 'Inter' },
      ];
      
      const result = fuzzyMatchPlayer('Martinez L. J.', playersWithSameSurname, 'A', 'INT');
      expect(result.playerId).toBe('martinez-a');
    });

    it('disambiguates by club when role matches multiple players', () => {
      const playersWithSameRoleAndSurname: Player[] = [
        { id: 'smith-ata', name: 'Smith', role: 'C', teamId: 't1', realTeam: 'Atalanta' },
        { id: 'smith-int', name: 'Smith', role: 'C', teamId: 't1', realTeam: 'Inter' },
      ];
      
      const resultAta = fuzzyMatchPlayer('Smith J.', playersWithSameRoleAndSurname, 'C', 'ATA');
      expect(resultAta.playerId).toBe('smith-ata');
      
      const resultInt = fuzzyMatchPlayer('Smith J.', playersWithSameRoleAndSurname, 'C', 'INT');
      expect(resultInt.playerId).toBe('smith-int');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty input', () => {
      const result = fuzzyMatchPlayer('', mockPlayers, 'C', 'ATA');
      expect(result.playerId).toBeNull();
    });

    it('returns null for dash input', () => {
      const result = fuzzyMatchPlayer('-', mockPlayers, 'C', 'ATA');
      expect(result.playerId).toBeNull();
    });

    it('handles player not in database', () => {
      const result = fuzzyMatchPlayer('Nonexistent Player', mockPlayers, 'C', 'ATA');
      expect(result.playerId).toBeNull();
    });

    it('matches accented names', () => {
      const playersWithAccents: Player[] = [
        { id: 'müller', name: 'Müller', role: 'A', teamId: 't1', realTeam: 'Bayern' },
      ];
      
      const result = fuzzyMatchPlayer('Muller T.', playersWithAccents, 'A', null);
      expect(result.playerId).toBe('müller');
    });
  });
});
