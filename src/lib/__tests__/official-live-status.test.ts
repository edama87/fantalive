import { describe, expect, it } from 'vitest';
import { assembleRoundPlayerData, type OfficialVoteRow } from '@/lib/round-player-data';

const official = (player_id: string, bonus_malus: unknown[] = []) =>
  ({ player_id, round_number: 2, vote_fantacalcio: 7, fanta_vote: 10, minutes_played: null, bonus_malus, source: 'fantacalcio' }) as unknown as OfficialVoteRow;
const live = (player_id: string, is_playing: boolean, minutes: number, is_subbed_out = false) =>
  ({ player_id, estimated_vote: 6, minutes_played: minutes, is_playing, is_subbed_out, updated_at: '2026-10-23T20:00:00Z' });

describe('voto fantacalcio.it durante la partita', () => {
  it('mantiene in campo e minuti dal feed live', () => {
    const d = assembleRoundPlayerData([official('varela')], [live('varela', true, 66)], []).get('varela')!;
    expect(d).toMatchObject({ estimatedVote: 7, voteSource: 'official', isPlaying: true, minutesPlayed: 66 });
  });
  it('non in campo se sostituito o a fine partita', () => {
    expect(assembleRoundPlayerData([official('a')], [live('a', true, 51, true)], []).get('a')!.isPlaying).toBe(false);
    expect(assembleRoundPlayerData([official('b')], [live('b', false, 90)], []).get('b')!.isPlaying).toBe(false);
  });
  it('non in campo se espulso', () => {
    const d = assembleRoundPlayerData([official('c', [{ type: 'red_card', count: 1 }])], [live('c', true, 70)], []).get('c')!;
    expect(d.isPlaying).toBe(false);
  });
  it('senza feed live resta finito (90′)', () => {
    expect(assembleRoundPlayerData([official('d')], [], []).get('d')).toMatchObject({ isPlaying: false, minutesPlayed: 90 });
  });
});
