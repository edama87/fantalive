import { describe, expect, it, vi } from 'vitest';

const upserts: unknown[][] = [];
vi.mock('@/lib/db/supabase', () => ({
  getServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: [{ player_id: 'consolidated-1' }], error: null }),
        }),
      }),
      upsert: async (rows: unknown[]) => {
        upserts.push(rows);
        return { error: null };
      },
    }),
  }),
}));

import { saveFantacalcioOfficialVotes } from '../official-votes';
import type { FantacalcioScrapedPlayer } from '../fantacalcio-it-client';

const player = (playerId: string | null, vote: number | null) =>
  ({ playerId, vote, fantaVote: vote, bonuses: [], name: playerId ?? 'x', team: 'Inter', role: 'A', matchId: 'm' }) as unknown as FantacalcioScrapedPlayer;

describe('saveFantacalcioOfficialVotes', () => {
  it('never writes rows for players with consolidated (pianetafanta) votes', async () => {
    const result = await saveFantacalcioOfficialVotes(1, [
      player('consolidated-1', 7),
      player('estimated-1', 6.5),
      player(null, 6),
      player('sv-1', null),
    ]);
    expect(result).toEqual({ saved: 1, skippedConsolidated: 1 });
    expect(upserts).toHaveLength(1);
    const rows = upserts[0] as Array<Record<string, unknown>>;
    expect(rows.map((row) => row.player_id)).toEqual(['estimated-1']);
    // nessun campo dei consolidati nel payload (source/consolidated_at restano quelli del DB)
    expect(rows[0]).not.toHaveProperty('source');
    expect(rows[0]).not.toHaveProperty('consolidated_at');
  });
});
