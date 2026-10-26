import { describe, expect, it } from 'vitest';
import { averageOfVotes, masterVote, paperVote } from '@/lib/vote-precision';
import { parsePianetafantaRows, type PianetafantaMatchedPlayer } from '@/lib/pianetafanta';
import { consolidatedVote } from '@/lib/round-player-data';
import { rematchStoredImport } from '@/lib/vote-reapply';
import { pianetafantaVoteRow } from '@/lib/official-votes';
import { consolidatedPlayersOf, excludePlayer } from '@/lib/consolidated-votes-admin';

const header = ['ID', 'Giocatore', 'Ruolo', 'Ruolo2', 'Squadra', 'Min.Gioc.', 'Min', 'MinU', 'G', 'GF', 'GS', 'Aut', 'Ass', 'AdF', 'CS', 'GF', 'GS', 'Aut', 'Ass', 'AdF', 'TS', 'GF', 'GS', 'Aut', 'Ass', 'AdF', 'M2', 'M3', 'Amm', 'Esp', 'Gdv', 'Gdp', 'RigS', 'RigP', 'Rt', 'Rs', 'T', 'VG', 'VC', 'VTS'];
function row(name: string, g: string, cs: string, ts: string): string[] {
  const r = Array(header.length).fill('');
  r[0] = '1'; r[1] = name; r[2] = 'C'; r[4] = 'JUVENTUS'; r[8] = g; r[14] = cs; r[20] = ts;
  return r;
}

describe('0 / s.v. non sono voti', () => {
  it('paperVote', () => {
    expect([0, -1, 11, NaN, null, undefined, 5.5].map(paperVote)).toEqual([null, null, null, null, null, null, 5.5]);
  });

  it('media solo sui voti reali: G 5,5 · CS s.v. · TS 0 = 5,5', () => {
    expect(averageOfVotes([5.5, null, 0])).toBe(5.5);
    expect(averageOfVotes([0, null, 0])).toBeNull();
    expect(consolidatedVote({ vote_gazzetta: 5.5, vote_corriere: null, vote_tuttosport: 0 })).toBe(5.5);
  });

  it('parser pianetafanta: 0, vuoto, s.v., sv, - sono voti mancanti', () => {
    const file = parsePianetafantaRows([
      ['Voti Ufficiali'],
      ['Giornata: 8 · Bonus: Standard'],
      header,
      row('LOCATELLI M.', '5,5', 's.v.', '0'),
      row('YILDIZ K.', 'sv', '-', ''),
      row('VLAHOVIC D.', '6', '6,5', '0,0'),
    ]);
    const [a, b, c] = file.players;
    expect(a.votes).toEqual({ gazzetta: 5.5, corriere: null, tuttosport: null });
    expect(a.average).toBe(5.5);
    expect(a.voteCount).toBe(1);
    expect(b.average).toBeNull();
    expect(b.voteCount).toBe(0);
    expect(c.average).toBe(6.25);
  });

  it('import già salvati con 0: riapplicazione e riga official_votes li ignorano', () => {
    const stale = {
      name: 'LOCATELLI M.', team: 'JUVENTUS', role: 'C', votes: { gazzetta: 5.5, corriere: null, tuttosport: 0 },
      average: 2.75, voteCount: 2, playerId: 'loca', bonuses: [],
    } as unknown as PianetafantaMatchedPlayer;
    const group = rematchStoredImport(
      { serie_a_matchday: 8, match_key: 'LEC-JUV', home_team: 'LEC', away_team: 'JUV', players: [stale] },
      { players: [{ id: 'loca', name: 'LOCATELLI Manuel', role: 'C', realTeam: 'JUV' }], aliases: [] }
    );
    expect(group.players[0].average).toBe(5.5);
    expect(group.players[0].votes.tuttosport).toBeNull();
    const dbRow = pianetafantaVoteRow(2, stale, 'now');
    expect(dbRow.vote_tuttosport).toBeNull();
    expect(dbRow.fanta_vote).toBe(5.5);
  });

  it('cancellazione singola: il giocatore escluso non viene riconsolidato', () => {
    const p = { name: 'A', team: 'JUV', role: 'C', votes: { gazzetta: 6, corriere: null, tuttosport: 0 }, playerId: 'a', bonuses: [] } as unknown as PianetafantaMatchedPlayer;
    const q = { ...p, name: 'B', playerId: 'b' } as PianetafantaMatchedPlayer;
    expect(consolidatedPlayersOf([p, q])[0]).toMatchObject({ average: 6, zeroVotes: 1 });
    const after = excludePlayer([p, q], 'a');
    expect(consolidatedPlayersOf(after).map((x) => x.playerId)).toEqual(['b']);
    const group = rematchStoredImport(
      { serie_a_matchday: 8, match_key: 'LEC-JUV', home_team: 'LEC', away_team: 'JUV', players: after },
      { players: [{ id: 'a', name: 'A', role: 'C', realTeam: 'JUV' }, { id: 'b', name: 'B', role: 'C', realTeam: 'JUV' }], aliases: [] }
    );
    expect(group.players.map((x) => x.playerId)).toEqual([null, 'b']);
  });
});

describe('masterVote', () => {
  it('Gazzetta master when Gazzetta published, average otherwise', () => {
    expect(masterVote({ gazzetta: null, corriere: 6, tuttosport: 6 }, true)).toBeNull();
    expect(masterVote({ gazzetta: 6, corriere: 7, tuttosport: null }, true)).toBe(6.5);
    expect(masterVote({ gazzetta: null, corriere: 6, tuttosport: 7 }, false)).toBe(6.5);
  });
});
