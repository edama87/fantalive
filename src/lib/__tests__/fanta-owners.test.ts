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

describe('buildPlayerOwners con cambi automatici', () => {
  it('panchinaro entrato = titolare con subIn, titolare sostituito = panchina con subOut', () => {
    const lineups = {
      'fc-3': { teamId: 'fc', roundNumber: 3, formation: '3-4-3', starters: [{ playerId: 'comert', position: 1 }, { playerId: 'x', position: 2 }], bench: [{ playerId: 'coco', position: 1 }, { playerId: 'y', position: 2 }] },
    } as unknown as LineupMap;
    const names: Record<string, string> = { comert: 'COMERT Eray', coco: 'COCO Saul' };
    const owners = buildPlayerOwners(lineups, [], { fc: [{ starterId: 'comert', benchId: 'coco' }] }, (id) => names[id] ?? id);
    expect(owners.get('coco')).toEqual({ teamId: 'fc', status: 'starter', subIn: 'COMERT Eray' });
    expect(owners.get('comert')).toEqual({ teamId: 'fc', status: 'bench', subOut: 'COCO Saul' });
    expect(owners.get('x')).toEqual({ teamId: 'fc', status: 'starter' });
    expect(owners.get('y')).toEqual({ teamId: 'fc', status: 'bench' });
  });
});
