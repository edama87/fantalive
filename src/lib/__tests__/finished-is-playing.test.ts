import { describe, it, expect } from 'vitest';
import { clearFinishedIsPlaying, isRoundLive } from '@/lib/round-player-data';
import { parseEspnSummary } from '@/lib/espn-live';

describe('in campo dopo il fischio finale', () => {
  it('azzera is_playing per i giocatori di partite finite (Torino-Como)', () => {
    const votes = [
      { player_id: 'ramon-jacobo-d', is_playing: true },
      { player_id: 'x-mil', is_playing: true },
      { player_id: 'y', is_playing: false },
    ];
    const teams = new Map([['ramon-jacobo-d', 'COM'], ['x-mil', 'MIL']]);
    const statuses = new Map([['TOR', 'finished'], ['COM', 'finished'], ['MIL', 'live']]);
    const out = clearFinishedIsPlaying(votes, teams, statuses);
    expect(out.map((v) => v.is_playing)).toEqual([false, true, false]);
    expect(isRoundLive(clearFinishedIsPlaying(votes.slice(0, 1), teams, statuses), [{ status: 'finished' }])).toBe(false);
  });
  it('ESPN: scoreboard finita vince sul summary ancora live', () => {
    const summary: any = {
      header: { competitions: [{ status: { type: { state: 'in', completed: false, name: 'STATUS_SECOND_HALF' }, displayClock: "90'+4'" } }] },
      rosters: [{ team: { id: '1', displayName: 'Como' }, roster: [{ athlete: { displayName: 'Jacobo Ramon' }, starter: true, position: { abbreviation: 'CD' } }] }],
      keyEvents: [],
    };
    const parsed = parseEspnSummary(summary, () => 'ramon-jacobo-d', { status: 'finished', minute: 90 });
    expect(parsed.status).toBe('finished');
    expect(parsed.players[0].isPlaying).toBe(false);
    const live = parseEspnSummary(summary, () => 'ramon-jacobo-d', { status: 'live', minute: 90 });
    expect(live.players[0].isPlaying).toBe(true);
  });
});
