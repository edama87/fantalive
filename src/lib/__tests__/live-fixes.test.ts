import { describe, expect, it } from 'vitest';
import type { PlayerScore } from '@/types';
import { countOnPitch } from '@/lib/on-pitch';
import { hasAnyVote, liveVotesToMatchPlayers } from '@/lib/live-vote-fallback';

const s = (status: PlayerScore['status'], isUnusedBench = false) => ({ status, isUnusedBench }) as unknown as PlayerScore;

describe('countOnPitch', () => {
  it('non conta i panchinari non utilizzati anche se giocano nella realtà', () => {
    // Real Pedrotte: Adams titolare in campo, Mota in panchina fantacalcio ma in campo con il Monza
    expect(countOnPitch([s('playing'), s('to_play'), s('playing', true)])).toBe(1);
  });
});

describe('liveVotesToMatchPlayers', () => {
  const rows = [
    { name: "ADAMS Che' Zach", role: 'A', realTeam: 'TOR', vote: 5.5, isSubbedOut: false },
    { name: 'MOTA CARVALHO Dany', role: 'A', realTeam: 'MON', vote: 6, isSubbedOut: false },
    { name: 'BARELLA Nicolo', role: 'C', realTeam: 'INT', vote: 6.5, isSubbedOut: false },
    { name: 'SENZA VOTO', role: 'D', realTeam: 'TOR', vote: null, isSubbedOut: false },
  ];
  it('tiene solo le due squadre e i giocatori con voto, con il nome squadra della pagina', () => {
    const out = liveVotesToMatchPlayers(rows, 'Torino', 'Monza');
    expect(out.map((p) => [p.name, p.team, p.vote])).toEqual([
      ["ADAMS Che' Zach", 'Torino', 5.5],
      ['MOTA CARVALHO Dany', 'Monza', 6],
    ]);
    expect(hasAnyVote(out)).toBe(true);
    expect(hasAnyVote([])).toBe(false);
  });
});
