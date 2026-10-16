import { describe, expect, it } from 'vitest';
import { fuzzyMatchPlayer } from '@/lib/fmsrevo-lineup-parser';
import {
  buildPlayerAliasInsert,
  lineupBlocksProceed,
  otherRosterTeamIds,
  rankLineupCandidates,
  type LineupPlayerCatalogEntry,
} from '@/lib/lineup-matching';
import type { Player } from '@/types';

const toure: Player = {
  id: 'el-bilal-toure',
  name: 'El Bilal Toure',
  role: 'A',
  teamId: 'ap',
  realTeam: 'Parma',
};

const otherToure: Player = {
  id: 'toure-rosa',
  name: "Toure' E. B.",
  role: 'A',
  teamId: 'ap',
  realTeam: 'Parma',
};

const soule: Player = {
  id: 'soule-mateo',
  name: 'Soule Mateo',
  role: 'A',
  teamId: 'ym',
  realTeam: 'Roma',
};

describe('alias FMS salvato e riusato', () => {
  it('salva il nome FMS e lo riconosce all\'import successivo, prima del nome esatto in rosa', () => {
    const roster = [otherToure];
    const players = [otherToure, toure, soule];
    const rawName = "Toure' E. B.";

    const before = fuzzyMatchPlayer(rawName, players, 'A', 'PAR', roster, []);
    expect(before.playerId).toBe('toure-rosa');

    const saved = buildPlayerAliasInsert(rawName, toure.id);
    expect(saved).toEqual({
      alias: rawName,
      player_id: toure.id,
      source: 'fms',
    });

    const aliases = [{ alias: saved.alias, playerId: saved.player_id, playerName: toure.name }];
    const after = fuzzyMatchPlayer(rawName, players, 'A', 'PAR', roster, aliases);
    expect(after.playerId).toBe(toure.id);
    expect(after.playerName).toBe('El Bilal Toure');

    const reused = fuzzyMatchPlayer("Toure' E. B.", players, 'A', 'PAR', roster, aliases);
    expect(reused.playerId).toBe(toure.id);
  });

  it('usa il nome esatto in rosa se non c\'è alias, poi la ricerca approssimativa', () => {
    const roster = [otherToure];
    const exact = fuzzyMatchPlayer("Toure' E. B.", [otherToure, toure], 'A', 'PAR', roster, []);
    expect(exact.playerId).toBe('toure-rosa');

    const fuzzy = fuzzyMatchPlayer(
      'Toure E.',
      [toure],
      'A',
      'PAR',
      [toure],
      []
    );
    expect(fuzzy.playerId).toBe(toure.id);
  });
});

describe('ordinamento candidati', () => {
  const catalog: LineupPlayerCatalogEntry[] = [
    { id: 'gk', name: 'Mandas', role: 'P', realTeam: 'Lazio', rosterTeamIds: ['ap'] },
    { id: 'toure', name: 'El Bilal Toure', role: 'A', realTeam: 'Parma', rosterTeamIds: ['ap'] },
    { id: 'winks', name: 'Winks', role: 'C', realTeam: 'Cagliari', rosterTeamIds: ['ap'] },
    { id: 'soule', name: 'Soule', role: 'A', realTeam: 'Roma', rosterTeamIds: ['ym'] },
    { id: 'free', name: 'Rossi', role: 'A', realTeam: 'Milan', rosterTeamIds: [] },
  ];
  const roster = new Set(['gk', 'toure', 'winks']);

  it('mette prima la rosa con lo stesso ruolo, poi il resto della rosa, poi gli altri', () => {
    const ranked = rankLineupCandidates(catalog, roster, 'A', '');
    expect(ranked.map((player) => player.id)).toEqual([
      'toure',
      'gk',
      'winks',
      'free',
      'soule',
    ]);
  });

  it('filtra per nome senza cambiare i gruppi', () => {
    const ranked = rankLineupCandidates(catalog, roster, 'A', 'sou');
    expect(ranked.map((player) => player.id)).toEqual(['soule']);
  });
});

describe('conferma giocatore di un\'altra rosa', () => {
  it('chiede conferma solo se il giocatore è in una rosa diversa', () => {
    expect(otherRosterTeamIds({ rosterTeamIds: ['ym'] }, 'ap')).toEqual(['ym']);
    expect(otherRosterTeamIds({ rosterTeamIds: ['ap', 'ym'] }, 'ap')).toEqual(['ym']);
    expect(otherRosterTeamIds({ rosterTeamIds: ['ap'] }, 'ap')).toEqual([]);
    expect(otherRosterTeamIds({ rosterTeamIds: [] }, 'ap')).toEqual([]);
  });
});

describe('Procedi', () => {
  it('non blocca un avviso sui titolari se ogni giocatore è abbinato', () => {
    expect(
      lineupBlocksProceed({
        isSkipped: false,
        usePreviousLineup: false,
        hasLineup: true,
        errors: [],
        starters: [{ matchedPlayerId: 'a' }],
        bench: [{ matchedPlayerId: 'b' }],
      })
    ).toBe(false);
  });

  it('blocca finché resta un giocatore non riconosciuto', () => {
    expect(
      lineupBlocksProceed({
        isSkipped: false,
        usePreviousLineup: false,
        hasLineup: true,
        errors: ['Titolari non riconosciuti: Toure\' E. B.'],
        starters: [{ matchedPlayerId: null }],
        bench: [{ matchedPlayerId: 'b' }],
      })
    ).toBe(true);
  });
});
