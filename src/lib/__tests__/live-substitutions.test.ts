import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeLiveMessage, liveMatchToVotePlayers } from '@/lib/fantacalcio-live';
import { substitutionsByPlayer } from '@/lib/serie-a-subs';
import { buildSerieAVoteRows } from '@/lib/serie-a-vote-rows';

const match = decodeLiveMessage(new Uint8Array(readFileSync(join(__dirname, 'fixtures/fantacalcio-live-8.dat')))).find((m) => m.matchId === 18033)!;
const players = liveMatchToVotePlayers(match, 'Torino', 'Monza');

describe('cambi dal file live fantacalcio.it', () => {
  it('legge ingresso (15) e uscita (14) con minuto', () => {
    expect(players.find((p) => p.name === 'Gineitis')?.substitution).toEqual({ in: 51 });
    expect(players.find((p) => p.name === 'Mandragora')).toMatchObject({ substitutedOut: true, substitution: { out: 51 } });
  });

  it('abbina chi esce e chi entra e mette il subentrato subito dopo', () => {
    const subs = substitutionsByPlayer(players);
    const rows = buildSerieAVoteRows(players.filter((p) => p.team === 'Torino'), subs, null);
    const i = rows.findIndex((r) => r.name === 'Mandragora');
    expect(rows[i].subOut).toEqual({ minute: 51, by: 'Gineitis' });
    expect(rows[i + 1]).toMatchObject({ name: 'Gineitis', subIn: { minute: 51, for: 'Mandragora' }, minutesPlayed: 39 });
    expect(rows[0].role).toBe('P');
    expect(rows.map((r) => r.role)).toEqual([...rows.map((r) => r.role)].sort((a, b) => 'PDCA'.indexOf(a!) - 'PDCA'.indexOf(b!)));
  });

  it('con i cambi ESPN abbina per nome', () => {
    const subs = substitutionsByPlayer(players, [{ minute: 51, team: 'Torino', inName: 'Gvidas Gineitis', outName: 'Nikola Mandragora' }]);
    const rows = buildSerieAVoteRows(players.filter((p) => p.team === 'Torino'), subs, null);
    const i = rows.findIndex((r) => r.name === 'Mandragora');
    expect(rows[i + 1].name).toBe('Gineitis');
    expect(rows[i + 1].subIn?.for).toBe('Mandragora');
  });
});
