import { describe, expect, it } from 'vitest';
import { buildImportRostersPayload } from '@/lib/roster-import';
import type { ParsedTeamRoster } from '@/lib/fmsrevo-roster-parser';

const sampleTeam = (name: string, n = 25): ParsedTeamRoster => {
  const roles = [
    ...Array(3).fill('P'),
    ...Array(8).fill('D'),
    ...Array(8).fill('C'),
    ...Array(6).fill('A'),
  ] as Array<'P' | 'D' | 'C' | 'A'>;
  return {
    fmsTeamId: 1,
    teamName: name,
    players: roles.slice(0, n).map((role, i) => ({
      name: `PLAYER ${name} ${i}`,
      role,
      realTeam: 'NAP',
      price: 10 + i,
    })),
  };
};

describe('buildImportRostersPayload', () => {
  it('maps FMS team/player fields for the SQL RPC', () => {
    const payload = buildImportRostersPayload([sampleTeam('Yellow Mustard')]);
    expect(payload.teams).toHaveLength(1);
    expect(payload.teams[0]).toMatchObject({
      teamName: 'Yellow Mustard',
      managerName: 'TBD',
    });
    expect(payload.teams[0].players).toHaveLength(25);
    expect(payload.teams[0].players[0]).toEqual({
      name: 'PLAYER Yellow Mustard 0',
      role: 'P',
      realTeam: 'NAP',
      price: 10,
    });
  });

  it('preserves exact FMS player names', () => {
    const team: ParsedTeamRoster = {
      fmsTeamId: 2,
      teamName: 'Atletico Magari',
      players: [
        { name: 'MERET Alex', role: 'P', realTeam: 'NAP', price: 20 },
      ],
    };
    const payload = buildImportRostersPayload([team]);
    expect(payload.teams[0].players[0].name).toBe('MERET Alex');
  });
});
