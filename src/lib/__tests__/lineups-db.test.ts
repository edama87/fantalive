import { describe, expect, it } from 'vitest';
import {
  buildUpsertLineupsPayload,
  createLineupProviderFromMap,
  lineupKey,
  mapDbLineupsToMap,
} from '@/lib/lineups-db';

describe('lineups-db helpers', () => {
  it('maps DB rows to Lineup map preserving starter/bench order', () => {
    const map = mapDbLineupsToMap([
      {
        team_id: 'ym',
        round_number: 1,
        formation: '4-4-2',
        lineup_slots: [
          { player_id: 'p2', slot_type: 'starter', position: 1 },
          { player_id: 'p1', slot_type: 'starter', position: 0 },
          { player_id: 'b1', slot_type: 'bench', position: 0 },
          { player_id: 'b2', slot_type: 'bench', position: 1 },
        ],
      },
    ]);

    const lineup = map[lineupKey('ym', 1)];
    expect(lineup.formation).toBe('4-4-2');
    expect(lineup.starters.map((s) => s.playerId)).toEqual(['p1', 'p2']);
    expect(lineup.bench.map((s) => s.playerId)).toEqual(['b1', 'b2']);
  });

  it('buildUpsertLineupsPayload skips empty starter lists', () => {
    const payload = buildUpsertLineupsPayload(3, [
      {
        teamId: 'ym',
        formation: '4-4-2',
        starterIds: ['a', 'b'],
        benchIds: ['c'],
      },
      {
        teamId: 'am',
        formation: null,
        starterIds: [],
        benchIds: [],
      },
    ]);
    expect(payload.roundNumber).toBe(3);
    expect(payload.lineups).toHaveLength(1);
    expect(payload.lineups[0]).toMatchObject({
      teamId: 'ym',
      formation: '4-4-2',
      starters: ['a', 'b'],
      bench: ['c'],
    });
  });

  it('buildUpsertLineupsPayload rejects unmatched null player ids', () => {
    expect(() =>
      buildUpsertLineupsPayload(1, [
        {
          teamId: 'ym',
          formation: '4-4-2',
          starterIds: ['a', null, 'c'],
          benchIds: ['d', undefined],
        },
      ])
    ).toThrow(/salvataggio bloccato/i);
  });

  it('createLineupProviderFromMap falls back to default when missing', () => {
    const provider = createLineupProviderFromMap({
      [lineupKey('ym', 1)]: {
        teamId: 'ym',
        roundNumber: 1,
        formation: '3-5-2',
        starters: [{ playerId: 'x', position: 0 }],
        bench: [],
      },
    });
    expect(provider('ym', 1).formation).toBe('3-5-2');
    expect(provider('am', 1).teamId).toBe('am');
  });

  it('copies previous lineup when usePreviousLineup is set', () => {
    const previous = {
      [lineupKey('ym', 1)]: {
        teamId: 'ym',
        roundNumber: 1,
        formation: '5-3-2',
        starters: [
          { playerId: 's1', position: 0 },
          { playerId: 's2', position: 1 },
        ],
        bench: [{ playerId: 'b1', position: 0 }],
      },
    };
    const payload = buildUpsertLineupsPayload(
      2,
      [{ teamId: 'ym', formation: null, starterIds: [], benchIds: [], usePreviousLineup: true }],
      previous
    );
    expect(payload.lineups[0]).toMatchObject({
      teamId: 'ym',
      formation: '5-3-2',
      starters: ['s1', 's2'],
      bench: ['b1'],
    });
  });
});
