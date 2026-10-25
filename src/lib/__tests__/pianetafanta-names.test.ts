import { describe, expect, it } from 'vitest';
import { matchFantacalcioPlayer, type FantacalcioCatalogPlayer } from '@/lib/fantacalcio-it';
import { suggestRosterPlayer } from '@/lib/pianetafanta';
import type { PlayerRole } from '@/types';

const roster: FantacalcioCatalogPlayer[] = [
  ['soule', "SOULE' Matias", 'C', 'ROM'],
  ['toure', "TOURE' El Bilal", 'A', 'PAR'],
  ['lauriente', "LAURIENTE' Armand", 'A', 'SAS'],
  ['tavares', 'TAVARES Nuno Albertino', 'D', 'LAZ'],
  ['mussolini', 'FLORIANI MUSSOLINI Romano', 'D', 'LAZ'],
  ['mota', 'MOTA CARVALHO Dany', 'A', 'MON'],
  ['kaiki', 'KAIKI Bruno da Silva', 'D', 'COM'],
  ['dacunha', 'DA CUNHA Lucas', 'C', 'COM'],
  ['adamsTor', "ADAMS Che' Zach", 'A', 'TOR'],
  ['adamsVen', 'ADAMS Akor Jerome', 'A', 'VEN'],
  ['rodriguez', 'RODRIGUEZ Juan Martin', 'D', 'CAG'],
  ['espositoS', 'ESPOSITO Sebastiano', 'A', 'SAS'],
  ['espositoF', 'ESPOSITO Francesco Pio', 'A', 'INT'],
  ['ndicka', 'NDICKA Obite Evan', 'D', 'ROM'],
  ['wesley', 'WESLEY Franca Lima', 'D', 'ROM'],
  ['deroon', 'DE ROON Marten', 'C', 'ROM'],
  ['romano', 'ROMANO Alessandro', 'C', 'CAG'],
  ['giovane', 'GIOVANE Santana do Nascimento', 'A', 'NAP'],
  ['cambiaghi', "CAMBIAGHI Nicolo'", 'A', 'BOL'],
  ['kone', "KONE' Kouadio Manu", 'C', 'ROM'],
].map(([id, name, role, realTeam]) => ({ id, name, role, realTeam }) as FantacalcioCatalogPlayer);

const cases: Array<[string, string, PlayerRole, string | null]> = [
  ['SOULE M.', 'ROMA', 'C', 'soule'],
  ['TOURÉ E.', 'PARMA', 'A', 'toure'],
  ['LAURIENTÉ A.', 'SASSUOLO', 'A', 'lauriente'],
  ['NUNO TAVARES', 'LAZIO', 'D', 'tavares'],
  ['MUSSOLINI R.', 'LAZIO', 'D', 'mussolini'],
  ['MOTA D.', 'MONZA', 'A', 'mota'],
  ['KAIKI B.', 'COMO', 'D', 'kaiki'],
  ['DA CUNHA L.', 'COMO', 'C', 'dacunha'],
  ['ADAMS C.', 'TORINO', 'A', 'adamsTor'],
  ['RODRIGUEZ Ju.', 'CAGLIARI', 'D', 'rodriguez'],
  ['ESPOSITO S.', 'SASSUOLO', 'A', 'espositoS'],
  ['NDICKA E.', 'ROMA', 'D', 'ndicka'],
  ['WESLEY', 'ROMA', 'D', 'wesley'],
  ['DE ROON M.', 'ROMA', 'C', 'deroon'],
  ['ROMANO A.', 'CAGLIARI', 'C', 'romano'],
  ['GIOVANE D.', 'NAPOLI', 'A', 'giovane'],
  ['CAMBIAGHI N.', 'BOLOGNA', 'A', 'cambiaghi'],
  // Omonimi di altri club: non devono abbinarsi
  ['KOUADIO E.', 'MONZA', 'D', null],
  ['CARLOS D.', 'PARMA', 'D', null],
];

describe('nomi pianetafanta (giornata 8) contro rose', () => {
  it.each(cases)('%s (%s)', (name, team, role, expected) => {
    expect(matchFantacalcioPlayer(name, roster, [], { role, realTeam: team })?.playerId ?? null).toBe(expected);
  });

  it('usa un alias salvato anche se il nome non somiglia', () => {
    const hit = matchFantacalcioPlayer('ZÉ PEDRO', roster, [{ alias: 'ZE PEDRO', playerId: 'rodriguez', source: 'pianetafanta' }], {
      role: 'D',
      realTeam: 'CAGLIARI',
    });
    expect(hit?.playerId).toBe('rodriguez');
  });

  it('suggerisce un giocatore in rosa di un altro club solo se cognome, iniziale e ruolo coincidono', () => {
    const moved = [...roster, { id: 'bernabe', name: 'BERNABE Adrian', role: 'C', realTeam: 'BAR' } as FantacalcioCatalogPlayer];
    expect(suggestRosterPlayer({ name: 'BERNABÈ A.', role: 'C' }, moved)?.playerId).toBe('bernabe');
    expect(suggestRosterPlayer({ name: 'KOUADIO E.', role: 'D' }, roster)).toBeNull();
    expect(suggestRosterPlayer({ name: 'CARLOS D.', role: 'D' }, roster)).toBeNull();
    expect(suggestRosterPlayer({ name: 'ESPOSITO S.', role: 'C' }, roster)).toBeNull();
  });
});
