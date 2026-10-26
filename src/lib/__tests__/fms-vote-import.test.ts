import { describe, it, expect } from 'vitest';
import { adjustEvents, applyItemsToPlayerData, eventsToBonusMalus, fmsVoteRow, saveFmsVotes, undoFmsVotes, type FmsImportItem } from '@/lib/fms-vote-import';
import { fantavotoFromData, calculateFantavoto } from '@/lib/scoring-engine';
import { assembleRoundPlayerData } from '@/lib/round-player-data';
import type { PlayerMatchData } from '@/types';

const zero = { goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0, assists: 0, ownGoals: 0, yellowCards: 1, redCards: 0, goalsConceded: 0 };

function item(over: Partial<FmsImportItem> = {}): FmsImportItem {
  return {
    playerId: 'p1', name: 'Hermoso', fmsName: 'HERMOSO Mario', role: 'D', team: 'Dinamo', matchKey: 'sf-dc', idIncontro: 478,
    ours: { vote: 5.5, bonus: -0.5, fantavoto: 5, source: 'consolidated' }, fms: { vote: 5.5, bonus: 0, fantavoto: 5.5 },
    diff: ['bonus'], eventChanges: [], ...over,
  };
}

describe('adjustEvents', () => {
  it('toglie un\'ammonizione quando FMS non ha il malus', () => {
    const r = adjustEvents([{ playerId: 'p1', type: 'yellow_card', minute: 30 }], 'p1', 0.5, false);
    expect(r.events).toEqual([]);
    expect(r.changes).toEqual(['− ammonizione']);
  });
  it('aggiunge un gol per +3 (non portiere) e un\'ammonizione per -0,5', () => {
    expect(adjustEvents([], 'p', 3, false).changes).toEqual(['+ gol']);
    expect(adjustEvents([], 'p', -0.5, false).events[0].type).toBe('yellow_card');
  });
  it('segnala il bonus non spiegabile', () => {
    expect(adjustEvents([], 'p', 3, true).changes).toEqual(['+ rigore parato']);
    expect(adjustEvents([], 'p', -3, true).changes[0]).toMatch(/senza evento/);
  });
});

describe('fantavotoFromData', () => {
  it('con bonusOverride vale voto + bonus FMS', () => {
    const data: PlayerMatchData = { playerId: 'p', estimatedVote: 6.333, minutesPlayed: 90, isPlaying: false, events: [], bonusOverride: 3 };
    expect(fantavotoFromData(6.333, zero, false, data)).toBeCloseTo(9.333);
  });
  it('senza override resta il calcolo dagli eventi', () => {
    expect(fantavotoFromData(6, zero, false, undefined)).toBe(calculateFantavoto(6, zero, false));
  });
});

describe('righe official_votes fms', () => {
  it('il loader legge vote_fms e fms_bonus come consolidato', () => {
    const map = assembleRoundPlayerData(
      [{ player_id: 'p', source: 'fms', vote_fms: '6.333', fms_bonus: '-0.5', vote_fantacalcio: null, minutes_played: 90, bonus_malus: [{ type: 'yellow_card', count: 1 }] }],
      [{ player_id: 'p', estimated_vote: 7, minutes_played: 90, is_playing: false }], []
    );
    const d = map.get('p')!;
    expect(d.estimatedVote).toBeCloseTo(6.333);
    expect(d.bonusOverride).toBe(-0.5);
    expect(d.voteSource).toBe('consolidated');
  });
  it('s.v. FMS = voto null', () => {
    const map = assembleRoundPlayerData([{ player_id: 'p', source: 'fms', vote_fms: null, fms_bonus: null, vote_fantacalcio: null, minutes_played: 0, bonus_malus: [] }], [], []);
    expect(map.get('p')!.estimatedVote).toBeNull();
  });
  it('applyItemsToPlayerData allinea eventi e override', () => {
    const data = new Map<string, PlayerMatchData>([['p1', { playerId: 'p1', estimatedVote: 5.5, minutesPlayed: 90, isPlaying: false, events: [{ playerId: 'p1', type: 'yellow_card', minute: 10 }] }]]);
    const next = applyItemsToPlayerData(data, [item()]);
    expect(next.get('p1')!.events).toEqual([]);
    expect(next.get('p1')!.bonusOverride).toBe(0);
    expect(data.get('p1')!.events).toHaveLength(1);
  });
  it('fmsVoteRow conserva la riga precedente (senza colonne generate)', () => {
    const prev = { round_number: 2, player_id: 'p1', source: 'pianetafanta', vote_gazzetta: 5.5, vote_average: 5.5 };
    const row = fmsVoteRow(2, item(), { playerId: 'p1', estimatedVote: 5.5, minutesPlayed: 90, isPlaying: false, events: [] }, prev, 'now');
    expect(row).toMatchObject({ source: 'fms', vote_fms: 5.5, fms_bonus: 0, fanta_vote: 5.5, vote_gazzetta: null });
    expect(row.previous_row).toEqual({ round_number: 2, player_id: 'p1', source: 'pianetafanta', vote_gazzetta: 5.5 });
    // Re-import: resta la riga originale, non quella fms.
    const again = fmsVoteRow(2, item(), { playerId: 'p1', estimatedVote: 5.5, minutesPlayed: 90, isPlaying: false, events: [] }, row, 'later');
    expect(again.previous_row).toEqual(row.previous_row);
  });
  it('eventsToBonusMalus raggruppa e mappa i gol subiti', () => {
    expect(eventsToBonusMalus([{ playerId: 'p', type: 'goal', minute: 1, relatedPlayerId: 'opponent' }, { playerId: 'p', type: 'goal', minute: 2, relatedPlayerId: 'opponent' }]))
      .toEqual([{ type: 'goal_conceded', count: 2, minute: null }]);
  });
});

/** Mini DB in memoria con l'API query-builder usata da saveFmsVotes/undoFmsVotes. */
function memoryDb(initial: Record<string, Record<string, unknown>[]>) {
  const tables = initial;
  return {
    tables,
    from(name: string) {
      tables[name] ??= [];
      const filters: Array<(r: Record<string, unknown>) => boolean> = [];
      let op: 'select' | 'delete' = 'select';
      const q = {
        select() { op = 'select'; return q; },
        delete() { op = 'delete'; return q; },
        eq(k: string, v: unknown) { filters.push((r) => r[k] === v); return q; },
        in(k: string, vs: unknown[]) { filters.push((r) => vs.includes(r[k])); return q; },
        upsert(rows: Record<string, unknown> | Record<string, unknown>[], o: { onConflict: string }) {
          const keys = o.onConflict.split(',');
          for (const row of Array.isArray(rows) ? rows : [rows]) {
            const i = tables[name].findIndex((r) => keys.every((k) => r[k] === row[k]));
            if (i >= 0) tables[name][i] = row; else tables[name].push(row);
          }
          return Promise.resolve({ error: null });
        },
        insert(rows: Record<string, unknown>[]) { tables[name].push(...rows); return Promise.resolve({ error: null }); },
        then(res: (v: unknown) => void) {
          const match = (r: Record<string, unknown>) => filters.every((f) => f(r));
          if (op === 'delete') { tables[name] = tables[name].filter((r) => !match(r)); return Promise.resolve({ error: null }).then(res); }
          return Promise.resolve({ data: tables[name].filter(match), error: null }).then(res);
        },
      };
      return q;
    },
  };
}

describe('conferma e annullamento', () => {
  it('scrive le righe fms e le annulla ripristinando le precedenti', async () => {
    const original = { round_number: 2, player_id: 'p1', source: 'pianetafanta', vote_gazzetta: 5.5 };
    const db = memoryDb({ official_votes: [{ ...original }, { round_number: 2, player_id: 'p2', source: 'pianetafanta' }], official_vote_imports: [] });
    const data = new Map<string, PlayerMatchData>([['p1', { playerId: 'p1', estimatedVote: 5.5, minutesPlayed: 90, isPlaying: false, events: [] }]]);
    const newcomer = item({ playerId: 'p3', ours: { vote: null, bonus: null, fantavoto: null, source: null }, fms: { vote: 5, bonus: 0, fantavoto: 5 } });
    expect(await saveFmsVotes(db, 2, 9, [item(), newcomer], data)).toEqual({ saved: 2 });
    expect(db.tables.official_votes.filter((r) => r.source === 'fms')).toHaveLength(2);
    expect(db.tables.official_vote_imports).toHaveLength(1);

    expect(await undoFmsVotes(db, 2)).toEqual({ removed: 2, restored: 1 });
    expect(db.tables.official_votes).toEqual(expect.arrayContaining([original]));
    expect(db.tables.official_votes.find((r) => r.player_id === 'p3')).toBeUndefined();
    expect(db.tables.official_votes).toHaveLength(2);
    expect(db.tables.official_vote_imports).toHaveLength(0);
  });
});
