import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { 
  isPDFContent, 
  parseFMSRevoPDF,
  PDFParseResult,
} from '../fmsrevo-pdf-parser';

const FIXTURES_DIR = join(__dirname, 'fixtures');

const FANTASY_TEAMS = [
  { id: 'le', name: 'Little Eagles' },
  { id: 'st', name: 'Salen Team' },
  { id: 'dc', name: 'Dinamo Cecchignola 1927' },
  { id: 'ap', name: 'Amatori ProSecco' },
  { id: 'am', name: 'Atletico Magari' },
  { id: 'ym', name: 'Yellow Mustard' },
  { id: 'rp', name: 'Real Pedrotte' },
  { id: 'sf', name: 'Sfortonia' },
  { id: 'fc', name: 'Football And City' },
  { id: 'psg', name: 'Parisso San Gennaro' },
];

describe('FMS Revo PDF Parser', () => {
  describe('isPDFContent', () => {
    it('detects PDF from magic bytes', () => {
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]);
      expect(isPDFContent(pdfHeader)).toBe(true);
    });

    it('detects PDF from string prefix', () => {
      expect(isPDFContent('%PDF-1.4')).toBe(true);
      expect(isPDFContent('  %PDF-1.7')).toBe(true);
    });

    it('rejects non-PDF content', () => {
      expect(isPDFContent('<html>')).toBe(false);
      expect(isPDFContent(new Uint8Array([0x3C, 0x68, 0x74, 0x6D, 0x6C]))).toBe(false);
    });

    it('handles empty input', () => {
      expect(isPDFContent(new Uint8Array([]))).toBe(false);
      expect(isPDFContent('')).toBe(false);
    });
  });

  describe('parseFMSRevoPDF with real fixture', () => {
    let pdfData: Uint8Array;
    let result: PDFParseResult;

    beforeAll(async () => {
      const pdfPath = join(FIXTURES_DIR, 'formaz_g7_sample.pdf');
      pdfData = new Uint8Array(readFileSync(pdfPath));
      result = await parseFMSRevoPDF(pdfData, FANTASY_TEAMS);
    });

    it('successfully parses the PDF', () => {
      expect(result.success).toBe(true);
      expect(result.isPDF).toBe(true);
    });

    it('extracts matchday info', () => {
      expect(result.serieAMatchday).toBe(7);
      expect(result.fantasyMatchday).toBe(1);
    });

    it('finds all 10 teams', () => {
      expect(result.teams.length).toBe(10);
      
      const teamNames = result.teams.map(t => t.matchedTeamName || t.rawTeamName);
      expect(teamNames).toContain('Little Eagles');
      expect(teamNames).toContain('Salen Team');
      expect(teamNames).toContain('Dinamo Cecchignola 1927');
      expect(teamNames).toContain('Amatori ProSecco');
      expect(teamNames).toContain('Atletico Magari');
      expect(teamNames).toContain('Yellow Mustard');
      expect(teamNames).toContain('Real Pedrotte');
      expect(teamNames).toContain('Sfortonia');
      expect(teamNames).toContain('Football And City');
      expect(teamNames).toContain('Parisso San Gennaro');
    });

    it('identifies teams without submitted lineups', () => {
      const emptyTeams = result.teams.filter(t => !t.hasLineup);
      expect(emptyTeams.length).toBe(9);
      
      for (const team of emptyTeams) {
        expect(team.notSubmitted).toBe(true);
        expect(team.starters.length).toBe(0);
        expect(team.bench.length).toBe(0);
      }
    });

    it('correctly parses Parisso San Gennaro lineup with exactly 11 starters', () => {
      const psg = result.teams.find(t => t.matchedTeamId === 'psg' || t.rawTeamName.includes('Parisso'));
      expect(psg).toBeDefined();
      expect(psg!.hasLineup).toBe(true);
      expect(psg!.notSubmitted).toBe(false);
      expect(psg!.starters.length).toBe(11);
    });

    it('parses Parisso San Gennaro starters in correct order with correct roles', () => {
      const psg = result.teams.find(t => t.matchedTeamId === 'psg' || t.rawTeamName.includes('Parisso'));
      expect(psg).toBeDefined();
      
      const expectedStarters = [
        { name: 'Pessina M.', role: 'P', club: 'BOL' },
        { name: 'Akanji M. O.', role: 'D', club: 'INT' },
        { name: 'Obert A.', role: 'D', club: 'CAG' },
        { name: 'Rrahmani A.', role: 'D', club: 'NAP' },
        { name: 'Scalvini G.', role: 'D', club: 'ATA' },
        { name: 'Ferguson L.', role: 'C', club: 'BOL' },
        { name: 'Frendrup M. W.', role: 'C', club: 'GEN' },
        { name: 'Modric L.', role: 'C', club: 'MIL' },
        { name: 'Taylor K. I.', role: 'C', club: 'LAZ' },
        { name: 'Martinez L. J.', role: 'A', club: 'INT' },
        { name: 'Ramos G. M.', role: 'A', club: 'MIL' },
      ];

      for (let i = 0; i < expectedStarters.length; i++) {
        const expected = expectedStarters[i];
        const actual = psg!.starters[i];
        
        expect(actual.rawName).toBe(expected.name);
        expect(actual.role).toBe(expected.role);
        expect(actual.serieAClub).toBe(expected.club);
        expect(actual.position).toBe(i);
        expect(actual.isStarter).toBe(true);
      }
    });

    it('parses Parisso San Gennaro bench with exactly 12 players in correct order', () => {
      const psg = result.teams.find(t => t.matchedTeamId === 'psg' || t.rawTeamName.includes('Parisso'));
      expect(psg).toBeDefined();
      expect(psg!.bench.length).toBe(12);
      
      const expectedBench = [
        { name: 'Skorupski L.', role: 'P', club: 'BOL' },
        { name: 'Muric A. A.', role: 'P', club: 'SAS' },
        { name: 'De Ketelaere C.', role: 'A', club: 'ATA' },
        { name: 'Giovane S. D. N.', role: 'A', club: 'NAP' },
        { name: 'Dovbyk A.', role: 'A', club: 'BOL' },
        { name: 'Cutrone P.', role: 'A', club: 'MON' },
        { name: 'Elmas E.', role: 'C', club: 'ATA' },
        { name: 'Pasalic M.', role: 'C', club: 'ATA' },
        { name: 'Ellertsson M. E.', role: 'C', club: 'GEN' },
        { name: 'Zappacosta D.', role: 'D', club: 'ATA' },
        { name: 'Cambiaso A.', role: 'D', club: 'JUV' },
        { name: 'Ederson J. D. S.', role: 'C', club: 'ATA' },
      ];

      for (let i = 0; i < expectedBench.length; i++) {
        const expected = expectedBench[i];
        const actual = psg!.bench[i];
        
        expect(actual.rawName).toBe(expected.name);
        expect(actual.role).toBe(expected.role);
        expect(actual.serieAClub).toBe(expected.club);
        expect(actual.position).toBe(i);
        expect(actual.isStarter).toBe(false);
      }
    });

    it('returns appropriate message for partial lineups', () => {
      expect(result.message).toContain('formazioni non ancora inserite');
    });
  });

  describe('parseFMSRevoPDF error handling', () => {
    it('handles invalid PDF data', async () => {
      const invalidData = new Uint8Array([0x00, 0x01, 0x02]);
      const result = await parseFMSRevoPDF(invalidData, FANTASY_TEAMS);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Errore');
    });

    it('handles empty PDF', async () => {
      const emptyData = new Uint8Array([]);
      const result = await parseFMSRevoPDF(emptyData, FANTASY_TEAMS);
      
      expect(result.success).toBe(false);
    });
  });
});
