import { describe, expect, it } from 'vitest';
import { EVENT_EMOJI, eventEmojiSequence } from '@/components/match/event-emoji';
import type { BonusBreakdown } from '@/types';

const empty: BonusBreakdown = {
  goals: 0, assists: 0, yellowCards: 0, redCards: 0, penaltyGoals: 0,
  penaltyMissed: 0, penaltySaved: 0, ownGoals: 0, goalsConceded: 0,
} as BonusBreakdown;

describe('event emoji (shared by legend and player rows)', () => {
  it('uses the legend emoji, repeated per count', () => {
    const seq = eventEmojiSequence({ ...empty, goals: 3, assists: 1, penaltyGoals: 1 });
    expect(seq.map((s) => s.emoji).join('')).toBe('⚽⚽⚽🅿️👟');
  });

  it('has one distinct emoji per event', () => {
    const emojis = EVENT_EMOJI.map((e) => e.emoji);
    expect(new Set(emojis).size).toBe(emojis.length);
    expect(Object.fromEntries(EVENT_EMOJI.map((e) => [e.key, e.emoji]))).toMatchObject({
      goals: '⚽', penaltyGoals: '🅿️', penaltyMissed: '❌', penaltySaved: '🧤',
      assists: '👟', yellowCards: '🟨', redCards: '🟥', ownGoals: '⚽↩️',
    });
  });

  it('can hide goals conceded (match card summary)', () => {
    const seq = eventEmojiSequence({ ...empty, goalsConceded: 2, yellowCards: 1 }, { includeConceded: false });
    expect(seq.map((s) => s.emoji)).toEqual(['🟨']);
  });
});
