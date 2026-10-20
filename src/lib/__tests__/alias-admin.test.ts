import { describe, expect, it } from 'vitest';
import { buildUnmatchedList, type CatalogEntry } from '@/lib/alias-admin';

const catalog: CatalogEntry[] = [
  { id: 'kone-m', name: "KONE' Kouadio Manu", role: 'C', realTeam: 'ROM', fantaTeam: 'ap' },
  { id: 'kone-i', name: 'KONE Ismael', role: 'C', realTeam: 'SAS', fantaTeam: null },
  { id: 'cristante', name: 'CRISTANTE Bryan', role: 'C', realTeam: 'ROM', fantaTeam: null },
];

describe('buildUnmatchedList', () => {
  it('segna i probabili giocatori in rosa con suggerimenti dello stesso club', () => {
    const list = buildUnmatchedList(
      [{ match_key: 'ROM-X', players: [
        { name: 'KONÉ M.', team: 'Roma', role: 'C', average: 6.5, playerId: null },
        { name: 'SCONOSCIUTO P.', team: 'Roma', role: 'C', average: 6, playerId: null },
        { name: 'CRISTANTE B.', team: 'Roma', role: 'C', average: 6, playerId: 'cristante' },
      ] as never }],
      [{ name: 'Kone M.', team: 'ROM', role: 'C', vote: 6.5, candidates: [] }],
      catalog
    );
    expect(list.map((item) => [item.name, item.source, item.rostered])).toEqual([
      ['Kone M.', 'fantacalcio', true],
      ['KONÉ M.', 'pianetafanta', true],
      ['SCONOSCIUTO P.', 'pianetafanta', false],
    ]);
    expect(list[1].suggestions).toEqual([expect.objectContaining({ id: 'kone-m', best: true, fantaTeam: 'ap' })]);
  });
});
