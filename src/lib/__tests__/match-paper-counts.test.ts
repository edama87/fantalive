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
    expect(counts.get('lazzari')).toBe(3);
    expect(counts.get('pedraza')).toBe(3);
  });

  it('paper missing for the whole match gives fewer papers to everyone', () => {
    const counts = matchPaperCounts([
      { home_team: 'Lecce', away_team: 'Juventus', players: [pl('a', 6, null, null), pl('b', 7, null, null)] },
    ]);
    expect(counts.get('a')).toBe(1);
    expect(counts.get('b')).toBe(1);
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
    const data = assembleRoundPlayerData([row('lazzari'), row('ljuv')], [], [], undefined, new Map([['lazzari', 3], ['ljuv', 1]]));
    expect(data.get('lazzari')?.paperCount).toBe(3);
    expect(data.get('ljuv')?.paperCount).toBe(1);
    const scores = [...data.values()].map(
      (d) => ({ voteSource: d.voteSource, paperCount: d.paperCount, baseVote: 6, status: 'played', isUnusedBench: false, player: { id: d.playerId } }) as unknown as PlayerScore
    );
    expect(voteSourceCounts(scores)).toMatchObject({ consolidated: 2, consolidatedFull: 1 });
  });
});
