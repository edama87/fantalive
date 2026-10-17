import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFirstSheet } from '@/lib/xlsx-reader';
import {
  averageOfAvailable,
  groupPianetafantaMatches,
  matchPianetafantaPlayers,
  parseCellNumber,
  parsePianetafantaRows,
} from '@/lib/pianetafanta';
import { pianetafantaVotesUrl, samePianetafantaName } from '@/lib/pianetafanta-url';
import { pianetafantaVoteRow } from '@/lib/official-votes';
import { assembleRoundPlayerData } from '@/lib/round-player-data';
import { voteSourceCounts } from '@/lib/vote-source';
import type { PlayerScore } from '@/types';

const xlsx = readFileSync(join(__dirname, 'fixtures/pianetafanta-voti-g7.xlsx'));
const file = parsePianetafantaRows(readFirstSheet(xlsx));
const byName = (name: string) => file.players.find((p) => p.name === name)!;

describe('xlsx reader', () => {
  it('legge il primo foglio con stringhe condivise e numeri', () => {
    const rows = readFirstSheet(xlsx);
    expect(rows[0][0]).toBe('Voti Ufficiali');
    expect(rows[2].slice(0, 9)).toEqual(['ID', 'Giocatore', 'Ruolo', 'Ruolo2', 'Squadra', 'Min.Gioc.', 'Min', 'MinU', 'G']);
    expect(rows).toHaveLength(37);
  });

  it('rifiuta un file che non è zip', () => {
    expect(() => readFirstSheet(Buffer.from('ciao, non sono un excel'))).toThrow(/xlsx/);
  });
});

describe('parsePianetafantaRows (export reale giornata 7)', () => {
  it('legge giornata e giocatori, salta gli allenatori', () => {
    expect(file.serieAMatchday).toBe(7);
    expect(file.players).toHaveLength(32);
    expect(file.players.some((p) => p.name.startsWith('ALVINI'))).toBe(false);
  });

  it('voti per testata e media dei voti presenti', () => {
    const ghedjemis = byName('GHEDJEMIS F.');
    expect(ghedjemis.votes).toEqual({ gazzetta: 7, corriere: 6.5, tuttosport: 6.5 });
    expect(ghedjemis.average).toBe(6.67);
    expect(ghedjemis.voteCount).toBe(3);
    // Voto parziale: solo Gazzetta.
    const cichella = byName('CICHELLA M.');
    expect(cichella.votes).toEqual({ gazzetta: 6, corriere: null, tuttosport: null });
    expect(cichella.average).toBe(6);
    expect(cichella.voteCount).toBe(1);
    // Tutte s.v.
    expect(byName('AMEY W.').average).toBeNull();
  });

  it('bonus/malus e cambi', () => {
    const raimondo = byName('RAIMONDO A.');
    expect(raimondo.bonuses).toEqual([{ type: 'goal', label: 'Gol segnato', count: 3, minute: null }]);
    const calo = byName('CALÒ G.');
    expect(calo.bonuses.map((b) => b.type)).toEqual(['goal', 'assist']);
    expect(calo.subOut).toBe(80);
    expect(calo.minutesPlayed).toBe(80);
    expect(byName('MURIC A.').bonuses).toEqual([{ type: 'goal_conceded', label: 'Gol subito', count: 4, minute: null }]);
    expect(byName('BOWIE K.').bonuses.map((b) => b.type)).toEqual(['yellow_card']);
    const bowie = byName('BOWIE K.');
    expect(bowie.starter).toBe(false);
    expect(bowie.subIn).toBe(58);
    expect(bowie.minutesPlayed).toBe(32);
  });

  it('numeri e medie', () => {
    expect(parseCellNumber('6,5')).toBe(6.5);
    expect(parseCellNumber('s.v.')).toBeNull();
    expect(parseCellNumber('')).toBeNull();
    expect(averageOfAvailable([6, null, 7])).toBe(6.5);
    expect(averageOfAvailable([null, null])).toBeNull();
  });

  it('abbina ai giocatori in rosa e raggruppa per partita', () => {
    const catalog = {
      players: [
        { id: 'calo-giacomo-c', name: "CALO' Giacomo", role: 'C' as const, realTeam: 'FRO' },
        { id: 'esposito-sebastiano-a', name: 'ESPOSITO Sebastiano', role: 'A' as const, realTeam: 'SAS' },
        { id: 'muric-arijanet-anan-p', name: 'MURIC Arijanet Anan', role: 'P' as const, realTeam: 'SAS' },
      ],
      aliases: [],
    };
    const matched = matchPianetafantaPlayers(file.players, catalog);
    expect(matched.find((p) => p.name === 'CALÒ G.')?.playerId).toBe('calo-giacomo-c');
    expect(matched.find((p) => p.name === 'ESPOSITO S.')?.playerId).toBe('esposito-sebastiano-a');
    const groups = groupPianetafantaMatches(matched, [{ homeTeam: 'Frosinone', awayTeam: 'Sassuolo' }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: 'FRO-SAS', homeTeam: 'Frosinone', awayTeam: 'Sassuolo', matched: 3 });
    expect(groups[0].unmatched).toHaveLength(29);
  });

  it('non è un export pianetafanta', () => {
    expect(() => parsePianetafantaRows([['a', 'b'], ['c']])).toThrow(/pianetafanta/);
  });
});

describe('righe official_votes e priorità', () => {
  const now = '2026-10-17T10:00:00.000Z';
  const calo = { ...byName('CALÒ G.'), playerId: 'calo-giacomo-c', matchedName: "CALO' Giacomo" };

  it('riga pianetafanta: voti di testata, minuti, bonus e cambi', () => {
    const row = pianetafantaVoteRow(1, calo, now);
    expect(row).toMatchObject({
      round_number: 1,
      player_id: 'calo-giacomo-c',
      source: 'pianetafanta',
      consolidated_at: now,
      vote_gazzetta: 7.5,
      vote_corriere: 7,
      vote_tuttosport: 7.5,
      minutes_played: 80,
    });
    expect(row.fanta_vote).toBe(11.3); // fanta_vote è NUMERIC(3,1)
    expect(row.bonus_malus.map((b) => b.type)).toEqual(['goal', 'assist', 'substitution_out']);
  });

  it('il consolidato vince su fantacalcio.it e live, anche se s.v.', () => {
    const data = assembleRoundPlayerData(
      [
        { player_id: 'a', source: 'pianetafanta', vote_fantacalcio: 7.5, vote_average: 7.33, minutes_played: 80,
          bonus_malus: [{ type: 'goal', count: 1 }] },
        { player_id: 'b', source: 'pianetafanta', vote_fantacalcio: null, vote_average: null, minutes_played: 10, bonus_malus: [] },
        { player_id: 'c', source: 'fantacalcio', vote_fantacalcio: 6, vote_average: 6, minutes_played: null, bonus_malus: [] },
      ],
      [
        { player_id: 'a', estimated_vote: 6, minutes_played: 80, is_playing: false },
        { player_id: 'b', estimated_vote: 6, minutes_played: 10, is_playing: false },
        { player_id: 'd', estimated_vote: 6.5, minutes_played: 30, is_playing: true },
      ],
      []
    );
    expect(data.get('a')).toMatchObject({ estimatedVote: 7.33, minutesPlayed: 80, voteSource: 'consolidated' });
    expect(data.get('a')?.events).toHaveLength(1);
    expect(data.get('b')).toMatchObject({ estimatedVote: null, voteSource: 'consolidated' });
    expect(data.get('c')).toMatchObject({ estimatedVote: 6, voteSource: 'official' });
    expect(data.get('d')).toMatchObject({ estimatedVote: 6.5, voteSource: 'live' });
  });
});

describe('pagina Serie A e conteggi', () => {
  it('url pianetafanta della giornata di Serie A', () => {
    expect(pianetafantaVotesUrl(7)).toBe('https://www.pianetafanta.it/voti-fantacalcio?giornata=7');
  });

  it('nomi pianetafanta contro fantacalcio.it', () => {
    expect(samePianetafantaName('ESPOSITO S.', 'Esposito Se.')).toBe(true);
    expect(samePianetafantaName('FAYED O.', 'Omar Fayed')).toBe(true);
    expect(samePianetafantaName('CALÒ G.', 'Calò')).toBe(true);
    expect(samePianetafantaName('LAURIENTÉ A.', 'Laurientè')).toBe(true);
    expect(samePianetafantaName('VAN DER BREMPT I.', 'Van Der Brempt')).toBe(true);
    expect(samePianetafantaName('DOMINGUEZ B.', 'Dominguez B.')).toBe(true);
    expect(samePianetafantaName('MATIC N.', 'Doig')).toBe(false);
  });

  it('conta consolidati e stimati tra i voti che contano', () => {
    const base = { bonuses: {} as PlayerScore['bonuses'], fantavoto: 6, isStarter: true, player: {} as PlayerScore['player'] };
    const scores = [
      { ...base, baseVote: 6, status: 'played', voteSource: 'consolidated' },
      { ...base, baseVote: 6, status: 'played', voteSource: 'live' },
      { ...base, baseVote: 6, status: 'playing', voteSource: 'official' },
      { ...base, baseVote: 0, status: 'sv', voteSource: 'consolidated' },
      { ...base, baseVote: 6, status: 'played', voteSource: 'consolidated', isUnusedBench: true },
    ] as PlayerScore[];
    expect(voteSourceCounts(scores)).toEqual({ consolidated: 1, estimated: 2 });
  });
});
