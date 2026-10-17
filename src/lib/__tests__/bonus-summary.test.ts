import { describe, expect, it } from 'vitest';
import { emptyBonuses, splitBonusSummary } from '@/lib/bonus-summary';
import { eventEmojiSequence } from '@/components/match/event-emoji';
import type { PlayerScore } from '@/types';

const ps = (id: string, over: Partial<PlayerScore>, bonuses: Partial<ReturnType<typeof emptyBonuses>>): PlayerScore => ({
  player: { id, name: id, role: 'A', teamId: 'dc' },
  baseVote: 7, fantavoto: 7, status: 'played', isStarter: true,
  bonuses: { ...emptyBonuses(), ...bonuses },
  ...over,
});
const emoji = (b: ReturnType<typeof emptyBonuses>) => eventEmojiSequence(b, { includeConceded: false }).map((e) => e.emoji).join('');

describe('match card summary: counted vs not counted events', () => {
  it('puts muted and unused-bench events after the counted ones (Dinamo: Raimondo on the bench)', () => {
    const scores = [
      ps('calo', {}, { goals: 1, assists: 1 }),
      ps('esposito', {}, { assists: 1 }),
      ps('raimondo', { isStarter: false, isUnusedBench: true, isCertainlyOut: true, fantavoto: 17.5 }, { goals: 3 }),
      ps('sv-starter', { status: 'sv', fantavoto: 0 }, { yellowCards: 1 }),
      ps('subbed-in', { isStarter: false }, { goals: 1 }),
    ];
    const { counted, excluded } = splitBonusSummary(scores);
    expect(emoji(counted)).toBe('⚽⚽👟👟');
    expect(emoji(excluded)).toBe('⚽⚽⚽🟨');
  });

  it('has nothing excluded when every event counts', () => {
    const { excluded } = splitBonusSummary([ps('a', {}, { goals: 2 })]);
    expect(emoji(excluded)).toBe('');
  });
});
