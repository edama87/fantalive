import { describe, expect, it } from 'vitest';
import {
  formationIssues,
  normalizePlayerName,
  resolvePlayer,
  resolvePlayers,
  suggestionPayloadSchema,
  type CatalogPlayer,
} from '@/lib/lineup-suggestions';
import { bearerToken, verifyApiKey } from '@/lib/auth/api-key';

const catalog: CatalogPlayer[] = [
  { id: 'n-dri-konan-a', name: "N'DRI Konan Ignace", role: 'A', realTeam: 'LEC', inTeam: true },
  { id: 'kessie-franck-yannick-c', name: "KESSIE' Franck Yannick", role: 'C', realTeam: 'ATA', inTeam: true },
  { id: 'perez-enrique-c', name: 'PEREZ Enrique', role: 'C', realTeam: 'VEN', inTeam: true },
  { id: 'perez-nehuen-d', name: 'PEREZ Nehuen', role: 'D', realTeam: 'NAP', inTeam: false },
  { id: 'mancini-gianluca-d', name: 'MANCINI Gianluca', role: 'D', realTeam: 'ROM', inTeam: true },
  { id: 'mancini-x-d', name: 'MANCINI Xavier', role: 'D', realTeam: 'XXX', inTeam: false },
];

describe('lineup suggestions', () => {
  it('normalizza accenti e apostrofi', () => {
    expect(normalizePlayerName("N'Dri")).toBe('NDRI');
    expect(normalizePlayerName('Kessié')).toBe('KESSIE');
  });

  it('abbina per cognome preferendo la rosa', () => {
    expect(resolvePlayer({ name: "N'Dri" }, catalog)?.id).toBe('n-dri-konan-a');
    expect(resolvePlayer({ name: 'Kessié' }, catalog)?.id).toBe('kessie-franck-yannick-c');
    expect(resolvePlayer({ name: 'Perez' }, catalog)?.id).toBe('perez-enrique-c');
    expect(resolvePlayer({ name: 'Perez', role: 'D' }, catalog)?.id).toBe('perez-nehuen-d');
    expect(resolvePlayer({ name: 'Mancini' }, catalog)?.id).toBe('mancini-gianluca-d');
    expect(resolvePlayer({ playerId: 'perez-nehuen-d' }, catalog)?.name).toBe('PEREZ Nehuen');
    expect(resolvePlayer({ name: 'Sconosciuto' }, catalog)).toBeNull();
  });

  it('segnala ruoli incoerenti col modulo', () => {
    const starters = resolvePlayers([{ name: 'Perez' }, { name: 'Mancini' }], catalog);
    expect(formationIssues('4-5-1', starters)).toContain('Titolari: 2 invece di 11');
    expect(formationIssues('4-5-2', starters)[0]).toMatch(/non somma a 10/);
  });

  it('valida il payload con default', () => {
    const ok = suggestionPayloadSchema.parse({ round: 2, formation: '4-5-1', starters: [{ name: 'Perez' }] });
    expect(ok.teamId).toBe('ap');
    expect(ok.variant).toBe('principale');
    expect(suggestionPayloadSchema.safeParse({ round: 2, formation: '451', starters: [{ name: 'x' }] }).success).toBe(false);
    expect(suggestionPayloadSchema.safeParse({ round: 2, formation: '4-5-1', starters: [{}] }).success).toBe(false);
  });

  it('verifica il bearer token', () => {
    const key = 'k'.repeat(40);
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(verifyApiKey(key, key)).toBe(true);
    expect(verifyApiKey('wrong', key)).toBe(false);
    expect(verifyApiKey(key, undefined)).toBe(false);
    expect(verifyApiKey('short', 'short')).toBe(false);
  });
});
