import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFantacalcioVotes } from '@/lib/fantacalcio-it';
import {
  extractEspnSubstitutions,
  fantacalcioBonusBreakdown,
  sameFootballer,
  substitutionsByPlayer,
} from '@/lib/serie-a-subs';
import type { EspnSummary } from '@/lib/espn-live';

const html = readFileSync(join(__dirname, 'fixtures/fantacalcio-voti-frosinone-sassuolo.html'), 'utf8');
const summary = JSON.parse(
  readFileSync(join(__dirname, '../../providers/__tests__/fixtures/espn-summary-fro-sas.json'), 'utf8')
) as EspnSummary;
const players = parseFantacalcioVotes(html);
const info = (map: ReturnType<typeof substitutionsByPlayer>, team: string, name: string) => map.get(`${team}|${name}`);

describe('sameFootballer', () => {
  it('abbina i nomi fantacalcio.it ai nomi ESPN', () => {
    expect(sameFootballer('Esposito Se.', 'Sebastiano Esposito')).toBe(true);
    expect(sameFootballer('Dominguez B.', 'Benjamín Domínguez')).toBe(true);
    expect(sameFootballer('Calò', 'Giacomo Calo')).toBe(true);
    expect(sameFootballer('Laurientè', 'Armand Laurienté')).toBe(true);
    expect(sameFootballer('Esposito F.', 'Sebastiano Esposito')).toBe(false);
    expect(sameFootballer('Matic', 'Josh Doig')).toBe(false);
  });
});

describe('cambi Serie A', () => {
  it('estrae i cambi ESPN con minuto (participants[0] entra)', () => {
    const subs = extractEspnSubstitutions(summary);
    expect(subs).toHaveLength(10);
    expect(subs[0]).toEqual({ minute: 58, team: 'Sassuolo', inName: 'Kieron Bowie', outName: 'Kristian Thorstvedt' });
  });

  it('con ESPN segna entrati e usciti con il minuto', () => {
    const map = substitutionsByPlayer(players, extractEspnSubstitutions(summary));
    expect(info(map, 'Sassuolo', 'Bowie')).toEqual({ in: { minute: 58 } });
    expect(info(map, 'Sassuolo', 'Thorstvedt')).toEqual({ out: { minute: 58 } });
    expect(info(map, 'Sassuolo', 'Dominguez B.')).toEqual({ in: { minute: 67 } });
    expect(info(map, 'Sassuolo', 'Esposito Se.')).toEqual({ out: { minute: 67 } });
    expect(info(map, 'Frosinone', 'Birligea')).toEqual({ in: { minute: 90 } });
    expect(info(map, 'Frosinone', 'Raimondo')).toEqual({ out: { minute: 90 } });
    expect(info(map, 'Frosinone', 'Masini')).toBeUndefined();
    expect([...map.values()].filter((i) => i.in)).toHaveLength(10);
    expect([...map.values()].filter((i) => i.out)).toHaveLength(10);
  });

  it('senza ESPN usa l’ordine di fantacalcio.it (chi entra segue chi esce), senza minuti', () => {
    const map = substitutionsByPlayer(players);
    expect(info(map, 'Frosinone', 'Oyono A.')).toEqual({ out: { minute: null } });
    expect(info(map, 'Frosinone', 'Amey')).toEqual({ in: { minute: null } });
    expect(info(map, 'Sassuolo', 'Lipani')).toEqual({ in: { minute: null } });
    expect(info(map, 'Sassuolo', 'Volpato')).toEqual({ in: { minute: null } });
    expect(info(map, 'Frosinone', 'Masini')).toBeUndefined();
  });

  it('converte i bonus per le emoji condivise', () => {
    const raimondo = players.find((p) => p.name === 'Raimondo')!;
    expect(fantacalcioBonusBreakdown(raimondo.bonuses).goals).toBe(3);
    const muric = players.find((p) => p.name === 'Muric')!;
    expect(fantacalcioBonusBreakdown(muric.bonuses).goalsConceded).toBe(4);
    const bowie = players.find((p) => p.name === 'Bowie')!;
    expect(fantacalcioBonusBreakdown(bowie.bonuses).yellowCards).toBe(1);
  });
});
