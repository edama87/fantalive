import { describe, expect, it } from 'vitest';
import { aggregateSeasonStats } from '../season-player-stats';
const row = (player_id: string, round_number: number, g: number | null, avg: number | null, fv: number | null) =>
  ({ player_id, round_number, vote_gazzetta: g, vote_average: avg, fanta_vote: fv });
describe('aggregateSeasonStats', () => {
  it('conta solo i voti Gazzetta, applica i bonus/malus al voto Gazzetta', () => {
    const s = aggregateSeasonStats([
      row('a', 1, 6, 6.17, 4.17), // -2 gol subiti → 4
      row('a', 2, 7, 6.5, 9.5), // +3 → 10
      row('a', 3, null, null, null), // s.v.
      row('b', 1, 5.5, 5.5, 5.5),
    ]);
    expect(s.get('a')).toEqual({ appearances: 2, average: 6.5, fantaAverage: 7 });
    expect(s.get('b')).toEqual({ appearances: 1, average: 5.5, fantaAverage: 5.5 });
  });
  it('ignora duplicati sulla stessa giornata e giocatori senza voto', () => {
    const s = aggregateSeasonStats([row('a', 1, 6, 6, 6), row('a', 1, 8, 8, 8), row('c', 1, null, 6, 6)]);
    expect(s.get('a')?.appearances).toBe(1);
    expect(s.has('c')).toBe(false);
  });
});
