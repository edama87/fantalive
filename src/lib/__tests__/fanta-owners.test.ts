import { describe, expect, it } from 'vitest';
import { buildPlayerOwners } from '../fanta-owners';
import type { LineupMap } from '../lineups-db';

describe('buildPlayerOwners', () => {
  it('titolare/panchina dalla formazione, tribuna dalla rosa, svincolati assenti', () => {
    const lineups = {
      'ap-4': { teamId: 'ap', roundNumber: 4, formation: '3-4-3', starters: [{ playerId: 'a', position: 1 }], bench: [{ playerId: 'b', position: 1 }] },
    } as unknown as LineupMap;
    const owners = buildPlayerOwners(lineups, [
      { teamId: 'ap', playerIds: ['a', 'b', 'c'] },
      { teamId: 'psg', playerIds: ['d'] },
    ]);
    expect(owners.get('a')).toEqual({ teamId: 'ap', status: 'starter' });
    expect(owners.get('b')).toEqual({ teamId: 'ap', status: 'bench' });
    expect(owners.get('c')).toEqual({ teamId: 'ap', status: 'out' });
    expect(owners.get('d')).toEqual({ teamId: 'psg', status: 'out' });
    expect(owners.has('z')).toBe(false);
  });
});
