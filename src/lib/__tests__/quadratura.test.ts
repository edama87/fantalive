import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/round-matches-server', () => ({ computeRoundMatches: vi.fn() }));
vi.mock('@/lib/db/supabase', () => ({ getServerClient: vi.fn() }));
vi.mock('@/lib/fmsrevo-client', () => ({ loginFMSRevoReadOnly: vi.fn(), fetchFMSRevoTabellino: vi.fn() }));

import { buildPlayerRows } from '@/lib/quadratura-server';
import type { PlayerScore } from '@/types';

const ps = (name: string, baseVote: number, fantavoto: number, extra: Partial<PlayerScore> = {}) =>
  ({ player: { name, role: 'D' }, baseVote, fantavoto, status: 'played', isUnusedBench: false, ...extra }) as unknown as PlayerScore;
const side = (starters: object[], bench: object[] = []) => ({
  team: 'X', goals: 0, total: 0, partial: 0, homeFactor: 0, modDef: 0, modMid: 0, modAtt: 0, malus: 0,
  starters, bench, tribuna: [],
}) as never;

describe('buildPlayerRows', () => {
  it('evidenzia voto, bonus, sostituzioni e assenze', () => {
    const rows = buildPlayerRows(
      [
        ps('HERMOSO Mario', 5.5, 5),
        ps('GALLO Antonino', 7, 8),
        ps('COUTO Yan', 0, 0, { status: 'sv', substitutedBy: { name: 'X' } } as never),
        ps('DOIG Josh', 5.666, 5.666, { isUnusedBench: true }),
      ],
      side(
        [
          { role: 'D', name: 'Hermoso M.', vote: 5.5, bonus: 0, fantavoto: 5.5, enteredFromBench: false },
          { role: 'D', name: 'Gallo A.', vote: 7, bonus: 1, fantavoto: 8, enteredFromBench: false },
          { role: 'D', name: 'Doig J.', vote: 5.666, bonus: 0, fantavoto: 5.666, enteredFromBench: true },
        ],
        [{ role: null, name: 'Couto Y.', vote: null, bonus: null, fantavoto: null, enteredFromBench: false }, { role: 'C', name: 'Nuovo N.', vote: 6, bonus: 0, fantavoto: 6, enteredFromBench: false }],
      ),
    );
    const by = Object.fromEntries(rows.map((r) => [r.name, r.diff]));
    expect(by['HERMOSO Mario']).toEqual(['bonus', 'fantavoto']);
    expect(by['GALLO Antonino']).toEqual([]);
    expect(by['COUTO Yan']).toEqual([]);
    expect(by['DOIG Josh']).toEqual(['sostituzione']);
    expect(by['Nuovo N.']).toEqual(['presenza']);
  });

  it('riconosce i giocatori in tribuna FMS che sono nella nostra rosa', () => {
    const tribSide = { ...(side([]) as object), tribuna: [
      { role: 'P', name: 'Svilar M.', vote: null, bonus: null, fantavoto: null, enteredFromBench: false },
      { role: 'C', name: 'Sconosciuto S.', vote: null, bonus: null, fantavoto: null, enteredFromBench: false },
    ] } as never;
    const rows = buildPlayerRows([], tribSide, ['SVILAR Mile', 'ALTRO Tizio']);
    expect(rows[0]).toMatchObject({ name: 'SVILAR Mile', ours: { state: 'tribuna' }, fms: { state: 'tribuna' }, diff: [] });
    expect(rows[1]).toMatchObject({ name: 'Sconosciuto S.', ours: null, diff: ['presenza'] });
  });
});
