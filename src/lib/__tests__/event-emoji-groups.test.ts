import { describe, expect, it } from 'vitest';
import { eventEmojiGroups } from '@/components/match/event-emoji';
import type { BonusBreakdown } from '@/types';

const empty: BonusBreakdown = { goals: 0, penaltyGoals: 0, penaltyMissed: 0, penaltySaved: 0, assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0, goalsConceded: 0 };

describe('icone bonus/malus con moltiplicatore', () => {
  it('raggruppa per tipo in ordine fisso con conteggio ed etichetta', () => {
    const g = eventEmojiGroups({ ...empty, yellowCards: 4, goals: 2, assists: 2, penaltyMissed: 1, penaltyGoals: 1, redCards: 1 });
    expect(g.map((x) => `${x.emoji}${x.count}`)).toEqual(['⚽2', '🅿️1', '👟2', '🟨4', '🟥1', '❌1']);
    expect(g.find((x) => x.key === 'yellowCards')?.label).toBe('Ammonizioni: 4');
  });
  it('esclude i gol subiti se richiesto e i conteggi a zero', () => {
    expect(eventEmojiGroups({ ...empty, goalsConceded: 3 }, { includeConceded: false })).toEqual([]);
    expect(eventEmojiGroups({ ...empty, goalsConceded: 3 })).toEqual([{ key: 'goalsConceded', emoji: '🥅', count: 3, label: 'Gol subiti: 3' }]);
  });
});
