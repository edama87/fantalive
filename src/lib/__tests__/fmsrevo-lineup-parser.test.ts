import { describe, it, expect } from 'vitest';
import {
  fuzzyMatchPlayer,
  fuzzyMatchTeam,
  parseLineupsContent,
  validateLineupAgainstRoster,
  ParsedTeamLineup,
} from '../fmsrevo-lineup-parser';
import { Player } from '@/types';

const mockPlayers: Player[] = [
  { id: 'p1', name: 'Alex Meret', role: 'P', teamId: 'ym' },
  { id: 'p2', name: 'Giovanni Di Lorenzo', role: 'D', teamId: 'ym' },
  { id: 'p3', name: 'Arijanet Muric', role: 'P', teamId: 'fc' },
  { id: 'p4', name: 'Marcus Thuram', role: 'A', teamId: 'sf' },
  { id: 'p5', name: 'Nicolò Barella', role: 'C', teamId: 'rp' },
  { id: 'p6', name: 'Rafael Leão', role: 'A', teamId: 'am' },
  { id: 'p7', name: 'Dusan Vlahovic', role: 'A', teamId: 'le' },
  { id: 'p8', name: 'Khvicha Kvaratskhelia', role: 'A', teamId: 'psg' },
];

const mockTeams = [
  { id: 'ym', name: 'Yellow Mustard' },
  { id: 'am', name: 'Atletico Magari' },
  { id: 'fc', name: 'Football And City' },
  { id: 'sf', name: 'Sfortonia' },
  { id: 'rp', name: 'Real Pedrotte' },
  { id: 'le', name: 'Lega Elite' },
  { id: 'psg', name: 'PSG Fantasy' },
];

describe('fuzzyMatchPlayer', () => {
  it('matches exact name (reversed format: SURNAME First)', () => {
    const result = fuzzyMatchPlayer('MERET Alex', mockPlayers);
    expect(result.playerId).toBe('p1');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('matches surname only', () => {
    const result = fuzzyMatchPlayer('BARELLA', mockPlayers);
    expect(result.playerId).toBe('p5');
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('matches full name with middle names', () => {
    const result = fuzzyMatchPlayer('MURIC Arijanet Anan', mockPlayers);
    expect(result.playerId).toBe('p3');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('matches name with accents', () => {
    const result = fuzzyMatchPlayer('LEAO Rafael', mockPlayers);
    expect(result.playerId).toBe('p6');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('returns null for empty input', () => {
    const result = fuzzyMatchPlayer('', mockPlayers);
    expect(result.playerId).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('returns null for dash placeholder', () => {
    const result = fuzzyMatchPlayer('-', mockPlayers);
    expect(result.playerId).toBeNull();
  });

  it('prefers player with matching role when confidence is similar', () => {
    const result = fuzzyMatchPlayer('THURAM Marcus', mockPlayers, 'A');
    expect(result.playerId).toBe('p4');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('handles special characters in names', () => {
    const result = fuzzyMatchPlayer('KVARATSKHELIA Khvicha', mockPlayers);
    expect(result.playerId).toBe('p8');
  });

  it('prefers exact FMS name on the team roster over seed lookalikes', () => {
    const seedLookalike: Player = {
      id: 'ym-meret',
      name: 'Meret',
      role: 'P',
      teamId: 'ym',
    };
    const fmsPlayer: Player = {
      id: 'meret-alex-p',
      name: 'MERET Alex',
      role: 'P',
      teamId: 'ym',
      realTeam: 'NAP',
    };
    const result = fuzzyMatchPlayer(
      'MERET Alex',
      [seedLookalike, fmsPlayer],
      'P',
      'NAP',
      [fmsPlayer]
    );
    expect(result.playerId).toBe('meret-alex-p');
    expect(result.confidence).toBe(1);
  });

  it('does not fall back to seed when preferred roster is provided', () => {
    const seedLookalike: Player = {
      id: 'ym-meret',
      name: 'Meret',
      role: 'P',
      teamId: 'ym',
    };
    const otherFms: Player = {
      id: 'svilar-mile-p',
      name: 'SVILAR Mile',
      role: 'P',
      teamId: 'ym',
    };
    const result = fuzzyMatchPlayer(
      'MERET Alex',
      [seedLookalike, otherFms],
      'P',
      'NAP',
      [otherFms]
    );
    expect(result.playerId).toBeNull();
  });
});

describe('fuzzyMatchTeam', () => {
  it('matches exact team name', () => {
    const result = fuzzyMatchTeam('Yellow Mustard', mockTeams);
    expect(result.teamId).toBe('ym');
    expect(result.confidence).toBe(1);
  });

  it('matches case-insensitive', () => {
    const result = fuzzyMatchTeam('ATLETICO MAGARI', mockTeams);
    expect(result.teamId).toBe('am');
    expect(result.confidence).toBe(1);
  });

  it('matches with minor typos', () => {
    const result = fuzzyMatchTeam('Yellow Mustrd', mockTeams);
    expect(result.teamId).toBe('ym');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('matches partial name', () => {
    const result = fuzzyMatchTeam('Real Pedrott', mockTeams);
    expect(result.teamId).toBe('rp');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('returns null for empty input', () => {
    const result = fuzzyMatchTeam('', mockTeams);
    expect(result.teamId).toBeNull();
  });

  it('returns null for no match', () => {
    const result = fuzzyMatchTeam('Unknown Team XYZ', mockTeams);
    expect(result.teamId).toBeNull();
  });
});

describe('parseLineupsContent', () => {
  it('detects authentication error in response', () => {
    const content = 'Questa pagina è accessibile solo da utenti autenticati';
    const result = parseLineupsContent(content, mockPlayers, mockTeams);
    
    expect(result.success).toBe(false);
    expect(result.parseErrors).toContain('Login required: page is only accessible to authenticated users');
  });

  it('parses simple text format lineup', () => {
    const content = `
Yellow Mustard
4-4-2
1. MERET Alex (POR) - NAP
2. DI LORENZO Giovanni (DIF) - NAP

PANCHINA:
12. MURIC Arijanet (POR) - ATA
    `;

    const result = parseLineupsContent(content, mockPlayers, mockTeams);
    
    expect(result.success).toBe(true);
    expect(result.teams.length).toBeGreaterThan(0);
    
    const ymTeam = result.teams.find(t => t.matchedTeamId === 'ym');
    expect(ymTeam).toBeDefined();
    expect(ymTeam?.formation).toBe('4-4-2');
    expect(ymTeam?.starters.length).toBe(2);
    expect(ymTeam?.bench.length).toBe(1);
  });

  it('parses lineup with dash-separated format', () => {
    const content = `
Yellow Mustard:
MERET Alex - POR - NAP
DI LORENZO Giovanni - DIF - NAP
    `;

    const result = parseLineupsContent(content, mockPlayers, mockTeams);
    
    expect(result.success).toBe(true);
    const ymTeam = result.teams.find(t => t.matchedTeamId === 'ym');
    expect(ymTeam?.starters.some(s => s.matchedPlayerId === 'p1')).toBe(true);
    expect(ymTeam?.starters.some(s => s.matchedPlayerId === 'p2')).toBe(true);
  });

  it('handles HTML content', () => {
    const html = `
<html>
<body>
<h2>Yellow Mustard</h2>
<p>4-4-2</p>
<table>
<tr><td>1</td><td>MERET Alex (POR) - NAP</td></tr>
<tr><td>2</td><td>DI LORENZO Giovanni (DIF) - NAP</td></tr>
</table>
<h3>PANCHINA</h3>
<table>
<tr><td>12</td><td>MURIC Arijanet (POR) - ATA</td></tr>
</table>
</body>
</html>
    `;

    const result = parseLineupsContent(html, mockPlayers, mockTeams);
    
    expect(result.source).toBe('html');
    expect(result.teams.length).toBeGreaterThan(0);
  });

  it('extracts Serie A matchday from content', () => {
    const content = `
Formazioni Giornata 7
Yellow Mustard
MERET Alex - POR - NAP
    `;

    const result = parseLineupsContent(content, mockPlayers, mockTeams);
    expect(result.serieAMatchday).toBe(7);
  });

  it('reports missing teams', () => {
    const content = `
Yellow Mustard
MERET Alex - POR - NAP
    `;

    const result = parseLineupsContent(content, mockPlayers, mockTeams);
    
    expect(result.parseErrors.some(e => e.includes('Missing lineups'))).toBe(true);
  });

  it('reports unmatched players as errors', () => {
    const content = `
Yellow Mustard
UNKNOWN PLAYER Name - POR - NAP
    `;

    const result = parseLineupsContent(content, mockPlayers, mockTeams);
    
    const ymTeam = result.teams.find(t => t.matchedTeamId === 'ym');
    expect(ymTeam?.errors.some(e => e.includes('not matched'))).toBe(true);
  });

  it('reports unmatched bench players as errors (never silent)', () => {
    const content = `
Yellow Mustard
4-4-2
MERET Alex - POR - NAP
PANCHINA
UNKNOWN BENCH Guy - DIF - NAP
    `;

    const result = parseLineupsContent(content, mockPlayers, mockTeams);
    const ymTeam = result.teams.find((t) => t.matchedTeamId === 'ym');
    expect(ymTeam?.bench.some((b) => b.rawName.includes('UNKNOWN'))).toBe(true);
    expect(
      ymTeam?.errors.some((e) => e.includes('bench') && e.includes('not matched'))
    ).toBe(true);
  });

  it('matches starters against preferred FMS roster by exact name', () => {
    const fmsRoster: Player[] = [
      {
        id: 'meret-alex-p',
        name: 'MERET Alex',
        role: 'P',
        teamId: 'ym',
        realTeam: 'NAP',
      },
    ];
    const seedAndFms: Player[] = [
      { id: 'ym-meret', name: 'Meret', role: 'P', teamId: 'ym' },
      ...fmsRoster,
    ];
    const content = `
Yellow Mustard
MERET Alex - POR - NAP
    `;
    const result = parseLineupsContent(content, seedAndFms, mockTeams, {
      ym: fmsRoster,
    });
    const ymTeam = result.teams.find((t) => t.matchedTeamId === 'ym');
    expect(ymTeam?.starters[0]?.matchedPlayerId).toBe('meret-alex-p');
  });

  it('handles empty content gracefully', () => {
    const result = parseLineupsContent('', mockPlayers, mockTeams);
    
    expect(result.success).toBe(false);
    expect(result.teams.length).toBe(0);
  });

  it('parses multiple teams in content', () => {
    const content = `
===================
Yellow Mustard
4-4-2
MERET Alex - POR - NAP
===================
Atletico Magari
4-3-3
LEAO Rafael - ATT - MIL
===================
    `;

    const result = parseLineupsContent(content, mockPlayers, mockTeams);
    
    expect(result.teams.length).toBeGreaterThanOrEqual(2);
    
    const ym = result.teams.find(t => t.matchedTeamId === 'ym');
    const am = result.teams.find(t => t.matchedTeamId === 'am');
    
    expect(ym).toBeDefined();
    expect(am).toBeDefined();
  });
});

describe('validateLineupAgainstRoster', () => {
  it('returns valid when all players are in roster', () => {
    const lineup: ParsedTeamLineup = {
      rawTeamName: 'Yellow Mustard',
      matchedTeamId: 'ym',
      matchedTeamName: 'Yellow Mustard',
      matchedTeamConfidence: 1,
      formation: '4-4-2',
      starters: [
        { rawName: 'Meret', role: 'P', roleRaw: 'POR', serieAClub: 'NAP', position: 0, isStarter: true, matchedPlayerId: 'p1', matchedPlayerConfidence: 1, matchedPlayerName: 'Alex Meret' },
      ],
      bench: [],
      errors: [],
      warnings: [],
      hasLineup: true,
    };

    const roster = new Set(['p1', 'p2', 'p3']);
    const result = validateLineupAgainstRoster(lineup, roster);

    expect(result.valid).toBe(true);
    expect(result.notInRoster.length).toBe(0);
  });

  it('returns invalid when player not in roster', () => {
    const lineup: ParsedTeamLineup = {
      rawTeamName: 'Yellow Mustard',
      matchedTeamId: 'ym',
      matchedTeamName: 'Yellow Mustard',
      matchedTeamConfidence: 1,
      formation: '4-4-2',
      starters: [
        { rawName: 'Meret', role: 'P', roleRaw: 'POR', serieAClub: 'NAP', position: 0, isStarter: true, matchedPlayerId: 'p1', matchedPlayerConfidence: 1, matchedPlayerName: 'Alex Meret' },
        { rawName: 'Barella', role: 'C', roleRaw: 'CEN', serieAClub: 'INT', position: 1, isStarter: true, matchedPlayerId: 'p5', matchedPlayerConfidence: 1, matchedPlayerName: 'Nicolò Barella' },
      ],
      bench: [],
      errors: [],
      warnings: [],
      hasLineup: true,
    };

    const roster = new Set(['p1', 'p2']);
    const result = validateLineupAgainstRoster(lineup, roster);

    expect(result.valid).toBe(false);
    expect(result.notInRoster.length).toBe(1);
    expect(result.notInRoster[0].matchedPlayerId).toBe('p5');
  });

  it('ignores unmatched players in validation', () => {
    const lineup: ParsedTeamLineup = {
      rawTeamName: 'Yellow Mustard',
      matchedTeamId: 'ym',
      matchedTeamName: 'Yellow Mustard',
      matchedTeamConfidence: 1,
      formation: '4-4-2',
      starters: [
        { rawName: 'Unknown', role: 'P', roleRaw: 'POR', serieAClub: 'NAP', position: 0, isStarter: true, matchedPlayerId: null, matchedPlayerConfidence: 0, matchedPlayerName: null },
      ],
      bench: [],
      errors: [],
      warnings: [],
      hasLineup: true,
    };

    const roster = new Set(['p1']);
    const result = validateLineupAgainstRoster(lineup, roster);

    expect(result.valid).toBe(true);
    expect(result.notInRoster.length).toBe(0);
  });
});
