import { describe, expect, it } from 'vitest';
import { assembleRoundPlayerData, matchPaperCounts, type OfficialVoteRow } from '@/lib/round-player-data';
import { voteSourceCounts } from '@/lib/vote-source';
import type { PlayerScore } from '@/types';

const pl = (playerId: string, gazzetta: number | null, corriere: number | null, tuttosport: number | null) => ({
  playerId,
  votes: { gazzetta, corriere, tuttosport },
});

describe('matchPaperCounts', () => {
  it('player s.v. on some papers in a complete match still gets 3', () => {
    const counts = matchPaperCounts([
      {
        home_team: 'Lazio',
        away_team: 'Parma',
        players: [
          pl('lazzari', 6, null, null),
          pl('pedraza', 6, 0, null),
          ...Array.from({ length: 20 }, (_, i) => pl(`p${i}`, 6, 6.5, 6)),
        ],
      },
    ]);
    expect(counts.get('lazzari')).toEqual({ papers: 3, gazzetta: true });
    expect(counts.get('pedraza')?.papers).toBe(3);
  });

  it('paper missing for the whole match gives fewer papers to everyone', () => {
    const counts = matchPaperCounts([
      { home_team: 'Lecce', away_team: 'Juventus', players: [pl('a', 6, null, null), pl('b', 7, null, null)] },
    ]);
    expect(counts.get('a')).toEqual({ papers: 1, gazzetta: true });
    expect(counts.get('b')?.papers).toBe(1);
  });

  it('ignores excluded players and rows without playerId', () => {
    const counts = matchPaperCounts([
      { home_team: 'A', away_team: 'B', players: [{ ...pl('x', 6, 6, 6), excluded: true }, { votes: { gazzetta: 6 } }] },
    ]);
    expect(counts.size).toBe(0);
  });

  it('flows into player data and the home counter', () => {
    const row = (id: string): OfficialVoteRow =>
      ({ player_id: id, source: 'pianetafanta', vote_gazzetta: 6, vote_corriere: null, vote_tuttosport: null, minutes_played: 10, bonus_malus: null }) as unknown as OfficialVoteRow;
    const data = assembleRoundPlayerData([row('lazzari'), row('ljuv')], [], [], undefined, new Map([['lazzari', { papers: 3, gazzetta: true }], ['ljuv', { papers: 1, gazzetta: true }]]));
    expect(data.get('lazzari')?.paperCount).toBe(3);
    expect(data.get('ljuv')?.paperCount).toBe(1);
    const scores = [...data.values()].map(
      (d) => ({ voteSource: d.voteSource, paperCount: d.paperCount, baseVote: 6, status: 'played', isUnusedBench: false, player: { id: d.playerId } }) as unknown as PlayerScore
    );
    expect(voteSourceCounts(scores)).toMatchObject({ consolidated: 2, consolidatedFull: 1 });
  });

  it('Gazzetta master: s.v. Gazzetta in a Gazzetta-rated match = senza voto (Lobotka)', () => {
    const row = (id: string, g: number | null, cs: number | null, ts: number | null): OfficialVoteRow =>
      ({ player_id: id, source: 'pianetafanta', vote_gazzetta: g, vote_corriere: cs, vote_tuttosport: ts, minutes_played: 20, bonus_malus: null }) as unknown as OfficialVoteRow;
    const full = { papers: 3, gazzetta: true };
    const noG = { papers: 2, gazzetta: false };
    const data = assembleRoundPlayerData(
      [row('lobotka', null, 6, 6), row('zero', 0, 6, 6.5), row('ok', 6, null, null), row('nog', null, 6, 7)],
      [], [], undefined,
      new Map([['lobotka', full], ['zero', full], ['ok', full], ['nog', noG]])
    );
    expect(data.get('lobotka')?.estimatedVote).toBeNull();
    expect(data.get('zero')?.estimatedVote).toBeNull();
    expect(data.get('ok')?.estimatedVote).toBe(6);
    // Gazzetta assente per tutta la partita: media delle testate disponibili.
    expect(data.get('nog')?.estimatedVote).toBe(6.5);
  });
});
